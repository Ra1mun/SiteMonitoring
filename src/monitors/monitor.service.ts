import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";

export interface CreateMonitorInput {
  name: string;
  url: string;
  intervalSeconds?: number;
  isActive?: boolean;
}

export interface UpdateMonitorInput {
  name?: string;
  url?: string;
  intervalSeconds?: number;
  isActive?: boolean;
}

export async function listMonitors(userId: string) {
  return prisma.monitor.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOwnedMonitor(userId: string, monitorId: string) {
  const monitor = await prisma.monitor.findUnique({ where: { id: monitorId } });
  if (!monitor || monitor.userId !== userId) {
    throw new HttpError(404, "Монитор не найден");
  }
  return monitor;
}

export async function createMonitor(userId: string, input: CreateMonitorInput) {
  return prisma.monitor.create({
    data: {
      userId,
      name: input.name,
      url: input.url,
      intervalSeconds: input.intervalSeconds ?? 60,
      isActive: input.isActive ?? true,
      nextCheckAt: new Date(),
    },
  });
}

export async function updateMonitor(
  userId: string,
  monitorId: string,
  input: UpdateMonitorInput,
) {
  await getOwnedMonitor(userId, monitorId);
  return prisma.monitor.update({ where: { id: monitorId }, data: input });
}

export async function deleteMonitor(userId: string, monitorId: string) {
  await getOwnedMonitor(userId, monitorId);
  await prisma.monitor.delete({ where: { id: monitorId } });
}
