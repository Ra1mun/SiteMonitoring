import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { HttpError } from "../middleware/errorHandler";
import { MonitorStatus, NotificationChannel, NotificationEvent } from "../types";

export interface CreateNotificationInput {
  channel: NotificationChannel;
  event: NotificationEvent;
  webhookUrl?: string;
}

export async function listNotifications(monitorId: string) {
  return prisma.notification.findMany({ where: { monitorId }, orderBy: { createdAt: "desc" } });
}

export async function createNotification(monitorId: string, input: CreateNotificationInput) {
  if (input.channel === "webhook" && !input.webhookUrl) {
    throw new HttpError(400, "Для канала webhook обязателен webhookUrl");
  }

  return prisma.notification.create({
    data: {
      monitorId,
      channel: input.channel,
      event: input.event,
      webhookUrl: input.webhookUrl,
    },
  });
}

export async function deleteNotification(userId: string, notificationId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: { monitor: true },
  });
  if (!notification || notification.monitor.userId !== userId) {
    throw new HttpError(404, "Уведомление не найдено");
  }
  await prisma.notification.delete({ where: { id: notificationId } });
}

async function sendWebhook(url: string, payload: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.webHookTimeout);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: "error",
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`Webhook HTTP ${response.status}`);
  } catch (err) {
    logger.error("Не удалось доставить webhook-уведомление", {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function notifyStatusChange(
  monitor: { id: string; name: string; url: string },
  newStatus: MonitorStatus,
  previousStatus: MonitorStatus | null,
) {
  logger.info("Смена статуса монитора", {
    monitorId: monitor.id,
    monitorName: monitor.name,
    url: monitor.url,
    previousStatus,
    newStatus,
  });

  const notifications = await prisma.notification.findMany({
    where: {
      monitorId: monitor.id,
      isActive: true,
      OR: [{ event: newStatus }, { event: "both" }],
    },
  });

  const payload = {
    monitorId: monitor.id,
    monitorName: monitor.name,
    url: monitor.url,
    previousStatus,
    status: newStatus,
    timestamp: new Date().toISOString(),
  };

  await Promise.all(
    notifications
      .filter((n) => n.channel === "webhook" && n.webhookUrl)
      .map((n) => sendWebhook(n.webhookUrl as string, payload)),
  );
}

