import { Router } from "express";
import { asyncHandler } from "../async-handler";
import { AppError } from "../errors";
import { authenticate, requireSelf } from "../middleware/authenticate";
import { pool } from "../db";
import { userIdSchema } from "../validation";

export const userRouter = Router();

userRouter.get("/:userId/chats", authenticate, asyncHandler(async (request, response) => {
  const { userId } = userIdSchema.parse(request.params);
  requireSelf(userId, request.user!.id);

  const result = await pool.query<{
    id: string;
    created_at: Date;
    member_ids: string[];
  }>(
    `SELECT c.id, c.created_at,
            array_agg(cm.user_id ORDER BY cm.user_id) AS member_ids
     FROM chat_members AS mine
     JOIN chats AS c ON c.id = mine.chat_id
     JOIN chat_members AS cm ON cm.chat_id = c.id
     WHERE mine.user_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [userId]
  );

  response.json({
    chats: result.rows.map((row) => ({
      chatId: row.id,
      memberIds: row.member_ids,
      createdAt: row.created_at
    }))
  });
}));

userRouter.get("/:userId", authenticate, asyncHandler(async (request, response) => {
  const { userId } = userIdSchema.parse(request.params);
  requireSelf(userId, request.user!.id);
  const result = await pool.query(
    `SELECT id, email, display_name, created_at
     FROM users WHERE id = $1`,
    [userId]
  );

  const user = result.rows[0];
  if (!user) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  response.json({
    user: { id: user.id, email: user.email, displayName: user.display_name, createdAt: user.created_at }
  });
}));
