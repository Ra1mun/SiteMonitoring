const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: unknown) => ({ "application/json": { schema } });
const response = (schema: unknown, description = "Успешный ответ") => ({ description, content: json(schema) });
const id = { name: "id", in: "path", required: true, schema: { type: "string" } };
const body = (schema: unknown) => ({ required: true, content: json(schema) });
const array = (name: string) => ({ type: "array", items: ref(name) });
const operation = (summary: string, schema: unknown, extra = {}, status = "200") => ({
  summary, security: [{ bearerAuth: [] }],
  responses: { [status]: response(schema), "400": response(ref("Error")), "401": response(ref("Error")), "404": response(ref("Error")) }, ...extra,
});
const string = { type: "string" };
const integer = { type: "integer" };
const date = { type: "string", format: "date-time" };
const boolean = { type: "boolean" };
const monitorProperties = {
  name: { type: "string", minLength: 1 }, url: { type: "string", format: "uri", description: "HTTP или HTTPS" },
  intervalSeconds: { type: "integer", minimum: 5, maximum: 86400, default: 60 }, isActive: { type: "boolean", default: true },
};
export const openapi = {
  openapi: "3.0.3", info: { title: "Site Monitoring API", version: "1.0.0", description: "Мониторинг сайтов. Зарегистрируйтесь и укажите JWT в Authorize." },
  paths: {
    "/health": { get: { summary: "Проверка работы HTTP-сервера", responses: { "200": response({ type: "object", properties: { status: string } }) } } },
    ...Object.fromEntries(["register", "login"].map(action => [`/api/auth/${action}`, { post: {
      summary: action === "register" ? "Регистрация" : "Вход", requestBody: body(ref("Credentials")),
      responses: { [action === "register" ? "201" : "200"]: response(ref("AuthResult")), "400": response(ref("Error")), "401": response(ref("Error")), "409": response(ref("Error")) },
    } }])),
    "/api/monitors": {
      get: operation("Мониторы текущего пользователя", array("Monitor")),
      post: operation("Создать монитор", ref("Monitor"), { requestBody: body(ref("MonitorInput")) }, "201"),
    },
    "/api/monitors/{id}": { parameters: [id],
      get: operation("Получить монитор", ref("Monitor")),
      put: operation("Обновить указанные поля монитора", ref("Monitor"), { requestBody: body({ type: "object", properties: monitorProperties }) }),
      delete: { summary: "Удалить монитор и его историю", security: [{ bearerAuth: [] }], responses: { "204": { description: "Удалено" }, "401": response(ref("Error")), "404": response(ref("Error")) } },
    },
    "/api/monitors/{id}/checks": { parameters: [id], get: operation("История: новые проверки первыми", ref("CheckPage"), { parameters: [
      { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
      { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
    ] }) },
    "/api/monitors/{id}/uptime": { parameters: [id], get: operation("Доля успешных проверок за период (по умолчанию 30 дней)", ref("Uptime"), { parameters: ["from", "to"].map(name => ({ name, in: "query", schema: date })) }) },
    "/api/monitors/{id}/notifications": { parameters: [id],
      get: operation("Правила уведомлений", array("Notification")),
      post: operation("Добавить правило уведомления", ref("Notification"), { requestBody: body(ref("NotificationInput")) }, "201"),
    },
    "/api/notifications/{id}": { parameters: [id], delete: { summary: "Удалить правило уведомления", security: [{ bearerAuth: [] }], responses: { "204": { description: "Удалено" }, "401": response(ref("Error")), "404": response(ref("Error")) } } },
  },
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Error: { type: "object", properties: { error: string, details: { type: "object" } } },
      Credentials: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", minLength: 8, example: "demo-password" } } },
      AuthResult: { type: "object", properties: { token: string, user: { type: "object", properties: { id: string, email: string } } } },
      MonitorInput: { type: "object", required: ["name", "url"], properties: monitorProperties },
      Monitor: { type: "object", properties: { ...monitorProperties, id: string, userId: string, lastStatus: { type: "string", nullable: true, enum: ["up", "down", null] }, lastCheckedAt: { ...date, nullable: true }, nextCheckAt: date, createdAt: date, updatedAt: date } },
      Check: { type: "object", properties: { id: string, monitorId: string, checkedAt: date, statusCode: { ...integer, nullable: true }, responseTimeMs: { ...integer, nullable: true }, responseSizeBytes: { ...integer, nullable: true }, isUp: boolean, error: { ...string, nullable: true } } },
      CheckPage: { type: "object", properties: { data: array("Check"), page: integer, pageSize: integer, total: integer, totalPages: integer } },
      Uptime: { type: "object", properties: { monitorId: string, from: date, to: date, totalChecks: integer, upChecks: integer, uptimePercentage: { type: "number", nullable: true, description: "100 * upChecks / totalChecks; null, если проверок нет" } } },
      NotificationInput: { type: "object", required: ["channel", "event"], properties: { channel: { type: "string", enum: ["log", "webhook"] }, event: { type: "string", enum: ["up", "down", "both"] }, webhookUrl: { type: "string", format: "uri", description: "Обязателен для webhook; HTTP(S)" } } },
      Notification: { allOf: [ref("NotificationInput"), { type: "object", properties: { id: string, monitorId: string, isActive: boolean, createdAt: date } }] },
    },
  },
};
