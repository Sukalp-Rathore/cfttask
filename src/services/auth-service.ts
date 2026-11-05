import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db";
import { config } from "../config";
import { AppError } from "../errors";

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: Date;
}

type PublicUserRow = Pick<UserRow, "id" | "email" | "display_name" | "created_at">;

function toPublicUser(row: PublicUserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at
  };
}

function createAccessToken(user: Pick<UserRow, "id" | "email">): string {
  return jwt.sign({ email: user.email }, config.jwtSecret, {
    subject: user.id,
    expiresIn: config.jwtExpiresInSeconds
  });
}

export async function register(email: string, password: string, displayName: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query<PublicUserRow>(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, display_name, created_at`,
    [email, passwordHash, displayName]
  ).catch((error: unknown) => {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "An account with this email already exists", "EMAIL_ALREADY_EXISTS");
    }
    throw error;
  });

  const user = result.rows[0];
  if (!user) {
    throw new Error("User insert returned no row");
  }

  return { user: toPublicUser(user), accessToken: createAccessToken(user) };
}

export async function login(email: string, password: string) {
  const result = await pool.query<UserRow>(
    `SELECT id, email, display_name, password_hash, created_at
     FROM users WHERE email = $1`,
    [email]
  );
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  return { user: toPublicUser(user), accessToken: createAccessToken(user) };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
