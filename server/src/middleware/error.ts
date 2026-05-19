import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors?: any;

  constructor(message: string, statusCode: number, errors?: any) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized access") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden action") {
    super(message, 403);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, errors?: any) {
    super(message, 400, errors);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const isDev = process.env.NODE_ENV === "development";

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
      stack: isDev ? err.stack : undefined,
    });
  }

  // Fallback for unhandled/internal errors
  console.error("[Unhandled Error]:", err);
  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
    stack: isDev ? err.stack : undefined,
  });
}
