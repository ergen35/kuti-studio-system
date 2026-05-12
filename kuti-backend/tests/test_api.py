from __future__ import annotations

import base64
import json
from pathlib import Path
from urllib.error import URLError

from fastapi.testclient import TestClient

from kuti_backend.api.main import create_app
from kuti_backend.core.settings import Settings, get_settings
from kuti_backend.generation import providers as generation_providers


PNG_PIXEL = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9XnG0AAAAASUVORK5CYII="
)


class _FakeHeaders:
    def get_content_charset(self) -> str:
        return "utf-8"

    def get_content_type(self) -> str:
        return "application/json"


class _FakeResponse:
    def __init__(self, payload: bytes) -> None:
        self._payload = payload
        self.headers = _FakeHeaders()

    def read(self) -> bytes:
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


def _fake_gpt_images_2_urlopen(request, timeout=None):
    request_data = json.loads(request.data.decode("utf-8"))
    assert request.full_url.endswith("/v1/images/generations")
    assert request_data["model"] == "gpt-image-2"
    assert request_data["response_format"] == "b64_json"
    payload = {
        "data": [
            {
                "b64_json": base64.b64encode(PNG_PIXEL).decode("ascii"),
            }
        ]
    }
    return _FakeResponse(json.dumps(payload).encode("utf-8"))


def _fake_sora_2_urlopen(request, timeout=None):
    request_data = json.loads(request.data.decode("utf-8"))
    assert request.full_url.endswith("/v1/responses")
    assert request_data["model"] == "sora-2"
    assert request_data["tools"] == [{"type": "image_generation"}]
    content = request_data["input"][0]["content"]
    assert content[0]["type"] == "input_text"
    assert content[1]["type"] == "input_image"
    assert content[1]["image_url"].startswith("data:image/png;base64,")
    payload = {
        "output": [
            {
                "type": "image_generation_call",
                "result": base64.b64encode(PNG_PIXEL).decode("ascii"),
            }
        ]
    }
    return _FakeResponse(json.dumps(payload).encode("utf-8"))


def _failing_gpt_images_2_urlopen(request, timeout=None):
    raise URLError("provider unavailable")


def _fake_generation_followup_urlopen(request, timeout=None):
    if request.full_url.endswith("/v1/images/generations"):
        return _fake_gpt_images_2_urlopen(request, timeout=timeout)
    if request.full_url.endswith("/v1/responses"):
        return _fake_sora_2_urlopen(request, timeout=timeout)
    return _fake_gpt_images_2_urlopen(request, timeout=timeout)


def _seedance_task_response(*, status: str, task_id: str = "seedance-task-1") -> _FakeResponse:
    payload: dict[str, object] = {"task_id": task_id, "status": status}
    if status == "succeeded":
        payload["result"] = base64.b64encode(PNG_PIXEL).decode("ascii")
        payload["mime_type"] = "video/mp4"
        payload["type"] = "video_generation_call"
    return _FakeResponse(json.dumps(payload).encode("utf-8"))


def _fake_seedance_2_urlopen(request, timeout=None):
    if request.full_url.endswith("/v1/videos/generations") and request.data is not None:
        request_data = json.loads(request.data.decode("utf-8"))
        assert request_data["model"] == "seedance-2"
        assert request_data["prompt"]
        assert request_data["resolution"] == "720p"
        return _seedance_task_response(status="queued")

    if request.full_url.endswith("/v1/videos/generations/seedance-task-1") or request.full_url.endswith("/v1/videos/seedance-task-1") or request.full_url.endswith("/v1/tasks/seedance-task-1"):
        return _seedance_task_response(status="succeeded")

    raise AssertionError(f"Unexpected Seedance request: {request.full_url}")


