import { createHttpError } from "./http.js";

export const toInteger = (value: unknown, fieldName: string) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw createHttpError(400, `${fieldName} must be an integer`);
  }

  return parsed;
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
