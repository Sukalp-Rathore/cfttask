import { app } from "./app";
import { config } from "./config";
import { pool } from "./db";

const server = app.listen(config.port, () => {
  console.info(`Chat API listening on port ${config.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.info(`${signal} received; shutting down`);
  server.close(async (error) => {
    if (error) {
      console.error("HTTP server shutdown failed", error);
      process.exitCode = 1;
    }

    try {
      await pool.end();
    } catch (poolError) {
      console.error("PostgreSQL pool shutdown failed", poolError);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
