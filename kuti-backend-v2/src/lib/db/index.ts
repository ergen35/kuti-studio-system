import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const db = new PrismaClient({
  adapter,
  errorFormat: "pretty",
});

// Alias pour compatibilité avec le reste du code
export const prisma = db;
