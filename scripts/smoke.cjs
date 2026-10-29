const { spawnSync } = require("node:child_process");
const { createServer } = require("node:http");
const { once } = require("node:events");
const { randomUUID } = require("node:crypto");
const { rmSync, writeFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");
const db = path.resolve("prisma", `test-${randomUUID()}.db`);
Object.assign(process.env, {
  DATABASE_URL: `file:./${path.basename(db)}`,
  JWT_SECRET: "isolated-smoke-test-secret",
  SCHEDULER_TICK_MS: "50",
  HTTP_CHECK_TIMEOUT_MS: "1000",
  CHECK_CONCURRENCY: "2",
});
writeFileSync(db, "");
const migrated = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { env: process.env, encoding: "utf8" },
);
assert.equal(migrated.status, 0, migrated.stderr);
const { createApp } = require("../dist/app");
const { prisma } = require("../dist/lib/prisma");
const {
  startScheduler,
  stopScheduler,
} = require("../dist/scheduler/scheduler");
let status = 200;
const events = [];
const target = createServer((req, res) => {
  if (req.url === "/webhook") {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      events.push(JSON.parse(data));
      res.end("ok");
    });
  } else {
    res.writeHead(status);
    res.end("hello");
  }
});
const api = createApp().listen(0, "127.0.0.1");
async function waitFor(predicate) {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for background check");
}
(async () => {
  target.listen(0, "127.0.0.1");
  await once(target, "listening");
  if (!api.listening) await once(api, "listening");
  const base = `http://127.0.0.1:${api.address().port}`;
  const targetUrl = `http://127.0.0.1:${target.address().port}`;
  async function request(route, method = "GET", body, token, expected = 200) {
    const res = await fetch(base + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    assert.equal(res.status, expected, `${method} ${route}`);
    return res.status === 204 ? null : res.json();
  }
  assert.equal((await fetch(base + "/docs/")).status, 200);
  assert.equal((await request("/openapi.json")).openapi, "3.0.3");
  const credentials = { email: "demo@example.com", password: "demo-password" };
  const { token } = await request(
    "/api/auth/register",
    "POST",
    credentials,
    null,
    201,
  );
  await request("/api/auth/register", "POST", credentials, null, 409);
  await request("/api/auth/login", "POST", credentials);
  const other = await request(
    "/api/auth/register",
    "POST",
    { ...credentials, email: "other@example.com" },
    null,
    201,
  );
  await request("/api/monitors", "GET", null, null, 401);
  await request(
    "/api/monitors",
    "POST",
    { name: "Invalid", url: "ftp://example.com" },
    token,
    400,
  );
  const m = await request(
    "/api/monitors",
    "POST",
    { name: "Demo", url: targetUrl, intervalSeconds: 5 },
    token,
    201,
  );
  await request(`/api/monitors/${m.id}`, "GET", null, other.token, 404);
  await request(
    `/api/monitors/${m.id}/notifications`,
    "POST",
    { channel: "webhook", event: "both", webhookUrl: targetUrl + "/webhook" },
    token,
    201,
  );
  startScheduler();
  await waitFor(
    async () =>
      (await prisma.monitor.findUnique({ where: { id: m.id } })).lastStatus ===
      "up",
  );
  assert.equal(
    events.length,
    0,
    "Initial status must not trigger notification",
  );
  status = 503;
  await prisma.monitor.update({
    where: { id: m.id },
    data: { nextCheckAt: new Date() },
  });
  await waitFor(() => events.some((e) => e.status === "down"));
  status = 200;
  await prisma.monitor.update({
    where: { id: m.id },
    data: { nextCheckAt: new Date() },
  });
  await waitFor(() => events.some((e) => e.status === "up"));
  await request(`/api/monitors/${m.id}`, "PUT", { isActive: false }, token);
  await stopScheduler();
  const history = await request(
    `/api/monitors/${m.id}/checks?page=1&pageSize=2`,
    "GET",
    null,
    token,
  );
  assert.equal(history.total, 3);
  assert.equal(history.data.length, 2);
  assert.equal(history.totalPages, 2);
  assert.equal(history.data[0].responseSizeBytes, 5);
  const uptime = await request(
    `/api/monitors/${m.id}/uptime`,
    "GET",
    null,
    token,
  );
  assert.equal(uptime.uptimePercentage, 66.67);
  await request(
    `/api/monitors/${m.id}/uptime?from=2030-01-01&to=2020-01-01`,
    "GET",
    null,
    token,
    400,
  );
  await request(`/api/monitors/${m.id}`, "DELETE", null, token, 204);
  assert.equal(await prisma.check.count(), 0);
  assert.equal(await prisma.notification.count(), 0);
  console.log(
    "PASS: auth, ownership, validation, Swagger, scheduler, transitions, webhook, pagination, uptime, cascade delete",
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopScheduler();
    await Promise.all([
      new Promise((resolve) => api.close(resolve)),
      new Promise((resolve) => target.close(resolve)),
    ]);
    await prisma.$disconnect();
    for (const suffix of ["", "-journal", "-wal", "-shm"])
      rmSync(db + suffix, { force: true });
  });
