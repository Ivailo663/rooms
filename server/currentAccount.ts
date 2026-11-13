import prisma from "./prisma.js";
import { createHttpError } from "./utils/http.js";

// The caller's account, found by the uid in their verified token (AUTH-01).
// One fixed select covers every route: `role` for assertRole, `name` for the
// join-request event.
export const getCurrentAccount = async (uid: string) => {
  const account = await prisma.account.findUnique({
    where: { firebase_uid: uid },
    select: { id: true, name: true, role: true },
  });

  if (!account) {
    throw createHttpError(404, "Account not found");
  }

  return account;
};
