import type { NextFunction, Request, Response } from "express";
import prisma from "../prisma.js";
import { asyncHandler, createHttpError } from "../utils/http.js";
import type { AuthenticatedLocals } from "../types/auth.js";

// GET /user and POST /user are how a caller learns it hasn't ticked the box and
// how it ticks it, so they're the only way through. Mounted on the same
// prefixes as verifyFirebaseToken, `baseUrl` is the matched prefix and `path`
// is "/" for the bare route (with or without a trailing slash).
const isTermsRoute = (req: Request): boolean =>
  req.baseUrl.toLowerCase() === "/user" &&
  req.path === "/" &&
  (req.method === "GET" || req.method === "POST");

// AUTH-25: one gate in front of every authenticated route, rather than a check
// per handler that a new route could forget. A caller with no account at all
// is refused the same way, so the answer never says which of the two it is.
export const requireTermsAccepted = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (isTermsRoute(req)) {
      next();
      return;
    }

    const { uid } = (res.locals as AuthenticatedLocals).user;
    const account = await prisma.account.findUnique({
      where: { firebase_uid: uid },
      select: { terms_accepted_at: true },
    });

    if (!account?.terms_accepted_at) {
      throw createHttpError(403, "Tick the box to continue");
    }

    next();
  }
);
