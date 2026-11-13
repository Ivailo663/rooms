import type { Account, PlayerPosition } from "@football/shared";

// PROF-23, kept in step with the server's limits in server/profile.ts. The
// messages are the server's own, so a field reads the same whichever side
// caught it.
export const NAME_MAX_LENGTH = 50;
export const BIO_MAX_LENGTH = 300;

// Postgres varchar(n) counts characters and JS `length` counts UTF-16 units,
// so an emoji would count twice here and once on the server.
export const charLength = (value: string) => [...value].length;

export const nameError = (name: string): string | null => {
  const trimmed = name.trim();
  if (!trimmed) return "Name is required";
  if (charLength(trimmed) > NAME_MAX_LENGTH)
    return `Name must be at most ${NAME_MAX_LENGTH} characters`;
  return null;
};

export const bioError = (bio: string): string | null =>
  charLength(bio.trim()) > BIO_MAX_LENGTH
    ? `Bio must be at most ${BIO_MAX_LENGTH} characters`
    : null;

// PROF-22, in the order a team sheet reads.
export const POSITIONS: { value: PlayerPosition; label: string }[] = [
  { value: "goalkeeper", label: "Goalkeeper" },
  { value: "defender", label: "Defender" },
  { value: "midfielder", label: "Midfielder" },
  { value: "forward", label: "Forward" },
];

export const positionLabel = (position: PlayerPosition | null) =>
  POSITIONS.find((option) => option.value === position)?.label ?? null;

// PROF-25: no picture means initials, never a generic icon, so two players
// without pictures still look different.
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => [...part][0]?.toUpperCase() ?? "")
    .join("") || "?";

// PROF-20: "member since" is a month, not a day; the exact date is noise.
export const memberSince = (createdAt: string | Date) =>
  new Date(createdAt).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });

// AUTH-24 (mirrored): a signed-in user with no account, or with one that
// hasn't ticked the sign-up box, can't use the app until they tick it.
// Accounts arrive as JSON, so the timestamp is a string or null.
export const needsTermsTick = (
  account: Pick<Account, "terms_accepted_at"> | null
) => !account?.terms_accepted_at;
