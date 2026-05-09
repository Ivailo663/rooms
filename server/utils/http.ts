import type { RequestHandler } from "express";

export interface AppError extends Error {
  status?: number;
}

export const createHttpError = (status: number, message: string): AppError => {
  const error = new Error(message) as AppError;
  error.status = status;
  return error;
};

export const asyncHandler =
  <TRequestHandler extends RequestHandler>(handler: TRequestHandler): TRequestHandler =>
  (async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  }) as TRequestHandler;
