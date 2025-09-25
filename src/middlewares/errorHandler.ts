import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error captured by middleware:', err);

  const status = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'UNEXPECTED_ERROR';

  // Handle specific JSON parsing errors with more context
  if (err.name === 'JSONParseError' || message.includes('JSON') || message.includes('position')) {
    code = 'JSON_PARSE_ERROR';
    message = 'Failed to parse response data. The service may be experiencing issues processing the recommendation request.';
  }

  // Handle SyntaxError from JSON.parse
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    code = 'JSON_SYNTAX_ERROR';
    message = 'Invalid JSON format in response data. Please try again.';
  }

  res.status(status).json({
    success: false,
    message,
    code,
    ...(process.env.NODE_ENV === 'development' && { 
      originalError: err.message,
      stack: err.stack 
    })
  });
}
