import type { NextFunction, Request, Response } from "express";
import admin from "../firebase.js";
import { asyncHandler, createHttpError } from "../utils/http.js";
import type {
  AuthenticatedLocals,
  EmptyBody,
  EmptyParams,
} from "../types/auth.js";

type AuthenticatedRequest = Request<
  EmptyParams,
  unknown,
  EmptyBody,
  unknown,
  AuthenticatedLocals
>;

export const verifyFirebaseToken = asyncHandler(
  async (
    req: AuthenticatedRequest,
    res: Response<unknown, AuthenticatedLocals>,
    next: NextFunction
  ) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw createHttpError(401, "No token");
    }

    const token = authHeader.slice("Bearer ".length);
    res.locals.user = await admin.auth().verifyIdToken(token);
    next();
  }
);
