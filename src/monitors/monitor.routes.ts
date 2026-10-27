import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { AuthedRequest } from "../types";
import * as monitorService from "./monitor.service";
import * as checkService from "../checks/check.service";
import * as uptimeService from "../uptime/uptime.service";
import * as notificationService from "../notifications/notification.service";

const router = Router();
router.use(requireAuth);

const createMonitorSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().refine(value => ["http:", "https:"].includes(new URL(value).protocol), "Разрешены только HTTP и HTTPS"),
  intervalSeconds: z.number().int().min(5).max(86_400).optional(),
  isActive: z.boolean().optional(),
});

const updateMonitorSchema = createMonitorSchema.partial();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const uptimeQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const notificationSchema = z.object({
  channel: z.enum(["log", "webhook"]),
  event: z.enum(["up", "down", "both"]),
  webhookUrl: z.string().url().refine(value => ["http:", "https:"].includes(new URL(value).protocol), "Разрешены только HTTP и HTTPS").optional(),
});

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await monitorService.listMonitors(req.userId!));
  } catch (err) {
    next(err);
  }
});

router.post("/", validateBody(createMonitorSchema), async (req: AuthedRequest, res, next) => {
  try {
    const monitor = await monitorService.createMonitor(req.userId!, req.body);
    res.status(201).json(monitor);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await monitorService.getOwnedMonitor(req.userId!, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", validateBody(updateMonitorSchema), async (req: AuthedRequest, res, next) => {
  try {
    res.json(await monitorService.updateMonitor(req.userId!, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    await monitorService.deleteMonitor(req.userId!, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get("/:id/checks", validateQuery(paginationSchema), async (req: AuthedRequest, res, next) => {
  try {
    await monitorService.getOwnedMonitor(req.userId!, req.params.id);
    const { page, pageSize } = (req as any).validatedQuery;
    res.json(await checkService.listChecks(req.params.id, page, pageSize));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/uptime", validateQuery(uptimeQuerySchema), async (req: AuthedRequest, res, next) => {
  try {
    await monitorService.getOwnedMonitor(req.userId!, req.params.id);
    const { from, to } = (req as any).validatedQuery;
    const rangeTo = to ?? new Date();
    const rangeFrom = from ?? new Date(rangeTo.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (rangeFrom > rangeTo) return res.status(400).json({ error: "from должен быть не позже to" });
    res.json(await uptimeService.getUptime(req.params.id, rangeFrom, rangeTo));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/notifications", async (req: AuthedRequest, res, next) => {
  try {
    await monitorService.getOwnedMonitor(req.userId!, req.params.id);
    res.json(await notificationService.listNotifications(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/notifications", validateBody(notificationSchema), async (req: AuthedRequest, res, next) => {
  try {
    await monitorService.getOwnedMonitor(req.userId!, req.params.id);
    const notification = await notificationService.createNotification(req.params.id, req.body);
    res.status(201).json(notification);
  } catch (err) {
    next(err);
  }
});

export default router;

