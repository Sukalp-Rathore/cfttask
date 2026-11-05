import { z } from "zod";

const uuidSchema = z.string().uuid();

export const registerSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(12).refine((password) => Buffer.byteLength(password, "utf8") <= 72, {
    message: "Password must not exceed 72 UTF-8 bytes"
  }),
  displayName: z.string().trim().min(1).max(100)
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(72)
});

export const createChatSchema = z.object({
  userAId: uuidSchema,
  userBId: uuidSchema
}).refine((input) => input.userAId !== input.userBId, {
  message: "A one-to-one chat requires two different users"
});

export const sendMessageSchema = z.object({
  senderId: uuidSchema,
  text: z.string().trim().min(1).max(10_000)
});

export const userIdSchema = z.object({ userId: uuidSchema });
export const lastSeenSchema = z.object({
  userId: uuidSchema,
  messageId: z.string().regex(/^[A-Za-z0-9_-]{1,150}$/)
});
export const messageIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,150}$/);
export const chatIdSchema = z.string().uuid();
export const messageLimitSchema = z.coerce.number().int().min(1).max(100).default(50);
