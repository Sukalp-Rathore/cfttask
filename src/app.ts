import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { errorHandler } from "./middleware/error-handler";
import { authRouter } from "./routes/auth";
import { chatRouter } from "./routes/chat";
import { userRouter } from "./routes/user";

export const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins.length === 0 ? false : config.corsOrigins
}));
app.use(express.json({ limit: "16kb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }));

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});
app.use("/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false }), authRouter);
app.use("/chat", chatRouter);
app.use("/user", userRouter);
app.use((_request, response) => {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});
app.use(errorHandler);
