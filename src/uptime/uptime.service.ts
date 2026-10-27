import { prisma } from "../lib/prisma";

export interface UptimeResult {
  monitorId: string;
  from: Date;
  to: Date;
  totalChecks: number;
  upChecks: number;
  uptimePercentage: number | null;
}

export function calculateUptimePercentage(totalChecks: number, upChecks: number): number | null {
  if (totalChecks === 0) {
    return null;
  }
  return Math.round((upChecks / totalChecks) * 10000) / 100;
}

export async function getUptime(monitorId: string, from: Date, to: Date): Promise<UptimeResult> {
  const [totalChecks, upChecks] = await Promise.all([
    prisma.check.count({ where: { monitorId, checkedAt: { gte: from, lte: to } } }),
    prisma.check.count({ where: { monitorId, checkedAt: { gte: from, lte: to }, isUp: true } }),
  ]);

  return {
    monitorId,
    from,
    to,
    totalChecks,
    upChecks,
    uptimePercentage: calculateUptimePercentage(totalChecks, upChecks),
  };
}
