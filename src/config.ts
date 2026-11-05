import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(3600),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  CORS_ORIGINS: z.string().default("")
});

const parsedConfig = configSchema.safeParse(process.env);

if (!parsedConfig.success) {
  throw new Error(`Invalid environment configuration: ${parsedConfig.error.message}`);
}

export const config = {
  nodeEnv: parsedConfig.data.NODE_ENV,
  port: parsedConfig.data.PORT,
  databaseUrl: parsedConfig.data.DATABASE_URL,
  jwtSecret: parsedConfig.data.JWT_SECRET,
  jwtExpiresInSeconds: parsedConfig.data.JWT_EXPIRES_IN_SECONDS,
  firebaseServiceAccountJson: parsedConfig.data.FIREBASE_SERVICE_ACCOUNT_JSON,
  corsOrigins: parsedConfig.data.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
};
