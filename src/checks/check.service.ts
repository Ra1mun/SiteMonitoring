import { prisma } from "../lib/prisma";

export interface PaginatedChecks {
  data: Awaited<ReturnType<typeof prisma.check.findMany>>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export async function listChecks(
  monitorId: string,
  page: number,
  pageSize: number,
): Promise<PaginatedChecks> {
  const [data, total] = await Promise.all([
    prisma.check.findMany({
      where: { monitorId },
      orderBy: { checkedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.check.count({ where: { monitorId } }),
  ]);

  return {
    data,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
