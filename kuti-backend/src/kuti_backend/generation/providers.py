from __future__ import annotations

import base64
import binascii
import json
import mimetypes
from time import monotonic, sleep
from dataclasses import asdict, dataclass
from enum import StrEnum
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from kuti_backend.core.settings import Settings


class ModelKind(StrEnum):
    video = "video"
    image = "image"
    audio = "audio"


class ModelKey(StrEnum):
    sora_2 = "sora_2"
    seedance_2 = "seedance_2"
    gpt_images_1_5 = "gpt_images_1_5"
    gpt_images_2 = "gpt_images_2"
    eleven_labs = "eleven_labs"


@dataclass(frozen=True)
class ModelProviderConfig:
    key: str
    kind: ModelKind
    display_name: str
    base_url: str | None
    api_key: str | None
    enabled: bool
    api_model: str | None = None

    @property
    def configured(self) -> bool:
        return self.enabled and bool((self.base_url or "").strip()) and bool((self.api_key or "").strip())

    def public_dict(self) -> dict[str, object]:
        payload = asdict(self)
        payload["kind"] = self.kind.value
        payload.pop("api_key", None)
        payload.pop("api_model", None)
        payload["configured"] = self.configured
        payload["has_api_key"] = bool((self.api_key or "").strip())
        return payload


@dataclass(frozen=True)
class GeneratedImageArtifact:
    content: bytes
    mime_type: str
    file_extension: str


def _data_url(content: bytes, mime_type: str) -> str:
    return f"data:{mime_type};base64,{base64.b64encode(content).decode('ascii')}"


def build_model_catalog(settings: Settings) -> dict[str, ModelProviderConfig]:
    return {
        ModelKey.sora_2.value: ModelProviderConfig(
            key=ModelKey.sora_2.value,
            kind=ModelKind.video,
            display_name="Sora 2",
            base_url=settings.sora_2_base_url,
            api_key=settings.sora_2_api_key,
            enabled=settings.sora_2_enabled,
            api_model="sora-2",
        ),
        ModelKey.seedance_2.value: ModelProviderConfig(
            key=ModelKey.seedance_2.value,
            kind=ModelKind.video,
            display_name="Seedance 2",
            base_url=settings.seedance_2_base_url,
            api_key=settings.seedance_2_api_key,
            enabled=settings.seedance_2_enabled,
            api_model="seedance-2",
        ),
        ModelKey.gpt_images_1_5.value: ModelProviderConfig(
            key=ModelKey.gpt_images_1_5.value,
            kind=ModelKind.image,
            display_name="GPT Images 1.5",
            base_url=settings.gpt_images_1_5_base_url,
            api_key=settings.gpt_images_1_5_api_key,
            enabled=settings.gpt_images_1_5_enabled,
            api_model="gpt-image-1.5",
        ),
        ModelKey.gpt_images_2.value: ModelProviderConfig(
            key=ModelKey.gpt_images_2.value,
            kind=ModelKind.image,
            display_name="GPT Images 2",
            base_url=settings.gpt_images_2_base_url,
            api_key=settings.gpt_images_2_api_key,
            enabled=settings.gpt_images_2_enabled,
            api_model="gpt-image-2",
        ),
        ModelKey.eleven_labs.value: ModelProviderConfig(
            key=ModelKey.eleven_labs.value,
            kind=ModelKind.audio,
            display_name="Eleven Labs",
            base_url=settings.eleven_labs_base_url,
            api_key=settings.eleven_labs_api_key,
            enabled=settings.eleven_labs_enabled,
            api_model="eleven-labs",
        ),
    }


def public_model_catalog(settings: Settings) -> list[dict[str, object]]:
    return [provider.public_dict() for provider in build_model_catalog(settings).values()]


