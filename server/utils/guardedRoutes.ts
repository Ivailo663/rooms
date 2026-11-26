import type { Application, RequestHandler } from "express";
import { Role, type AccountRole } from "../../packages/shared/index.js";
import { getCurrentAccount } from "../currentAccount.js";
import { assertRole } from "../tenantAccess.js";
import { asyncHandler, createHttpError } from "./http.js";
import type { AuthenticatedLocals } from "../types/auth.js";

// ROLE-06/15: refuses a caller below `minimum` before the handler runs, so the
// role answer always comes before any ownership or existence answer. Being
// signed in is all `player` asks for, so it costs no account lookup.
export const requireRole = (minimum: AccountRole): RequestHandler =>
  asyncHandler(async (_req, res, next) => {
    const { user } = res.locals as Partial<AuthenticatedLocals>;

    // Only reachable if a route's prefix is missing from AUTHENTICATED_PATHS.
    if (!user) {
      throw createHttpError(401, "No token");
    }

    if (minimum !== Role.player) {
      assertRole(await getCurrentAccount(user.uid), minimum);
    }

    next();
  });

type GuardedRoute = (
  path: string,
  minimumRoleAccess: AccountRole,
  handler: RequestHandler,
) => void;

// ROLE-15: the only way a route file registers an endpoint. The role is a
// required argument, so an endpoint without one doesn't compile, and the
// ROLE-15 test in routes/ refuses a direct app.get/post/... call.
export const createGuardedRoutes = (
  app: Application,
): Record<"get" | "post" | "put" | "patch" | "delete", GuardedRoute> => ({
  get: (path, minimumRoleAccess, handler) =>
    app.get(path, requireRole(minimumRoleAccess), handler),
  post: (path, minimumRoleAccess, handler) =>
    app.post(path, requireRole(minimumRoleAccess), handler),
  put: (path, minimumRoleAccess, handler) =>
    app.put(path, requireRole(minimumRoleAccess), handler),
  patch: (path, minimumRoleAccess, handler) =>
    app.patch(path, requireRole(minimumRoleAccess), handler),
  delete: (path, minimumRoleAccess, handler) =>
    app.delete(path, requireRole(minimumRoleAccess), handler),
});
