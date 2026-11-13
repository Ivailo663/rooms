import type { PlayerPosition } from "@prisma/client";
import type { UpdateProfileRequest } from "../packages/shared/index.js";
import { createHttpError } from "./utils/http.js";
import { CITIES } from "./cities.js";

const NAME_MAX_LENGTH = 50;
const BIO_MAX_LENGTH = 300;

// A Record, not an array, so adding a value to the enum fails to compile here
// instead of silently being rejected as 400.
const POSITIONS: Record<PlayerPosition, true> = {
  goalkeeper: true,
  defender: true,
  midfielder: true,
  forward: true,
};

// Postgres varchar(n) counts characters, JS `length` counts UTF-16 units; an
// emoji would otherwise count twice here and once in the column.
const charLength = (value: string): number => [...value].length;

// Absent leaves the field as it is; null or "" clears it.
const optionalString = (
  value: unknown,
  field: string,
): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw createHttpError(400, `${field} must be text`);
  }
  return value.trim() || null;
};

// PROF-21..24. Only the four editable fields are read; anything else in the
// body is ignored.
export const parseProfileUpdate = (body: unknown): UpdateProfileRequest => {
  const input = (
    typeof body === "object" && body !== null ? body : {}
  ) as Record<string, unknown>;

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    throw createHttpError(400, "Name is required");
  }
  if (charLength(name) > NAME_MAX_LENGTH) {
    throw createHttpError(
      400,
      `Name must be at most ${NAME_MAX_LENGTH} characters`,
    );
  }

  const update: UpdateProfileRequest = { name };

  const position = optionalString(input.position, "Position");
  if (position !== undefined) {
    if (position !== null && !Object.hasOwn(POSITIONS, position)) {
      throw createHttpError(
        400,
        "Position must be goalkeeper, defender, midfielder or forward",
      );
    }
    update.position = position as PlayerPosition | null;
  }

  const city = optionalString(input.city, "City");
  if (city !== undefined) {
    if (city !== null && !CITIES.includes(city)) {
      throw createHttpError(400, "City must be one from the list");
    }
    update.city = city;
  }

  const bio = optionalString(input.bio, "Bio");
  if (bio !== undefined) {
    if (bio !== null && charLength(bio) > BIO_MAX_LENGTH) {
      throw createHttpError(
        400,
        `Bio must be at most ${BIO_MAX_LENGTH} characters`,
      );
    }
    update.bio = bio;
  }

  return update;
};
