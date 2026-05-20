import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "member", "viewer"]);

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().min(1).optional(),
});

export const updateUserBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: userRoleSchema.optional(),
});

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: userRoleSchema,
});

export const listUsersResponseSchema = z.object({
  users: z.array(userResponseSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  totalPages: z.number().int().min(0),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
