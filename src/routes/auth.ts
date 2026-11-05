import { Router } from "express";
import { asyncHandler } from "../async-handler";
import { authenticate } from "../middleware/authenticate";
import { login, register } from "../services/auth-service";
import { loginSchema, registerSchema } from "../validation";
import { pool } from "../db";
import { AppError } from "../errors";

export const authRouter = Router();

authRouter.post("/register", asyncHandler(async (request, response) => {
  const input = registerSchema.parse(request.body);
  const result = await register(input.email, input.password, input.displayName);
  response.status(201).json(result);
}));

authRouter.post("/login", asyncHandler(async (request, response) => {
  const input = loginSchema.parse(request.body);
  response.json(await login(input.email, input.password));
}));

authRouter.get("/me", authenticate, asyncHandler(async (request, response) => {
  const result = await pool.query(
    `SELECT id, email, display_name, created_at
     FROM users WHERE id = $1`,
    [request.user!.id]
  );
  const user = result.rows[0];

  if (!user) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  response.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      createdAt: user.created_at
    }
  });
}));
