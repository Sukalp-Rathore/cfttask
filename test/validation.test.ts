import assert from "node:assert/strict";
import test from "node:test";
import {
  createChatSchema,
  lastSeenSchema,
  messageLimitSchema,
  registerSchema,
  sendMessageSchema
} from "../src/validation";

const userA = "2bfde71b-9b66-4f4e-bcb5-93ddce6b05d0";
const userB = "e8f96b35-9d8e-4d7b-8dd1-0f47a5680720";

test("registration normalizes email and enforces password strength", () => {
  const parsed = registerSchema.parse({
    email: "  User@Example.com ",
    password: "a-strong-password",
    displayName: "User"
  });
  assert.equal(parsed.email, "user@example.com");
  assert.equal(registerSchema.safeParse({
    email: "user@example.com",
    password: "short",
    displayName: "User"
  }).success, false);
});

test("one-to-one chats reject self-chat and accept distinct UUIDs", () => {
  assert.equal(createChatSchema.safeParse({ userAId: userA, userBId: userA }).success, false);
  assert.equal(createChatSchema.safeParse({ userAId: userA, userBId: userB }).success, true);
});

test("message and last-seen inputs are constrained", () => {
  assert.equal(sendMessageSchema.safeParse({ senderId: userA, text: " hello " }).success, true);
  assert.equal(sendMessageSchema.safeParse({ senderId: userA, text: "  " }).success, false);
  assert.equal(lastSeenSchema.safeParse({ userId: userA, messageId: "valid-id_1" }).success, true);
  assert.equal(lastSeenSchema.safeParse({ userId: userA, messageId: "../other" }).success, false);
});

test("message page size defaults and is capped", () => {
  assert.equal(messageLimitSchema.parse(undefined), 50);
  assert.equal(messageLimitSchema.parse("100"), 100);
  assert.equal(messageLimitSchema.safeParse("101").success, false);
});