def resolve_model_provider(settings: Settings, model_key: str | None = None, *, kind: ModelKind | None = None) -> ModelProviderConfig:
    catalog = build_model_catalog(settings)
    if model_key:
        provider = catalog.get(model_key)
        if provider is None:
            raise ValueError("model_not_found")
    else:
        if kind is None:
            provider = catalog[ModelKey.gpt_images_2.value]
        else:
            preferred_keys = {
                ModelKind.video: (ModelKey.sora_2.value, ModelKey.seedance_2.value),
                ModelKind.image: (ModelKey.gpt_images_2.value, ModelKey.gpt_images_1_5.value),
                ModelKind.audio: (ModelKey.eleven_labs.value,),
            }[kind]
            provider = next((catalog[key] for key in preferred_keys if key in catalog and catalog[key].kind == kind and catalog[key].configured), None)
            if provider is None:
                raise ValueError("model_not_configured")

    if not provider.enabled:
        raise ValueError("model_disabled")
    if not provider.configured:
        raise ValueError("model_missing_configuration")
    if kind is not None and provider.kind != kind:
        raise ValueError("model_kind_mismatch")
    return provider


def _extract_image_bytes(payload: object, timeout_seconds: float) -> tuple[bytes | None, str | None]:
    if not isinstance(payload, dict):
        return None, None

    direct_values = (
        payload.get("b64_json"),
        payload.get("image_base64"),
        payload.get("video_base64"),
        payload.get("result"),
    )
    for value in direct_values:
        if isinstance(value, str) and value.strip():
            try:
                return base64.b64decode(value, validate=True), _payload_mime_type(payload) or "image/png"
            except binascii.Error:
                pass

    for key in ("data", "output", "response"):
        entries = payload.get(key)
        if not isinstance(entries, list):
            continue
        for entry in entries:
            image_bytes, mime_type = _extract_image_bytes(entry, timeout_seconds)
            if image_bytes is not None:
                return image_bytes, mime_type
            if isinstance(entry, dict):
                url = entry.get("url") or entry.get("image_url")
                if isinstance(url, str) and url.strip():
                    try:
                        with urlopen(url, timeout=timeout_seconds) as image_response:
                            content = image_response.read()
                            mime = image_response.headers.get_content_type() or mimetypes.guess_type(url)[0] or _payload_mime_type(entry) or "image/png"
                            return content, mime
                    except (HTTPError, URLError, OSError):
                        continue

    return None, None


def _source_image_payload(source_image: GeneratedImageArtifact | None) -> dict[str, object] | None:
    if source_image is None:
        return None
    return {
        "type": "input_image",
        "image_url": _data_url(source_image.content, source_image.mime_type),
        "detail": "original",
    }


