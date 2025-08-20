import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error captured by middleware:', err);

  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'UNEXPECTED_ERROR';

  res.status(status).json({
    success: false,
    message,
    code,
  });
}
