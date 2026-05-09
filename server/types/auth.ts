import type { DecodedIdToken } from "firebase-admin/auth";

export interface AuthenticatedLocals {
  user: DecodedIdToken;
}

export type EmptyParams = Record<string, never>;
export type EmptyBody = Record<string, never>;
