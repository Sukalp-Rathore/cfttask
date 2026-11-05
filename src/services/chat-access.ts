import { pool } from "../db";
import { AppError } from "../errors";

export async function assertChatMember(chatId: string, userId: string): Promise<void> {
  const result = await pool.query(
    "SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2",
    [chatId, userId]
  );

  if (result.rowCount === 0) {
    throw new AppError(404, "Chat not found", "CHAT_NOT_FOUND");
  }
}
