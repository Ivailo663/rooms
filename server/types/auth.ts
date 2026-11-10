import type { DecodedIdToken } from "firebase-admin/auth";

export interface AuthenticatedLocals {
  user: DecodedIdToken;
}

