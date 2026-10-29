import pLimit from "p-limit";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { runCheck } from "./checker";

const limitConcurrency = pLimit(env.checkConcurrency);
let timer: ReturnType<typeof setInterval> | null = null;
let pendingBatch: Promise<void> | null = null;

async function checkActiveMonitor(monitorId: string): Promise<void> {
  try {
    // За время ожидания в очереди пользователь мог остановить или удалить монитор.
    const monitor = await prisma.monitor.findUnique({
      where: { id: monitorId },
    });
    if (monitor?.isActive) {
      await runCheck(monitor);
    }
  } catch (error) {
    logger.error("Ошибка проверки", { monitorId, error: String(error) });
  }
}

async function checkDueMonitors(): Promise<void> {
  const dueMonitors = await prisma.monitor.findMany({
    where: { isActive: true, nextCheckAt: { lte: new Date() } },
    orderBy: { nextCheckAt: "asc" },
    take: env.batchSize,
  });

  const checks = dueMonitors.map((monitor) =>
    limitConcurrency(() => checkActiveMonitor(monitor.id)),
  );
  await Promise.all(checks);
}

function scheduleNextBatch(): void {
  // Не запускаем новую партию, пока предыдущая не закончена.
  if (pendingBatch) return;

  pendingBatch = checkDueMonitors()
    .catch((error) => {
      logger.error("Ошибка планировщика", { error: String(error) });
    })
    .finally(() => {
      pendingBatch = null;
    });
}

export function startScheduler(): void {
  if (timer) return;

  timer = setInterval(scheduleNextBatch, env.schedulerTickMs);
  scheduleNextBatch();
  logger.info("Планировщик запущен", {
    tickMs: env.schedulerTickMs,
    concurrency: env.checkConcurrency,
  });
}

export async function stopScheduler(): Promise<void> {
  if (timer) clearInterval(timer);
  timer = null;
  await pendingBatch;
}
