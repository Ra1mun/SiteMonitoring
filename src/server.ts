import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { startScheduler, stopScheduler } from "./scheduler/scheduler";
import { prisma } from "./lib/prisma";

const server = createApp().listen(env.port, () => {
  logger.info("Сервер запущен", { port: env.port });
  startScheduler();
});
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const closed = new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await Promise.all([closed, stopScheduler()]);
  await prisma.$disconnect();
}
process.on("SIGINT", () => {
  shutdown().catch(console.error);
});
process.on("SIGTERM", () => {
  shutdown().catch(console.error);
});
