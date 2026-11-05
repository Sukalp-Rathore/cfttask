import { Timestamp } from "firebase-admin/firestore";
import { Router } from "express";
import { asyncHandler } from "../async-handler";
import { AppError } from "../errors";
import { firestore } from "../firebase";
import { pool } from "../db";
import { authenticate, requireSelf } from "../middleware/authenticate";
import { assertChatMember } from "../services/chat-access";
import {
  chatIdSchema,
  createChatSchema,
  lastSeenSchema,
  messageIdSchema,
  messageLimitSchema,
  sendMessageSchema,
  userIdSchema
} from "../validation";

export const chatRouter = Router();
chatRouter.use(authenticate);

chatRouter.post("/create", asyncHandler(async (request, response) => {
  const input = createChatSchema.parse(request.body);
  requireSelf(input.userAId, request.user!.id);

  const otherUser = await pool.query("SELECT 1 FROM users WHERE id = $1", [input.userBId]);
  if (otherUser.rowCount === 0) {
    throw new AppError(404, "Other user not found", "USER_NOT_FOUND");
  }

  const [userLowId, userHighId] = [input.userAId, input.userBId].sort();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const chat = await client.query<{ id: string }>(
      `INSERT INTO chats (user_low_id, user_high_id)
       VALUES ($1, $2)
       ON CONFLICT (user_low_id, user_high_id)
       DO UPDATE SET user_low_id = EXCLUDED.user_low_id
       RETURNING id`,
      [userLowId, userHighId]
    );
    const chatId = chat.rows[0]?.id;
    if (!chatId) {
      throw new Error("Chat insert returned no row");
    }

    await client.query(
      `INSERT INTO chat_members (chat_id, user_id)
       VALUES ($1, $2), ($1, $3)
       ON CONFLICT (chat_id, user_id) DO NOTHING`,
      [chatId, userLowId, userHighId]
    );
    await client.query("COMMIT");
    response.status(200).json({ chatId });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

chatRouter.post("/:chatId/message/send", asyncHandler(async (request, response) => {
  const chatId = chatIdSchema.parse(request.params.chatId);
  const input = sendMessageSchema.parse(request.body);
  requireSelf(input.senderId, request.user!.id);
  await assertChatMember(chatId, request.user!.id);

  const createdAt = Timestamp.now();
  const messageRef = await firestore.collection("chats").doc(chatId).collection("messages").add({
    senderId: request.user!.id,
    text: input.text,
    createdAt
  });

  response.status(201).json({
    message: {
      id: messageRef.id,
      senderId: request.user!.id,
      text: input.text,
      createdAt: createdAt.toDate().toISOString()
    }
  });
}));

chatRouter.get("/:chatId/messages", asyncHandler(async (request, response) => {
  const chatId = chatIdSchema.parse(request.params.chatId);
  const limit = messageLimitSchema.parse(request.query.limit);
  await assertChatMember(chatId, request.user!.id);

  const snapshot = await firestore.collection("chats").doc(chatId).collection("messages")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  const messages = snapshot.docs.reverse().map((document) => {
    const data = document.data();
    if (typeof data.senderId !== "string" || typeof data.text !== "string") {
      throw new Error(`Firestore message ${document.id} has invalid data`);
    }
    return {
      id: document.id,
      senderId: data.senderId,
      text: data.text,
      createdAt: getTimestamp(data.createdAt).toDate().toISOString()
    };
  });

  response.json({ messages });
}));

chatRouter.post("/:chatId/message/:messageId/read", asyncHandler(async (request, response) => {
  const chatId = chatIdSchema.parse(request.params.chatId);
  const messageId = messageIdSchema.parse(request.params.messageId);
  const { userId } = userIdSchema.parse(request.body);
  requireSelf(userId, request.user!.id);
  await assertChatMember(chatId, request.user!.id);

  const messageRef = firestore.collection("chats").doc(chatId).collection("messages").doc(messageId);
  const receiptRef = messageRef.collection("readReceipts").doc(request.user!.id);
  const readAt = await firestore.runTransaction(async (transaction) => {
    const [messageSnapshot, receiptSnapshot] = await Promise.all([
      transaction.get(messageRef),
      transaction.get(receiptRef)
    ]);

    if (!messageSnapshot.exists) {
      throw new AppError(404, "Message not found", "MESSAGE_NOT_FOUND");
    }
    if (receiptSnapshot.exists) {
      return getTimestamp(receiptSnapshot.get("readAt"));
    }

    const timestamp = Timestamp.now();
    transaction.set(receiptRef, { userId: request.user!.id, readAt: timestamp });
    return timestamp;
  });

  response.json({ messageId, userId: request.user!.id, readAt: readAt.toDate().toISOString() });
}));

chatRouter.post("/:chatId/lastseen", asyncHandler(async (request, response) => {
  const chatId = chatIdSchema.parse(request.params.chatId);
  const input = lastSeenSchema.parse(request.body);
  requireSelf(input.userId, request.user!.id);
  await assertChatMember(chatId, request.user!.id);

  const chatRef = firestore.collection("chats").doc(chatId);
  const messageRef = chatRef.collection("messages").doc(input.messageId);
  const memberRef = chatRef.collection("members").doc(request.user!.id);
  const lastSeenAt = await firestore.runTransaction(async (transaction) => {
    const targetSnapshot = await transaction.get(messageRef);
    if (!targetSnapshot.exists) {
      throw new AppError(404, "Message not found", "MESSAGE_NOT_FOUND");
    }

    const targetCreatedAt = getTimestamp(targetSnapshot.get("createdAt"));
    const memberSnapshot = await transaction.get(memberRef);
    if (memberSnapshot.exists) {
      const currentMessageId: unknown = memberSnapshot.get("lastSeenMessageId");
      if (typeof currentMessageId === "string") {
        const currentMessage = await transaction.get(chatRef.collection("messages").doc(currentMessageId));
        if (currentMessage.exists) {
          const currentCreatedAt = getTimestamp(currentMessage.get("createdAt"));
          if (currentCreatedAt.toMillis() > targetCreatedAt.toMillis()) {
            throw new AppError(409, "Last seen position cannot move backwards", "LAST_SEEN_REGRESSION");
          }
        }
      }
    }

    const timestamp = Timestamp.now();
    transaction.set(memberRef, {
      userId: request.user!.id,
      lastSeenMessageId: input.messageId,
      lastSeenAt: timestamp
    }, { merge: true });
    return timestamp;
  });

  response.json({
    userId: request.user!.id,
    messageId: input.messageId,
    lastSeenAt: lastSeenAt.toDate().toISOString()
  });
}));

function getTimestamp(value: unknown): Timestamp {
  if (!(value instanceof Timestamp)) {
    throw new Error("Firestore document contains an invalid timestamp");
  }
  return value;
}
