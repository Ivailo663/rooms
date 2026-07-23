import type { Application, RequestHandler } from "express";
import prisma from "../prisma.js";
import { asyncHandler } from "../utils/http.js";
import type { AccountSearchResult } from "@football/shared";

// Minimum characters before we run a search. Mirrors the client guard so a bare
// `?search=` or a one-letter query can never dump the whole accounts table.
const MIN_SEARCH_LENGTH = 3;
// Hard cap on rows returned. The client virtualizes the dropdown, but the query
// itself must stay bounded regardless of how generic the search term is.
const MAX_RESULTS = 100;

const searchAccounts: RequestHandler = asyncHandler(async (req, res) => {
  const search = String(req.query.search ?? "").trim();

  if (search.length < MIN_SEARCH_LENGTH) {
    return res.status(200).json([] satisfies AccountSearchResult[]);
  }

  const accounts = await prisma.account.findMany({
    where: {
      // The caller can never appear in their own results — you don't flag
      // yourself for approval.
      email: { not: res.locals.user.email, mode: "insensitive" },
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: MAX_RESULTS,
  });

  return res.status(200).json(accounts satisfies AccountSearchResult[]);
});

export const registerAccountRoutes = (app: Application) => {
  app.get("/accounts", searchAccounts);
};
