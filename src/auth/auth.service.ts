import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";

const SALT_ROUNDS = 10;

function signToken(userId: string): string {
  return jwt.sign({ userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}

export async function register(email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "Пользователь с таким email уже существует");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, password: passwordHash },
  });

  return {
    token: signToken(user.id),
    user: { id: user.id, email: user.email },
  };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpError(401, "Неверный email или пароль");
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new HttpError(401, "Неверный email или пароль");
  }

  return {
    token: signToken(user.id),
    user: { id: user.id, email: user.email },
  };
}
