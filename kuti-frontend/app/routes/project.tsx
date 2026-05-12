import { Outlet } from "react-router";

export async function clientLoader() {
  return null;
}

clientLoader.hydrate = true as const;

export default function ProjectLayout() {
  return <Outlet />;
}
