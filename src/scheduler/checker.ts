import { Monitor } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { notifyStatusChange } from "../notifications/notification.service";
import { MonitorStatus } from "../types";

interface CheckOutcome {
  statusCode: number | null;
  responseTimeMs: number;
  responseSizeBytes: number | null;
  isUp: boolean;
  error: string | null;
}

async function performHttpCheck(url: string): Promise<CheckOutcome> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.httpCheckTimeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    
    const body = await response.arrayBuffer();
    const responseTimeMs = Date.now() - startedAt;
    const responseSizeBytes = body.byteLength;

    return {
      statusCode: response.status,
      responseTimeMs,
      responseSizeBytes,
      isUp: response.status >= 200 && response.status < 400,
      error: null,
    };
  } catch (err) {
    return {
      statusCode: null,
      responseTimeMs: Date.now() - startedAt,
      responseSizeBytes: null,
      isUp: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runCheck(monitor: Monitor): Promise<void> {
  const outcome = await performHttpCheck(monitor.url);

  const newStatus: MonitorStatus = outcome.isUp ? "up" : "down";
  const previousStatus = monitor.lastStatus as MonitorStatus | null;
  await prisma.$transaction(async tx => {
  await tx.check.create({
    data: {
      monitorId: monitor.id,
      statusCode: outcome.statusCode,
      responseTimeMs: outcome.responseTimeMs,
      responseSizeBytes: outcome.responseSizeBytes,
      isUp: outcome.isUp,
      error: outcome.error,
    },
  });

  const now = new Date();

  await tx.monitor.update({
    where: { id: monitor.id },
    data: {
      lastStatus: newStatus,
      lastCheckedAt: now,
      nextCheckAt: new Date(now.getTime() + monitor.intervalSeconds * 1000),
    },
  });

  });
  logger.info("Проверка монитора выполнена", {
    monitorId: monitor.id,
    url: monitor.url,
    statusCode: outcome.statusCode,
    responseTimeMs: outcome.responseTimeMs,
    isUp: outcome.isUp,
  });

  if (previousStatus !== null && previousStatus !== newStatus) {
    await notifyStatusChange(monitor, newStatus, previousStatus);
  }
}


