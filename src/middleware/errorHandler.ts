import { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof SyntaxError && "status" in err && err.status === 400) {
    return res.status(400).json({ error: "Некорректный JSON" });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  logger.error("Необработанная ошибка", {
    error: err instanceof Error ? err.message : String(err),
  });
  return res.status(500).json({ error: "Внутренняя ошибка сервера" });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Маршрут не найден" });
}
