import type { NextFunction, Request, Response } from "express";
import admin from "../firebase.js";
import { asyncHandler, createHttpError } from "../utils/http.js";
import type { AuthenticatedLocals } from "../types/auth.js";

// Every API prefix. Socket.IO's transport requests must stay outside this list.
export const AUTHENTICATED_PATHS = [
  "/rooms",
  "/timeslots",
  "/user",
  "/accounts",
  "/tenants",
];

// Plain express types in the signature: before this runs, `res.locals.user` is
// precisely what doesn't exist yet, so a Response typed as already carrying it
// is a claim that isn't true at this point — and that mismatch is what made the
// handler unassignable to RequestHandler. The assertion on the write is where
// the invariant every authenticated route then relies on is established.
export const verifyFirebaseToken = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw createHttpError(401, "No token");
    }

    const token = authHeader.slice("Bearer ".length);
    const locals = res.locals as AuthenticatedLocals;
    locals.user = await admin.auth().verifyIdToken(token);
    next();
  }
);