def test_health_and_config_endpoints(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    get_settings.cache_clear()
    app = create_app(
        Settings(data_dir=tmp_path / "kuti-data", environment="test")
    )
    client = TestClient(app)

    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    config = client.get("/api/config")
    assert config.status_code == 200
    payload = config.json()
    assert payload["appName"] == "Kuti Studio Backend"
    assert payload["openapiUrl"] == "/api/openapi.json"


def test_openapi_documentation_is_available(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    get_settings.cache_clear()
    app = create_app(
        Settings(data_dir=tmp_path / "kuti-data", environment="test")
    )
    client = TestClient(app)

    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "Kuti Studio Backend"
    assert "/api/health" in schema["paths"]
    assert "/api/config" in schema["paths"]


def test_project_crud_and_portable_files(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    created = client.post("/api/projects", json={"name": "Moon Docks", "settings_json": {"theme": "noir"}})
    assert created.status_code == 201
    project = created.json()
    project_id = project["id"]
    slug = project["slug"]

    listed = client.get("/api/projects")
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1

    detail = client.get(f"/api/projects/{project_id}")
    assert detail.status_code == 200
    assert detail.json()["name"] == "Moon Docks"

    updated = client.patch(f"/api/projects/{project_id}", json={"name": "Moon Docks Revised", "status": "active"})
    assert updated.status_code == 200
    assert updated.json()["name"] == "Moon Docks Revised"
    assert updated.json()["status"] == "active"

    opened = client.post(f"/api/projects/{project_id}/open")
    assert opened.status_code == 200
    assert opened.json()["last_opened_at"] is not None

    cloned = client.post(f"/api/projects/{project_id}/clone", json={"name": "Moon Docks Clone"})
    assert cloned.status_code == 201
    assert cloned.json()["name"] == "Moon Docks Clone"
    assert cloned.json()["slug"] != slug

    archived = client.post(f"/api/projects/{project_id}/archive")
    assert archived.status_code == 200
    assert archived.json()["status"] == "archived"

    exported = client.get(f"/api/projects/{project_id}/export")
    assert exported.status_code == 200
    assert exported.json()["slug"] == slug

    assert (tmp_path / "kuti-data" / "projects" / slug / "project.json").exists()


def test_character_profiles_and_relations(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    project = client.post("/api/projects", json={"name": "Atlas Sector"}).json()

    created = client.post(
        f"/api/projects/{project['id']}/characters",
        json={
            "name": "Jack Vespers",
            "alias": "The Lantern",
            "narrative_role": "protagonist",
            "description": "A cautious rebel from the docks.",
            "physical_description": "Lean frame, silver scar over the left brow.",
            "color_palette_json": ["#121212", "#d4a24c", "#f0e6d2"],
            "costume_elements_json": ["long coat", "brass buckle", "fingerless gloves"],
            "key_traits_json": ["observant", "guarded", "resourceful"],
            "personality": "Soft-spoken but relentless when cornered.",
            "narrative_arc": "Learns to trust a crew and lead openly.",
            "tags_json": ["lead", "dockside", "noir"],
        },
    )
    assert created.status_code == 201
    character = created.json()
    assert character["slug"] == "jack-vespers"

    slug_collision = client.post(
        f"/api/projects/{project['id']}/characters",
        json={
            "name": "Jack Vespers!",
            "narrative_role": "supporting",
        },
    )
    assert slug_collision.status_code == 201
    assert slug_collision.json()["slug"] == "jack-vespers-2"

    renamed = client.patch(
        f"/api/projects/{project['id']}/characters/{character['id']}",
        json={"name": "Jack Vesper Renamed"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["slug"] == "jack-vespers"

    detail = client.get(f"/api/projects/{project['id']}/characters/{character['id']}")
    assert detail.status_code == 200
    assert detail.json()["physical_description"].startswith("Lean frame")
    assert detail.json()["color_palette_json"] == ["#121212", "#d4a24c", "#f0e6d2"]

    updated = client.patch(
        f"/api/projects/{project['id']}/characters/{character['id']}",
        json={
            "personality": "Measured and defiant.",
            "tags_json": ["lead", "docks", "noir"],
        },
    )
    assert updated.status_code == 200
    assert updated.json()["personality"] == "Measured and defiant."

    duplicate = client.post(
        f"/api/projects/{project['id']}/characters/{character['id']}/duplicate",
        json={"name": "Jack Vespers Variant"},
    )
    assert duplicate.status_code == 201

    relation = client.post(
        f"/api/projects/{project['id']}/characters/{character['id']}/relations",
        json={
            "source_character_id": character["id"],
            "target_character_id": duplicate.json()["id"],
            "relation_type": "rival",
            "strength": 72,
            "narrative_dependency": "Their choices drive the central break.",
            "notes": "Keep the tension visible in scenes 2 and 4.",
        },
    )
    assert relation.status_code == 201

    relation_id = relation.json()["id"]

    inbound_update = client.patch(
        f"/api/projects/{project['id']}/characters/{duplicate.json()['id']}/relations/{relation_id}",
        json={"notes": "Update from the target side."},
    )
    assert inbound_update.status_code == 200
    assert inbound_update.json()["notes"] == "Update from the target side."

    duplicate_relation = client.post(
        f"/api/projects/{project['id']}/characters/{character['id']}/relations",
        json={
            "source_character_id": character["id"],
            "target_character_id": duplicate.json()["id"],
            "relation_type": "rival",
            "strength": 72,
        },
    )
    assert duplicate_relation.status_code == 409

    voice = client.post(
        f"/api/projects/{project['id']}/characters/{character['id']}/voice-samples",
        json={"label": "calm low register", "voice_notes": "Slow, intimate phrasing."},
    )
    assert voice.status_code == 201

    refreshed = client.get(f"/api/projects/{project['id']}/characters/{character['id']}")
    assert refreshed.status_code == 200
    assert refreshed.json()["relationships_summary"] is not None
    assert len(refreshed.json()["relations"]) == 1
    assert len(refreshed.json()["voice_samples"]) == 1

    deleted = client.delete(f"/api/projects/{project['id']}/characters/{duplicate.json()['id']}/relations/{relation_id}")
    assert deleted.status_code == 204

    deleted_character = client.delete(f"/api/projects/{project['id']}/characters/{character['id']}")
    assert deleted_character.status_code == 204

    remaining = client.get(f"/api/projects/{project['id']}/characters")
    assert remaining.status_code == 200
    assert len(remaining.json()["items"]) == 2


def test_story_references_use_stable_slugs(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    project = client.post("/api/projects", json={"name": "Night Harbor"}).json()
    character = client.post(
        f"/api/projects/{project['id']}/characters",
        json={"name": "Mara Vale", "narrative_role": "lead"},
    ).json()

    tome = client.post(
        f"/api/projects/{project['id']}/story/tomes",
        json={"title": "Volume One"},
    ).json()
    chapter = client.post(
        f"/api/projects/{project['id']}/story/chapters",
        json={"tome_id": tome["id"], "title": "Opening"},
    ).json()
    scene = client.post(
        f"/api/projects/{project['id']}/story/scenes",
        json={
            "tome_id": tome["id"],
            "chapter_id": chapter["id"],
            "title": "Dockside Arrival",
            "content": "Mara steps into frame as @character:mara-vale.",
        },
    ).json()

    summary = client.get(f"/api/projects/{project['id']}/story")
    assert summary.status_code == 200
    assert summary.json()["orphan_references"] == []

    renamed = client.patch(
        f"/api/projects/{project['id']}/characters/{character['id']}",
        json={"name": "Mara Vale Prime"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["slug"] == "mara-vale"

    references = client.get(f"/api/projects/{project['id']}/story/references", params={"scene_id": scene["id"]})
    assert references.status_code == 200
    assert references.json()[0]["target_slug"] == "mara-vale"

    story = client.get(f"/api/projects/{project['id']}/story")
    assert story.status_code == 200
    assert story.json()["orphan_references"] == []


def test_story_slugs_are_project_unique(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    project = client.post("/api/projects", json={"name": "Atlas Archive"}).json()
    tome_a = client.post(f"/api/projects/{project['id']}/story/tomes", json={"title": "Tome A"}).json()
    tome_b = client.post(f"/api/projects/{project['id']}/story/tomes", json={"title": "Tome B"}).json()

    chapter_a = client.post(
        f"/api/projects/{project['id']}/story/chapters",
        json={"tome_id": tome_a["id"], "title": "Prologue"},
    ).json()
    chapter_b = client.post(
        f"/api/projects/{project['id']}/story/chapters",
        json={"tome_id": tome_b["id"], "title": "Prologue"},
    ).json()

    assert chapter_a["slug"] == "prologue"
    assert chapter_b["slug"] == "prologue-2"

    scene_a = client.post(
        f"/api/projects/{project['id']}/story/scenes",
        json={"tome_id": tome_a["id"], "chapter_id": chapter_a["id"], "title": "Arrival"},
    ).json()
    scene_b = client.post(
        f"/api/projects/{project['id']}/story/scenes",
        json={"tome_id": tome_b["id"], "chapter_id": chapter_b["id"], "title": "Arrival"},
    ).json()

    assert scene_a["slug"] == "arrival"
    assert scene_b["slug"] == "arrival-2"


def test_asset_import_and_usage_links(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    project = client.post("/api/projects", json={"name": "Media House"}).json()
    character = client.post(
        f"/api/projects/{project['id']}/characters",
        json={"name": "Sera Loom", "narrative_role": "lead"},
    ).json()

    source_file = tmp_path / "reference.png"
    source_file.write_bytes(b"fake-image-bytes")

    imported = client.post(
        f"/api/projects/{project['id']}/assets/import",
        json={
            "source_path": str(source_file),
            "name": "Reference Plate",
            "slug": "reference-plate",
            "description": "Primary visual reference.",
            "tags_json": ["reference", "image"],
            "mime_type": "image/png",
        },
    )
    assert imported.status_code == 201
    asset = imported.json()
    assert asset["slug"] == "reference-plate"
    assert asset["status"] == "active"

    asset_file = Path(asset["storage_path"])
    assert asset_file.exists()

    listed = client.get(f"/api/projects/{project['id']}/assets")
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1

    detail = client.get(f"/api/projects/{project['id']}/assets/{asset['id']}")
    assert detail.status_code == 200
    assert detail.json()["links"] == []

    link = client.post(
        f"/api/projects/{project['id']}/assets/{asset['id']}/links",
        json={
            "asset_id": asset["id"],
            "target_kind": "character",
            "target_id": character["id"],
            "note": "Palette source for the lead character.",
        },
    )
    assert link.status_code == 201

    missing_target = client.post(
        f"/api/projects/{project['id']}/assets/{asset['id']}/links",
        json={
            "asset_id": asset["id"],
            "target_kind": "scene",
            "target_id": "missing-scene-id",
            "note": "Invalid reference should be rejected.",
        },
    )
    assert missing_target.status_code == 404

    detail_with_link = client.get(f"/api/projects/{project['id']}/assets/{asset['id']}")
    assert detail_with_link.status_code == 200
    assert len(detail_with_link.json()["links"]) == 1

    archived = client.post(f"/api/projects/{project['id']}/assets/{asset['id']}/archive")
    assert archived.status_code == 200
    assert archived.json()["status"] == "archived"

    deleted_link = client.delete(f"/api/projects/{project['id']}/assets/{asset['id']}/links/{link.json()['id']}")
    assert deleted_link.status_code == 204

    deleted = client.delete(f"/api/projects/{project['id']}/assets/{asset['id']}")
    assert deleted.status_code == 204
    assert not asset_file.exists()


def test_versioning_checkpoints_compare_and_restore(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    project = client.post("/api/projects", json={"name": "Signal Archive", "status": "draft"}).json()
    project_id = project["id"]

    first_character = client.post(
        f"/api/projects/{project_id}/characters",
        json={"name": "Mina Vale", "narrative_role": "lead"},
    ).json()
    assert first_character["slug"] == "mina-vale"

    version_one = client.post(
        f"/api/projects/{project_id}/versions",
        json={"branch_name": "main", "label": "Initial draft", "summary": "First capture"},
    )
    assert version_one.status_code == 201
    v1 = version_one.json()
    assert v1["version_index"] == 1

    client.patch(
        f"/api/projects/{project_id}",
        json={"name": "Signal Archive Revised", "status": "active"},
    )

    second_character = client.post(
        f"/api/projects/{project_id}/characters",
        json={"name": "Orin Gale", "narrative_role": "supporting"},
    ).json()
    assert second_character["slug"] == "orin-gale"

    tome = client.post(
        f"/api/projects/{project_id}/story/tomes",
        json={"title": "Volume One"},
    ).json()
    assert tome["slug"] == "volume-one"

    version_two = client.post(
        f"/api/projects/{project_id}/versions",
        json={"branch_name": "main", "label": "Revision one", "summary": "Added a second lead and a tome"},
    )
    assert version_two.status_code == 201
    v2 = version_two.json()
    assert v2["version_index"] == 2

    client.patch(f"/api/projects/{project_id}", json={"status": "maintenance"})
    client.post(f"/api/projects/{project_id}/story/chapters", json={"tome_id": tome["id"], "title": "Opening"})

    version_three = client.post(
        f"/api/projects/{project_id}/versions",
        json={"branch_name": "main", "label": "Working copy", "summary": "Temporary maintenance branch state"},
    )
    assert version_three.status_code == 201
    v3 = version_three.json()
    assert v3["version_index"] == 3

    comparison = client.post(
        f"/api/projects/{project_id}/versions/compare",
        json={"left_version_id": v1["id"], "right_version_id": v2["id"]},
    )
    assert comparison.status_code == 200
    compare_payload = comparison.json()
    assert "project.name" in compare_payload["project_changes"]
    assert "project.status" in compare_payload["project_changes"]
    assert compare_payload["counts_delta"]["characters"] == 1
    assert compare_payload["counts_delta"]["tomes"] == 1
    assert compare_payload["counts_delta"]["relations"] == 0
    assert compare_payload["counts_delta"]["story_references"] == 0

    client.patch(f"/api/projects/{project_id}", json={"name": "Signal Archive Final"})

    version_four = client.post(
        f"/api/projects/{project_id}/versions",
        json={"branch_name": "main", "label": "Pre-restore", "summary": "Later project state"},
    )
    assert version_four.status_code == 201
    assert version_four.json()["version_index"] == 4

    restore = client.post(
        f"/api/projects/{project_id}/versions/{v2['id']}/restore",
        json={"label": "Restored from revision one", "summary": "Checkpoint after rollback"},
    )
    assert restore.status_code == 201
    restored = restore.json()
    assert restored["version_index"] == 5
    assert restored["label"] == "Restored from revision one"

    project_after_restore = client.get(f"/api/projects/{project_id}")
    assert project_after_restore.status_code == 200
    assert project_after_restore.json()["name"] == "Signal Archive Revised"
    assert project_after_restore.json()["status"] == "active"

    story_after_restore = client.get(f"/api/projects/{project_id}/story")
    assert story_after_restore.status_code == 200
    assert len(story_after_restore.json()["tomes"]) == 1
    assert len(story_after_restore.json()["chapters"]) == 0

    versions_after_restore = client.get(f"/api/projects/{project_id}/versions")
    assert versions_after_restore.status_code == 200
    assert [item["version_index"] for item in versions_after_restore.json()] == [5, 4, 3]

    branches_after_restore = client.get(f"/api/projects/{project_id}/versions/branches")
    assert branches_after_restore.status_code == 200
    assert branches_after_restore.json() == [
        {
            "branch_name": "main",
            "version_count": 3,
            "latest_version_id": restored["id"],
            "latest_created_at": restored["created_at"],
        }
    ]


def test_warning_generation_update_and_rebuild(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    project = client.post(
        "/api/projects",
        json={"name": "Continuity Desk", "settings_json": {"locations_json": ["Dockside"]}},
    ).json()
    project_id = project["id"]

    tome = client.post(f"/api/projects/{project_id}/story/tomes", json={"title": "Book One"}).json()
    chapter = client.post(
        f"/api/projects/{project_id}/story/chapters",
        json={"tome_id": tome["id"], "title": "Opening", "order_index": 1},
    ).json()

    client.post(
        f"/api/projects/{project_id}/story/scenes",
        json={
            "tome_id": tome["id"],
            "chapter_id": chapter["id"],
            "title": "Fault Line",
            "location": "Unknown Quarter",
            "characters_json": ["Ghost"],
            "content": "An echo of @character:ghost crosses the stage.",
            "order_index": 1,
        },
    )

    client.post(
        f"/api/projects/{project_id}/story/chapters",
        json={"tome_id": tome["id"], "title": "Second Opening", "order_index": 1},
    )

    warnings = client.get(f"/api/projects/{project_id}/warnings")
    assert warnings.status_code == 200
    warning_items = warnings.json()
    kinds = {item["kind"] for item in warning_items}
    assert kinds == {
        "missing_character_reference",
        "invalid_location",
        "timeline_incoherence",
        "orphan_reference",
    }

    missing_warning = next(item for item in warning_items if item["kind"] == "missing_character_reference")
    updated = client.patch(
        f"/api/projects/{project_id}/warnings/{missing_warning['id']}",
        json={"status": "resolved", "note": "Added the character after drafting the scene."},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "resolved"
    assert updated.json()["metadata_json"]["note"] == "Added the character after drafting the scene."

    created_character = client.post(
        f"/api/projects/{project_id}/characters",
        json={"name": "Ghost", "narrative_role": "cameo"},
    )
    assert created_character.status_code == 201
    assert created_character.json()["slug"] == "ghost"

    open_warnings = client.get(f"/api/projects/{project_id}/warnings", params={"status": "open"})
    assert open_warnings.status_code == 200
    assert {item["kind"] for item in open_warnings.json()} == {"invalid_location", "timeline_incoherence"}

    all_warnings = client.get(f"/api/projects/{project_id}/warnings")
    assert all_warnings.status_code == 200
    statuses = {item["kind"]: item["status"] for item in all_warnings.json()}
    assert statuses["missing_character_reference"] == "resolved"
    assert statuses["orphan_reference"] == "resolved"

    patched_project = client.patch(
        f"/api/projects/{project_id}",
        json={"settings_json": {"locations_json": ["Dockside", "Unknown Quarter"]}},
    )
    assert patched_project.status_code == 200

    rescanned = client.post(f"/api/projects/{project_id}/warnings/scan")
    assert rescanned.status_code == 200
    rescanned_items = rescanned.json()["items"]
    assert {item["kind"] for item in rescanned_items if item["status"] == "open"} == {"timeline_incoherence"}


def test_export_workflow_generates_artifacts(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    project = client.post(
        "/api/projects",
        json={"name": "Export House", "settings_json": {"locations_json": ["Studio"]}},
    ).json()
    project_id = project["id"]

    character = client.post(f"/api/projects/{project_id}/characters", json={"name": "Ari Vale", "narrative_role": "lead"}).json()
    tome = client.post(f"/api/projects/{project_id}/story/tomes", json={"title": "Tome One"}).json()
    chapter = client.post(
        f"/api/projects/{project_id}/story/chapters",
        json={"tome_id": tome["id"], "title": "Opening"},
    ).json()
    client.post(
        f"/api/projects/{project_id}/story/scenes",
        json={
            "tome_id": tome["id"],
            "chapter_id": chapter["id"],
            "title": "Scene One",
            "content": f"Introduce {character['slug']} and @character:{character['slug']}.",
        },
    )

    json_export = client.post(
        f"/api/projects/{project_id}/exports",
        json={"kind": "work", "format": "json", "label": "Working JSON", "summary": "Full snapshot"},
    )
    assert json_export.status_code == 201
    json_payload = json_export.json()
    assert json_payload["status"] == "ready"
    assert json_payload["artifact_name"].endswith(".json")

    json_download = client.get(f"/api/projects/{project_id}/exports/{json_payload['id']}/download")
    assert json_download.status_code == 200
    assert json_download.headers["content-type"].startswith("application/json")
    assert json_download.json()["manifest"]["collections"]["characters"] == 1

    tree_export = client.post(
        f"/api/projects/{project_id}/exports",
        json={"kind": "publication", "format": "tree", "label": "Publication Tree", "summary": "Directory export"},
    )
    assert tree_export.status_code == 201
    tree_payload = tree_export.json()
    assert tree_payload["status"] == "ready"
    assert tree_payload["artifact_path"].endswith("tree")

    tree_download = client.get(f"/api/projects/{project_id}/exports/{tree_payload['id']}/download")
    assert tree_download.status_code == 200
    assert tree_download.headers["content-type"] == "application/zip"

    zip_export = client.post(
        f"/api/projects/{project_id}/exports",
        json={"kind": "publication", "format": "zip", "label": "Publication Zip", "summary": "Portable package"},
    )
    assert zip_export.status_code == 201
    zip_payload = zip_export.json()
    assert zip_payload["status"] == "ready"
    assert zip_payload["artifact_name"].endswith(".zip")

    exports = client.get(f"/api/projects/{project_id}/exports")
    assert exports.status_code == 200
    assert len(exports.json()) == 3

    publication_exports = client.get(f"/api/projects/{project_id}/exports", params={"kind": "publication"})
    assert publication_exports.status_code == 200
    assert len(publication_exports.json()) == 2

    zip_download = client.get(f"/api/projects/{project_id}/exports/{zip_payload['id']}/download")
    assert zip_download.status_code == 200
    assert zip_download.headers["content-type"] == "application/zip"


def test_generation_studio_creates_board_and_panels(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    monkeypatch.setenv("KUTI_GPT_IMAGES_2_BASE_URL", "https://example.invalid/images")
    monkeypatch.setenv("KUTI_GPT_IMAGES_2_API_KEY", "test-key")
    monkeypatch.setattr(generation_providers, "urlopen", _fake_gpt_images_2_urlopen)
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    models = client.get("/api/models")
    assert models.status_code == 200
    image_models = [item for item in models.json() if item["kind"] == "image"]
    assert any(item["key"] == "gpt_images_2" and item["configured"] for item in image_models)

    project = client.post(
        "/api/projects",
        json={"name": "Generation House", "settings_json": {"locations_json": ["Studio"]}},
    ).json()
    project_id = project["id"]

    tome = client.post(f"/api/projects/{project_id}/story/tomes", json={"title": "Tome One"}).json()
    chapter = client.post(
        f"/api/projects/{project_id}/story/chapters",
        json={"tome_id": tome["id"], "title": "Opening"},
    ).json()
    scene = client.post(
        f"/api/projects/{project_id}/story/scenes",
        json={
            "tome_id": tome["id"],
            "chapter_id": chapter["id"],
            "title": "Scene One",
            "content": "Ari arrives at the studio.",
        },
    ).json()

    version = client.post(
        f"/api/projects/{project_id}/versions",
        json={"branch_name": "main", "label": "Source checkpoint", "summary": "Capture before generation"},
    ).json()

    job_response = client.post(
        f"/api/projects/{project_id}/generation/jobs",
        json={
            "source_kind": "scene",
            "source_id": scene["id"],
            "source_version_id": version["id"],
            "strategy": "intermediate",
            "model_key": "gpt_images_2",
            "title": "Scene board",
            "summary": "Build a board from the opening scene.",
        },
    )
    assert job_response.status_code == 201
    job = job_response.json()
    assert job["status"] == "ready"
    assert job["progress"] == 100
    assert job["model_key"] == "gpt_images_2"
    assert job["model_name"] == "GPT Images 2"
    assert all(panel["image_name"].endswith(".png") for panel in job["board"]["panels"])
    assert len(job["steps"]) >= 1
    assert job["board"]["panels"]

    jobs = client.get(f"/api/projects/{project_id}/generation/jobs")
    assert jobs.status_code == 200
    assert len(jobs.json()) == 1

    board_id = job["board"]["id"]
    panel_id = job["board"]["panels"][0]["id"]

    board = client.get(f"/api/projects/{project_id}/generation/boards/{board_id}")
    assert board.status_code == 200
    assert board.json()["status"] == "draft"

    download = client.get(f"/api/projects/{project_id}/generation/boards/{board_id}/download")
    assert download.status_code == 200
    assert download.headers["content-type"] == "application/json"

    image = client.get(f"/api/projects/{project_id}/generation/boards/{board_id}/panels/{panel_id}/image")
    assert image.status_code == 200
    assert image.headers["content-type"].startswith("image/png")

    panel_update = client.patch(
        f"/api/projects/{project_id}/generation/boards/{board_id}/panels/{panel_id}",
        json={"status": "selected", "caption": "Chosen panel"},
    )
    assert panel_update.status_code == 200
    assert panel_update.json()["status"] == "selected"

    validated = client.post(
        f"/api/projects/{project_id}/generation/boards/{board_id}/validate",
        json={"note": "Approved for local review."},
    )
    assert validated.status_code == 200
    assert validated.json()["status"] == "validated"

    refreshed_job = client.get(f"/api/projects/{project_id}/generation/jobs/{job['id']}")
    assert refreshed_job.status_code == 200
    assert refreshed_job.json()["board"]["status"] == "validated"


def test_generation_studio_uses_sora_2_with_source_image(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    monkeypatch.setenv("KUTI_SORA_2_BASE_URL", "https://example.invalid/sora")
    monkeypatch.setenv("KUTI_SORA_2_API_KEY", "test-key")
    monkeypatch.setattr(generation_providers, "urlopen", _fake_sora_2_urlopen)
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    project = client.post(
        "/api/projects",
        json={"name": "Sora House", "settings_json": {"locations_json": ["Studio"]}},
    ).json()
    project_id = project["id"]

    tome = client.post(f"/api/projects/{project_id}/story/tomes", json={"title": "Tome One"}).json()
    chapter = client.post(
        f"/api/projects/{project_id}/story/chapters",
        json={"tome_id": tome["id"], "title": "Opening"},
    ).json()
    scene = client.post(
        f"/api/projects/{project_id}/story/scenes",
        json={
            "tome_id": tome["id"],
            "chapter_id": chapter["id"],
            "title": "Scene One",
            "location": "Studio",
            "summary": "Ari tests the lighting.",
            "content": "Ari enters the studio and studies the cabinet.",
        },
    ).json()

    response = client.post(
        f"/api/projects/{project_id}/generation/jobs",
        json={
            "source_kind": "scene",
            "source_id": scene["id"],
            "strategy": "direct",
            "model_key": "sora_2",
        },
    )

    assert response.status_code == 201
    job = response.json()
    assert job["model_key"] == "sora_2"
    assert job["model_name"] == "Sora 2"
    assert all(panel["image_name"].endswith(".png") for panel in job["board"]["panels"])

    image = client.get(f"/api/projects/{project_id}/generation/boards/{job['board']['id']}/panels/{job['board']['panels'][0]['id']}/image")
    assert image.status_code == 200
    assert image.headers["content-type"].startswith("image/png")


def test_generation_studio_uses_seedance_2(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    monkeypatch.setenv("KUTI_SEEDANCE_2_BASE_URL", "https://example.invalid/seedance")
    monkeypatch.setenv("KUTI_SEEDANCE_2_API_KEY", "test-key")
    monkeypatch.setattr(generation_providers, "urlopen", _fake_seedance_2_urlopen)
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    project = client.post(
        "/api/projects",
        json={"name": "Seedance House", "settings_json": {"locations_json": ["Studio"]}},
    ).json()
    project_id = project["id"]

    tome = client.post(f"/api/projects/{project_id}/story/tomes", json={"title": "Tome One"}).json()
    chapter = client.post(
        f"/api/projects/{project_id}/story/chapters",
        json={"tome_id": tome["id"], "title": "Opening"},
    ).json()
    scene = client.post(
        f"/api/projects/{project_id}/story/scenes",
        json={
            "tome_id": tome["id"],
            "chapter_id": chapter["id"],
            "title": "Scene One",
            "location": "Studio",
            "summary": "Ari tests the lighting.",
            "content": "Ari enters the studio and studies the cabinet.",
        },
    ).json()

    response = client.post(
        f"/api/projects/{project_id}/generation/jobs",
        json={
            "source_kind": "scene",
            "source_id": scene["id"],
            "strategy": "direct",
            "model_key": "seedance_2",
        },
    )

    assert response.status_code == 201
    job = response.json()
    assert job["model_key"] == "seedance_2"
    assert job["model_name"] == "Seedance 2"
    assert all(panel["image_name"].endswith(".mp4") for panel in job["board"]["panels"])

    image = client.get(f"/api/projects/{project_id}/generation/boards/{job['board']['id']}/panels/{job['board']['panels'][0]['id']}/image")
    assert image.status_code == 200
    assert image.headers["content-type"].startswith("video/mp4")


def test_generation_studio_supports_panel_follow_up(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    monkeypatch.setenv("KUTI_GPT_IMAGES_2_BASE_URL", "https://example.invalid/images")
    monkeypatch.setenv("KUTI_GPT_IMAGES_2_API_KEY", "test-key")
    monkeypatch.setenv("KUTI_SORA_2_BASE_URL", "https://example.invalid/sora")
    monkeypatch.setenv("KUTI_SORA_2_API_KEY", "test-key")
    monkeypatch.setattr(generation_providers, "urlopen", _fake_generation_followup_urlopen)
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    project = client.post(
        "/api/projects",
        json={"name": "Panel Follow-up House", "settings_json": {"locations_json": ["Studio"]}},
    ).json()
    project_id = project["id"]

    tome = client.post(f"/api/projects/{project_id}/story/tomes", json={"title": "Tome One"}).json()
    chapter = client.post(
        f"/api/projects/{project_id}/story/chapters",
        json={"tome_id": tome["id"], "title": "Opening"},
    ).json()
    scene = client.post(
        f"/api/projects/{project_id}/story/scenes",
        json={"tome_id": tome["id"], "chapter_id": chapter["id"], "title": "Scene One", "summary": "Ari enters the studio."},
    ).json()

    initial = client.post(
        f"/api/projects/{project_id}/generation/jobs",
        json={
            "source_kind": "scene",
            "source_id": scene["id"],
            "strategy": "direct",
            "model_key": "gpt_images_2",
        },
    )
    assert initial.status_code == 201
    board_id = initial.json()["board"]["id"]
    panel_id = initial.json()["board"]["panels"][0]["id"]

    follow_up = client.post(
        f"/api/projects/{project_id}/generation/jobs",
        json={
            "source_kind": "panel",
            "source_id": panel_id,
            "strategy": "direct",
            "model_key": "sora_2",
        },
    )

    assert follow_up.status_code == 201
    job = follow_up.json()
    assert job["source_kind"] == "panel"
    assert job["metadata_json"]["source"]["kind"] == "panel"
    assert job["metadata_json"]["source_panel"]["board_id"] == board_id
    assert job["board"]["panels"][0]["image_name"].endswith(".png")


def test_generation_studio_propagates_provider_failure(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    monkeypatch.setenv("KUTI_GPT_IMAGES_2_BASE_URL", "https://example.invalid/images")
    monkeypatch.setenv("KUTI_GPT_IMAGES_2_API_KEY", "test-key")
    monkeypatch.setattr(generation_providers, "urlopen", _failing_gpt_images_2_urlopen)
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    project = client.post(
        "/api/projects",
        json={"name": "Generation House", "settings_json": {"locations_json": ["Studio"]}},
    ).json()
    project_id = project["id"]

    tome = client.post(f"/api/projects/{project_id}/story/tomes", json={"title": "Tome One"}).json()
    chapter = client.post(
        f"/api/projects/{project_id}/story/chapters",
        json={"tome_id": tome["id"], "title": "Opening"},
    ).json()
    scene = client.post(
        f"/api/projects/{project_id}/story/scenes",
        json={
            "tome_id": tome["id"],
            "chapter_id": chapter["id"],
            "title": "Scene One",
            "content": "Ari arrives at the studio.",
        },
    ).json()

    response = client.post(
        f"/api/projects/{project_id}/generation/jobs",
        json={
            "source_kind": "scene",
            "source_id": scene["id"],
            "strategy": "direct",
            "model_key": "gpt_images_2",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "generation_provider_failed"


def test_generation_job_requires_configured_image_model(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    for key in (
        "KUTI_SORA_2_BASE_URL",
        "KUTI_SORA_2_API_KEY",
        "KUTI_SEEDANCE_2_BASE_URL",
        "KUTI_SEEDANCE_2_API_KEY",
        "KUTI_GPT_IMAGES_1_5_BASE_URL",
        "KUTI_GPT_IMAGES_1_5_API_KEY",
        "KUTI_GPT_IMAGES_2_BASE_URL",
        "KUTI_GPT_IMAGES_2_API_KEY",
        "KUTI_ELEVEN_LABS_BASE_URL",
        "KUTI_ELEVEN_LABS_API_KEY",
    ):
        monkeypatch.setenv(key, "")
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    models = client.get("/api/models")
    assert models.status_code == 200
    image_models = [item for item in models.json() if item["kind"] == "image"]
    assert image_models
    assert all(not item["configured"] for item in image_models)

    project = client.post(
        "/api/projects",
        json={"name": "Generation House", "settings_json": {"locations_json": ["Studio"]}},
    ).json()
    project_id = project["id"]

    tome = client.post(f"/api/projects/{project_id}/story/tomes", json={"title": "Tome One"}).json()
    chapter = client.post(
        f"/api/projects/{project_id}/story/chapters",
        json={"tome_id": tome["id"], "title": "Opening"},
    ).json()
    scene = client.post(
        f"/api/projects/{project_id}/story/scenes",
        json={
            "tome_id": tome["id"],
            "chapter_id": chapter["id"],
            "title": "Scene One",
            "content": "Ari arrives at the studio.",
        },
    ).json()

    response = client.post(
        f"/api/projects/{project_id}/generation/jobs",
        json={
            "source_kind": "scene",
            "source_id": scene["id"],
            "strategy": "direct",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "model_not_configured"


def test_generation_studio_supports_chapter_and_tome_grid_planches(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    monkeypatch.setenv("KUTI_GPT_IMAGES_2_BASE_URL", "https://example.invalid/images")
    monkeypatch.setenv("KUTI_GPT_IMAGES_2_API_KEY", "test-key")
    monkeypatch.setattr(generation_providers, "urlopen", _fake_gpt_images_2_urlopen)
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    project = client.post(
        "/api/projects",
        json={"name": "Grid House", "settings_json": {"locations_json": ["Studio"]}},
    ).json()
    project_id = project["id"]

    tome = client.post(f"/api/projects/{project_id}/story/tomes", json={"title": "Tome One"}).json()
    chapter = client.post(
        f"/api/projects/{project_id}/story/chapters",
        json={"tome_id": tome["id"], "title": "Opening"},
    ).json()
    scene_one = client.post(
        f"/api/projects/{project_id}/story/scenes",
        json={"tome_id": tome["id"], "chapter_id": chapter["id"], "title": "Scene One", "summary": "One"},
    ).json()
    scene_two = client.post(
        f"/api/projects/{project_id}/story/scenes",
        json={"tome_id": tome["id"], "chapter_id": chapter["id"], "title": "Scene Two", "summary": "Two"},
    ).json()

    chapter_response = client.post(
        f"/api/projects/{project_id}/generation/jobs",
        json={
            "source_kind": "chapter",
            "source_id": chapter["id"],
            "strategy": "direct",
            "model_key": "gpt_images_2",
            "mode": "grid",
            "selection_ids": [scene_one["id"], scene_two["id"]],
            "grid_rows": 1,
            "grid_cols": 2,
        },
    )
    assert chapter_response.status_code == 201
    chapter_job = chapter_response.json()
    assert chapter_job["metadata_json"]["mode"] == "grid"
    assert chapter_job["metadata_json"]["selection_ids"] == [scene_one["id"], scene_two["id"]]
    assert chapter_job["board"]["panels"][0]["image_name"].endswith(".svg")

    tome_response = client.post(
        f"/api/projects/{project_id}/generation/jobs",
        json={
            "source_kind": "tome",
            "source_id": tome["id"],
            "strategy": "intermediate",
            "model_key": "gpt_images_2",
            "mode": "grid",
            "selection_ids": [chapter["id"]],
            "grid_rows": 2,
            "grid_cols": 1,
        },
    )
    assert tome_response.status_code == 201
    tome_job = tome_response.json()
    assert tome_job["metadata_json"]["mode"] == "grid"
    assert tome_job["metadata_json"]["selection_ids"] == [chapter["id"]]
    assert tome_job["board"]["panels"][0]["image_name"].endswith(".svg")


def test_character_routes_require_existing_project(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("KUTI_DATA_DIR", str(tmp_path / "kuti-data"))
    get_settings.cache_clear()
    app = create_app(Settings(data_dir=tmp_path / "kuti-data", environment="test"))
    client = TestClient(app)

    response = client.get("/api/projects/missing/characters")
    assert response.status_code == 404
