import { z } from "zod";

const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const { protocol } = new URL(value);
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "Разрешены только HTTP и HTTPS");

export const createMonitorSchema = z.object({
  name: z.string().min(1),
  url: httpUrlSchema,
  intervalSeconds: z.number().int().min(5).max(86_400).optional(),
  isActive: z.boolean().optional(),
});

export const updateMonitorSchema = createMonitorSchema.partial();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const uptimeQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const notificationSchema = z.object({
  channel: z.enum(["log", "webhook"]),
  event: z.enum(["up", "down", "both"]),
  webhookUrl: httpUrlSchema.optional(),
});
