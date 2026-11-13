import type { Application, RequestHandler } from "express";
import type { Account } from "@prisma/client";
import prisma from "../prisma.js";
import admin from "../firebase.js";
import { asyncHandler, createHttpError } from "../utils/http.js";
import { parseProfileUpdate } from "../profile.js";
import type { AuthenticatedLocals } from "../types/auth.js";

const NAME_MAX_LENGTH = 50;

const isUniqueViolation = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === "P2002";

const findByUid = (uid: string): Promise<Account | null> =>
  prisma.account.findUnique({ where: { firebase_uid: uid } });

// AUTH-02: an account that predates uids is claimed by the caller whose token
// carries its email, but only a verified one — an unverified address proves
// nothing about who owns it. The write is conditional on the uid still being
// empty, so two different Firebase users can never both claim the same row.
const claimByEmail = async (
  uid: string,
  email: string,
): Promise<Account | null> => {
  const candidate = await prisma.account.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      firebase_uid: null,
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  if (!candidate) {
    return null;
  }

  const { count } = await prisma.account.updateMany({
    where: { id: candidate.id, firebase_uid: null },
    data: { firebase_uid: uid },
  });

  // Lost the race: either this same uid claimed it in a parallel request (the
  // re-read finds it) or another user did (409 below).
  return count === 1
    ? prisma.account.findUnique({ where: { id: candidate.id } })
    : findByUid(uid);
};

// AUTH-23: the first tick is the one recorded. Conditional on the column still
// being empty, so a repeat or parallel POST never moves the timestamp.
const recordTerms = async (account: Account): Promise<Account> => {
  if (account.terms_accepted_at) {
    return account;
  }

  await prisma.account.updateMany({
    where: { id: account.id, terms_accepted_at: null },
    data: { terms_accepted_at: new Date() },
  });
  return (
    (await prisma.account.findUnique({ where: { id: account.id } })) ?? account
  );
};

// ROLE-07, AUTH-01..03, AUTH-11, AUTH-23, PROF-20.
const createUser: RequestHandler = asyncHandler(async (req, res) => {
  const token = (res.locals as AuthenticatedLocals).user;
  const { uid, email } = token;
  const acceptTerms = req.body?.acceptTerms === true;

  const existing = await findByUid(uid);
  if (existing) {
    return res.send(acceptTerms ? await recordTerms(existing) : existing);
  }

  if (email && token.email_verified) {
    const claimed = await claimByEmail(uid, email);
    if (claimed) {
      return res.send(acceptTerms ? await recordTerms(claimed) : claimed);
    }
  }

  if (!acceptTerms) {
    throw createHttpError(400, "Tick the box to continue");
  }

  const tokenName = typeof token.name === "string" ? token.name.trim() : "";
  const name = (tokenName || email?.split("@")[0] || "Player").slice(
    0,
    NAME_MAX_LENGTH,
  );
  const firebaseUser = await admin.auth().getUser(uid);

  try {
    const account = await prisma.account.create({
      data: {
        firebase_uid: uid,
        name,
        email: email ?? null,
        picture_url: token.picture ?? null,
        created_at: new Date(firebaseUser.metadata.creationTime),
        terms_accepted_at: new Date(),
      },
    });
    return res.send(account);
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    // A parallel POST /user for the same uid created it first. Anything else
    // unique here is the email, held by an account this caller can't claim.
    const raced = await findByUid(uid);
    if (raced) {
      return res.send(await recordTerms(raced));
    }
    throw createHttpError(409, "This email already belongs to another account");
  }
});

const getUser: RequestHandler = asyncHandler(async (_req, res) => {
  const { uid } = (res.locals as AuthenticatedLocals).user;
  res.send(await findByUid(uid));
});

// PROF-21..24. The caller can only ever address their own row: the uid comes
// from the verified token, and there is no id in the path to swap.
const updateUser: RequestHandler = asyncHandler(async (req, res) => {
  const { uid } = (res.locals as AuthenticatedLocals).user;
  const data = parseProfileUpdate(req.body);

  const { count } = await prisma.account.updateMany({
    where: { firebase_uid: uid },
    data,
  });

  if (count === 0) {
    throw createHttpError(404, "Account not found");
  }

  res.send(await findByUid(uid));
});

export const registerUserRoutes = (app: Application) => {
  app.post("/user", createUser);
  app.get("/user", getUser);
  app.patch("/user", updateUser);
};
