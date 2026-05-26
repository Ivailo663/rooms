import type { Application, RequestHandler } from "express";
import prisma from "../prisma.js";
import { asyncHandler } from "../utils/http.js";
import type { AccountEntity } from "../../packages/shared/index.js";

const createUser: RequestHandler = asyncHandler(async (_req, res) => {
  const { email } = res.locals.user;

  const account: AccountEntity = await prisma.account.upsert({
    where: {
      email,
    },
    update: {},
    create: {
      email,
      name: email.split("@")[0],
    },
  });

  res.send(account);
});

const getUser: RequestHandler = asyncHandler(async (_req, res) => {
  const { email } = res.locals.user;

  const account: AccountEntity | null = await prisma.account.findUnique({
    where: {
      email,
    },
  });

  res.send(account);
});

export const registerUserRoutes = (app: Application) => {
  app.post("/user", createUser);
  app.get("/user", getUser);
};
