import { Elysia } from "elysia";
import { authProvider } from "@modules/authentication";
import * as UsersController from "./controller";
import {
  listUsersQuerySchema,
  listUsersResponseSchema,
  updateUserBodySchema,
  userResponseSchema,
} from "./dto";

export const usersModule = new Elysia({
  prefix: "/api/v1/users",
  name: "usersModule",
  detail: { tags: ["Users"] },
})
  .use(authProvider)
  .get("/", ({ query }) => UsersController.listUsers(query), {
    accessControl: { roles: ["admin"] },
    query: listUsersQuerySchema,
    response: listUsersResponseSchema,
    detail: {
      operationId: "listUsers",
      summary: "List users",
    },
  })
  .patch("/:id", ({ params, body }) => UsersController.updateUser(params.id, body), {
    accessControl: { roles: ["admin"] },
    body: updateUserBodySchema,
    response: userResponseSchema,
    detail: {
      operationId: "updateUser",
      summary: "Update a user",
    },
  });
