import { createHttpError } from "./http.js";

export const toInteger = (value: unknown, fieldName: string) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw createHttpError(400, `${fieldName} must be an integer`);
  }

  return parsed;
};

// SLOT-17. `min` may be empty (no quorum); otherwise 1 ≤ min ≤ max.
export const assertPlayerLimits = (min: unknown, max: unknown) => {
  if (!Number.isInteger(max) || (max as number) < 1) {
    throw createHttpError(400, "max_players must be a whole number of at least 1");
  }

  if (
    min !== null &&
    min !== undefined &&
    (!Number.isInteger(min) || (min as number) < 1 || (min as number) > (max as number))
  ) {
    throw createHttpError(
      400,
      "min_players must be a whole number between 1 and max_players"
    );
  }
};

export const toOptionalDate = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw createHttpError(400, `${fieldName} must be a valid date`);
  }

  return date;
};
