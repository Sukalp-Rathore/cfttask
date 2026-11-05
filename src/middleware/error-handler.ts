import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors";

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.issues.map(({ path, message }) => ({ path: path.join("."), message }))
      }
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message }
    });
    return;
  }

  if (isMalformedJson(error)) {
    response.status(400).json({
      error: { code: "INVALID_JSON", message: "Request body must contain valid JSON" }
    });
    return;
  }

  console.error("Unhandled request error", error);
  response.status(500).json({
    error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" }
  });
};

function isMalformedJson(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "status" in error && error.status === 400 &&
    "type" in error && error.type === "entity.parse.failed";
}
