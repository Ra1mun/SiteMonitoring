import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthedRequest } from "../types";

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Отсутствует токен авторизации" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { userId: string };
    if (
      typeof payload !== "object" ||
      typeof payload.userId !== "string" ||
      !payload.userId
    ) {
      return res.status(401).json({ error: "Недействительный токен" });
    }
    req.userId = payload.userId;
    next();
  } catch {
    return res
      .status(401)
      .json({ error: "Недействительный или истёкший токен" });
  }
}
