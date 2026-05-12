import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("./routes/hub.tsx"),
  route("projects/:projectId", "./routes/project.tsx", [
    index("./routes/project.dashboard.tsx"),
    route("characters", "./routes/project.characters.tsx"),
    route("story", "./routes/project.story.tsx"),
    route("generation", "./routes/project.generation.tsx"),
    route("assets", "./routes/project.assets.tsx"),
    route("exports", "./routes/project.exports.tsx"),
    route("warnings", "./routes/project.warnings.tsx"),
    route("versions", "./routes/project.versions.tsx"),
    route("settings", "./routes/project.settings.tsx"),
  ]),
] satisfies RouteConfig;
