import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AppError } from "../errors";

export const authenticate: RequestHandler = (request, _response, next) => {
  const authorization = request.header("authorization");
  const [scheme, token] = authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    next(new AppError(401, "A bearer token is required", "UNAUTHENTICATED"));
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === "string" || typeof payload.sub !== "string" || typeof payload.email !== "string") {
      throw new AppError(401, "Invalid access token", "INVALID_TOKEN");
    }

    request.user = { id: payload.sub, email: payload.email };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError(401, "Invalid or expired access token", "INVALID_TOKEN"));
  }
};

export function requireSelf(requestedUserId: string, authenticatedUserId: string): void {
  if (requestedUserId !== authenticatedUserId) {
    throw new AppError(403, "You can only act as the authenticated user", "FORBIDDEN");
  }
}