def _payload_mime_type(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return None
    mime_type = payload.get("mime_type")
    if isinstance(mime_type, str) and mime_type.strip():
        return mime_type
    kind = payload.get("type")
    if kind == "video_generation_call":
        return "video/mp4"
    return None


def _media_url(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return None
    for key in ("video_url", "output_url", "result_url", "url", "image_url"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return None


def generate_media_artifact(
    provider: ModelProviderConfig,
    prompt: str,
    *,
    source_image: GeneratedImageArtifact | None = None,
    size: str = "1024x1536",
    timeout_seconds: float = 120.0,
) -> GeneratedImageArtifact:
    if not provider.configured:
        raise ValueError("model_missing_configuration")

    if provider.key == ModelKey.sora_2.value:
        endpoint = f"{provider.base_url.rstrip('/')}/v1/responses"
        content = [{"type": "input_text", "text": prompt}]
        source_image_payload = _source_image_payload(source_image)
        if source_image_payload is not None:
            content.append(source_image_payload)
        request_payload = {
            "model": provider.api_model or provider.key,
            "input": [
                {
                    "role": "user",
                    "content": content,
                }
            ],
            "tools": [{"type": "image_generation"}],
        }
    elif provider.key == ModelKey.gpt_images_2.value:
        endpoint = f"{provider.base_url.rstrip('/')}/v1/images/generations"
        request_payload = {
            "model": provider.api_model or provider.key,
            "prompt": prompt,
            "size": size,
            "response_format": "b64_json",
            "n": 1,
        }
    elif provider.key == ModelKey.seedance_2.value:
        endpoint = f"{provider.base_url.rstrip('/')}/v1/videos/generations"
        request_payload = {
            "model": provider.api_model or provider.key,
            "prompt": prompt,
            "resolution": "720p",
            "duration": 5,
            "aspect_ratio": "16:9",
        }
        source_image_payload = _source_image_payload(source_image)
        if source_image_payload is not None:
            request_payload["image_url"] = source_image_payload["image_url"]
    else:
        raise ValueError("model_not_implemented")

    request = Request(
        endpoint,
        data=json.dumps(request_payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {provider.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            raw_body = response.read()
            charset = response.headers.get_content_charset() or "utf-8"
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        raise ValueError("generation_provider_failed") from exc

    try:
        payload = json.loads(raw_body.decode(charset))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("generation_provider_invalid_response") from exc

    if provider.key == ModelKey.seedance_2.value:
        task_payload = payload
        if not isinstance(task_payload, dict):
            raise ValueError("generation_provider_invalid_response")

        task_id = None
        for key in ("task_id", "id", "job_id"):
            value = task_payload.get(key)
            if isinstance(value, str) and value.strip():
                task_id = value
                break

        deadline = monotonic() + timeout_seconds
        while True:
            status = task_payload.get("status")
            status_value = status.lower() if isinstance(status, str) else ""

            media_bytes, media_mime_type = _extract_image_bytes(task_payload, timeout_seconds)
            if media_bytes is not None:
                resolved_mime_type = media_mime_type or "video/mp4"
                file_extension = mimetypes.guess_extension(resolved_mime_type, strict=False) or ".mp4"
                return GeneratedImageArtifact(content=media_bytes, mime_type=resolved_mime_type, file_extension=file_extension)

            media_url = _media_url(task_payload)
            if media_url is not None:
                try:
                    with urlopen(media_url, timeout=timeout_seconds) as media_response:
                        content = media_response.read()
                        resolved_mime_type = media_response.headers.get_content_type() or mimetypes.guess_type(media_url)[0] or _payload_mime_type(task_payload) or "video/mp4"
                        file_extension = mimetypes.guess_extension(resolved_mime_type, strict=False) or ".mp4"
                        return GeneratedImageArtifact(content=content, mime_type=resolved_mime_type, file_extension=file_extension)
                except (HTTPError, URLError, TimeoutError, OSError):
                    pass

            if status_value in {"succeeded", "success", "completed", "done"}:
                break
            if status_value in {"failed", "error", "cancelled", "canceled"}:
                raise ValueError("generation_provider_failed")
            if task_id is None or monotonic() >= deadline:
                raise ValueError("generation_provider_failed")

            poll_request = Request(
                f"{provider.base_url.rstrip('/')}/v1/videos/generations/{task_id}",
                headers={
                    "Authorization": f"Bearer {provider.api_key}",
                    "Accept": "application/json",
                },
                method="GET",
            )
            try:
                with urlopen(poll_request, timeout=timeout_seconds) as poll_response:
                    raw_poll_body = poll_response.read()
                    poll_charset = poll_response.headers.get_content_charset() or "utf-8"
            except (HTTPError, URLError, TimeoutError, OSError) as exc:
                raise ValueError("generation_provider_failed") from exc

            try:
                task_payload = json.loads(raw_poll_body.decode(poll_charset))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise ValueError("generation_provider_invalid_response") from exc

            sleep(0.1)

    image_bytes, mime_type = _extract_image_bytes(payload, timeout_seconds)
    if image_bytes is None:
        raise ValueError("generation_provider_invalid_response")

    resolved_mime_type = mime_type or "image/png"
    file_extension = mimetypes.guess_extension(resolved_mime_type, strict=False) or ".png"
    return GeneratedImageArtifact(content=image_bytes, mime_type=resolved_mime_type, file_extension=file_extension)


def generate_image_artifact(
    provider: ModelProviderConfig,
    prompt: str,
    *,
    source_image: GeneratedImageArtifact | None = None,
    size: str = "1024x1536",
    timeout_seconds: float = 120.0,
) -> GeneratedImageArtifact:
    if provider.kind != ModelKind.image:
        raise ValueError("model_kind_mismatch")
    return generate_media_artifact(provider, prompt, source_image=source_image, size=size, timeout_seconds=timeout_seconds)
