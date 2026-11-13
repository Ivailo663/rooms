// One-off (PROF-20, AUTH-02): link every existing account to its Firebase user
// by email, and set "member since" to when that Firebase user was created.
//
//   npx tsx server/scripts/backfill-firebase-accounts.ts          dry run
//   npx tsx server/scripts/backfill-firebase-accounts.ts --apply  writes
//
// The dry run reads only. --apply writes every match in one transaction, and
// each write is conditional on the account still having no uid, so a sign-in
// that linked an account in the meantime rolls the whole run back instead of
// being overwritten. Re-running after a successful apply finds nothing to do.
import type { UserRecord } from "firebase-admin/auth";
import admin from "../firebase.js";
import prisma from "../prisma.js";

const apply = process.argv.includes("--apply");

interface Match {
  accountId: number;
  email: string;
  uid: string;
  createdAt: Date;
}

const listAllFirebaseUsers = async (): Promise<UserRecord[]> => {
  const users: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
};

const main = async (): Promise<void> => {
  const [firebaseUsers, accounts, linked] = await Promise.all([
    listAllFirebaseUsers(),
    prisma.account.findMany({
      where: { firebase_uid: null },
      select: { id: true, email: true },
      orderBy: { id: "asc" },
    }),
    prisma.account.findMany({
      where: { firebase_uid: { not: null } },
      select: { firebase_uid: true },
    }),
  ]);

  const linkedUids = new Set(linked.map((a) => a.firebase_uid));
  const usersByEmail = new Map<string, UserRecord[]>();
  for (const user of firebaseUsers) {
    if (!user.email || linkedUids.has(user.uid)) continue;
    const key = user.email.toLowerCase();
    usersByEmail.set(key, [...(usersByEmail.get(key) ?? []), user]);
  }

  const accountsByEmail = new Map<string, number>();
  for (const account of accounts) {
    if (!account.email) continue;
    const key = account.email.toLowerCase();
    accountsByEmail.set(key, (accountsByEmail.get(key) ?? 0) + 1);
  }

  const matches: Match[] = [];
  const unmatchedAccounts: string[] = [];
  const ambiguous: string[] = [];
  const matchedUids = new Set<string>();

  for (const account of accounts) {
    const key = account.email?.toLowerCase();
    const users = key ? usersByEmail.get(key) : undefined;
    if (!key || !users) {
      unmatchedAccounts.push(
        `  account ${account.id}  ${account.email ?? "(no email)"}`,
      );
      continue;
    }
    // Two rows or two Firebase users for one address: a human decides.
    if (users.length > 1 || accountsByEmail.get(key)! > 1) {
      ambiguous.push(
        `  account ${account.id}  ${account.email}  (${users.length} Firebase user(s), ${accountsByEmail.get(key)} account(s))`,
      );
      continue;
    }
    const [user] = users;
    matchedUids.add(user.uid);
    matches.push({
      accountId: account.id,
      email: account.email!,
      uid: user.uid,
      createdAt: new Date(user.metadata.creationTime),
    });
  }

  const orphanUsers = firebaseUsers.filter(
    (u) => !linkedUids.has(u.uid) && !matchedUids.has(u.uid),
  );

  console.log(apply ? "MODE: apply" : "MODE: dry run (nothing is written)");
  console.log(
    `Firebase users: ${firebaseUsers.length}; accounts without uid: ${accounts.length}; accounts already linked: ${linked.length}`,
  );

  console.log(`\nMatched (${matches.length}):`);
  for (const m of matches) {
    console.log(
      `  account ${m.accountId}  ${m.email}  uid ${m.uid}  created ${m.createdAt.toISOString()}`,
    );
  }
  if (ambiguous.length) {
    console.log(`\nAmbiguous, skipped (${ambiguous.length}):`);
    ambiguous.forEach((line) => console.log(line));
  }
  console.log(
    `\nAccounts with no Firebase user (${unmatchedAccounts.length}):`,
  );
  unmatchedAccounts.forEach((line) => console.log(line));
  console.log(`\nFirebase users with no account (${orphanUsers.length}):`);
  for (const u of orphanUsers) {
    console.log(
      `  uid ${u.uid}  ${u.email ?? "(no email)"}  created ${new Date(u.metadata.creationTime).toISOString()}`,
    );
  }

  if (!apply) {
    console.log("\nDry run: re-run with --apply to write the matches.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const m of matches) {
      const { count } = await tx.account.updateMany({
        where: { id: m.accountId, firebase_uid: null },
        data: { firebase_uid: m.uid, created_at: m.createdAt },
      });
      if (count !== 1) {
        throw new Error(
          `account ${m.accountId} was linked meanwhile; nothing written`,
        );
      }
    }
  });
  console.log(`\nApplied: ${matches.length} account(s) linked.`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
