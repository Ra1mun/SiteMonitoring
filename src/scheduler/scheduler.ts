import pLimit from "p-limit";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { runCheck } from "./checker";

const limit = pLimit(env.checkConcurrency);
let timer: ReturnType<typeof setInterval> | null = null;
let currentTick: Promise<void> | null = null;

async function tick(): Promise<void> {
  const due = await prisma.monitor.findMany({
    where: { isActive: true, nextCheckAt: { lte: new Date() } },
    orderBy: { nextCheckAt: "asc" },
    take: env.batchSize,
  });
  await Promise.all(due.map(monitor => limit(async () => {
    try {
      // Re-read after queueing: the owner may have paused or deleted it.
      const latest = await prisma.monitor.findUnique({ where: { id: monitor.id } });
      if (latest?.isActive) await runCheck(latest);
    } catch (error) {
      logger.error("Ошибка проверки", { monitorId: monitor.id, error: String(error) });
    }
  })));
}

export function startScheduler(): void {
  if (timer) return;
  const schedule = () => {
    if (currentTick) return;
    currentTick = tick().catch(error => {
      logger.error("Ошибка планировщика", { error: String(error) });
    }).finally(() => { currentTick = null; });
  };
  timer = setInterval(schedule, env.schedulerTickMs);
  schedule();
  logger.info("Планировщик запущен", { tickMs: env.schedulerTickMs, concurrency: env.checkConcurrency });
}

export async function stopScheduler(): Promise<void> {
  if (timer) clearInterval(timer);
  timer = null;
  await currentTick;
}
