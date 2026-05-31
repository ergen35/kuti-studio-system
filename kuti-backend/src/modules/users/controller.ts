import { db } from "@lib/db";
import type { UserResponse } from "./dto";

function serializeUser(user: { id: string; email: string; name: string | null; role: string | null }): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "admin" || user.role === "viewer" ? user.role : "member",
  };
}

export async function listUsers(query: { page: number; limit: number; search?: string }) {
  const { page, limit, search } = query;
  
  const skip = (page - 1) * limit;
  
  const users = await db.user.findMany({
    skip,
    take: limit,
    where: search ? {
      OR: [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ],
    } : undefined,
    orderBy: { createdAt: "desc" },
  });
  
  const total = await db.user.count({
    where: search ? {
      OR: [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ],
    } : undefined,
  });
  
  return {
    users: users.map(serializeUser),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function updateUser(id: string, body: { name?: string; role?: string }) {
  const user = await db.user.update({
    where: { id },
    data: body,
  });
  
  return serializeUser(user);
}
