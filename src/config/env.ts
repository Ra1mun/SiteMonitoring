import "dotenv/config";

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} должен быть положительным целым числом`);
  return value;
}
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("Отсутствует JWT_SECRET");
export const env = {
  port: positiveInteger("PORT", 3000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  schedulerTickMs: positiveInteger("SCHEDULER_TICK_MS", 10000),
  checkConcurrency: positiveInteger("CHECK_CONCURRENCY", 10),
  httpCheckTimeoutMs: positiveInteger("HTTP_CHECK_TIMEOUT_MS", 10000),
  batchSize: positiveInteger("BATCH_SIZE", 100),
  webHookTimeout: positiveInteger("WEBHOOK_TIMEOUT_MS", 5000),
};
