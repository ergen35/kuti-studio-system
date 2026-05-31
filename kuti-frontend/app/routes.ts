import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("projects/:projectId", "routes/project.tsx"),
  route("projects/:projectId/characters", "routes/characters.tsx"),
  route("projects/:projectId/characters/:characterId", "routes/character.tsx"),
  route("projects/:projectId/story", "routes/story.tsx"),
  route("projects/:projectId/story/:tomeId", "routes/tome.tsx"),
  route("projects/:projectId/story/:tomeId/chapters/:chapterId", "routes/chapter.tsx"),
  route("projects/:projectId/story/:tomeId/scenes/:sceneId", "routes/scene.tsx"),
  route("projects/:projectId/assets", "routes/assets.tsx"),
  route("projects/:projectId/generation", "routes/generation.tsx"),
  route("projects/:projectId/drama-videos", "routes/drama-videos.tsx"),
  route("projects/:projectId/tasks", "routes/tasks.tsx"),
  route("projects/:projectId/warnings", "routes/warnings.tsx"),
  route("projects/:projectId/versions", "routes/versions.tsx"),
  route("projects/:projectId/exports", "routes/exports.tsx"),
  route("projects/:projectId/settings", "routes/settings.tsx"),
] satisfies RouteConfig;
