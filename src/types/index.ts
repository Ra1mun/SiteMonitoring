import type { Request } from "express";

export interface AuthedRequest extends Request {
  userId?: string;
}

export type NotificationChannel = "log" | "webhook";
export type NotificationEvent = "up" | "down" | "both";
export type MonitorStatus = "up" | "down";
