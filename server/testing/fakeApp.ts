import type { Application, RequestHandler } from "express";

// Route tests register through a stand-in Application and then call an
// endpoint as one handler. Each endpoint is a middleware chain (requireRole,
// then the handler), so the stand-in runs the chain the way Express would:
// an error goes to `next` and stops the chain, a middleware that calls
// `next()` hands over to the following one, and the last one gets the real
// `next`.
const chain =
  (stack: RequestHandler[]): RequestHandler =>
  async (req, res, next) => {
    for (const [index, handler] of stack.entries()) {
      if (index === stack.length - 1) {
        await handler(req, res, next);
        return;
      }

      let passed = false;
      let failure: unknown;
      await handler(req, res, (error?: unknown) => {
        if (error) failure = error;
        else passed = true;
      });

      if (failure !== undefined) {
        next(failure);
        return;
      }
      if (!passed) return;
    }
  };

export const createFakeApp = (): {
  app: Application;
  handlers: Map<string, RequestHandler>;
} => {
  const handlers = new Map<string, RequestHandler>();
  const register =
    (method: string) =>
    (path: string, ...stack: RequestHandler[]) =>
      handlers.set(`${method} ${path}`, chain(stack));

  const app = {
    get: register("GET"),
    post: register("POST"),
    put: register("PUT"),
    patch: register("PATCH"),
    delete: register("DELETE"),
  } as unknown as Application;

  return { app, handlers };
};
