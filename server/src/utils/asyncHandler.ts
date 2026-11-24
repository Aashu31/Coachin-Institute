import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

/**
 * Express 4 does not forward rejected promises to the error middleware, so every
 * async handler is wrapped explicitly.
 */
export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next): void => {
    handler(req, res, next).catch(next);
  };
}
