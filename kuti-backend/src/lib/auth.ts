import { db } from "@lib/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";

export const auth = betterAuth({
  appName: "Application",
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  plugins: [admin()],
  trustedOrigins: String(process.env.TRUSTED_ORIGINS || "").split(","),
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
});
