import { cors } from "@elysiajs/cors";
import { auth } from "@lib/auth";
import { Elysia } from "elysia";

type AccessControlParams = {
  roles?: string[];
  permissions?: string[];
};

export const authModule = new Elysia({ name: "authModule" })
  .use(
    cors({
      origin: String(process.env.TRUSTED_ORIGINS || "").split(","),
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "DELETE", "HEAD"],
    }),
  )
  .mount(auth.handler);

export const authProvider = new Elysia({ name: "authProvider" }).macro("accessControl", (acp: AccessControlParams) => ({
  async resolve({ status, request: { headers } }) {
    const session = await auth.api.getSession({ headers });

    if (!session) {
      return status("Unauthorized");
    }

    const role = session.user.role ?? "";

    if (acp.roles && !acp.roles.includes(role)) {
      return status("Forbidden");
    }

    return {
      authData: session,
    };
  },
}));
