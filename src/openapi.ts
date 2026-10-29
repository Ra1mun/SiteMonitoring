const schemaReference = (name: string) => ({
  $ref: `#/components/schemas/${name}`,
});
const jsonContent = (schema: unknown) => ({ "application/json": { schema } });
const jsonResponse = (schema: unknown, description = "Успешный ответ") => ({
  description,
  content: jsonContent(schema),
});
const monitorIdParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
};
const requestBody = (schema: unknown) => ({
  required: true,
  content: jsonContent(schema),
});
const schemaArray = (name: string) => ({
  type: "array",
  items: schemaReference(name),
});
const authenticatedOperation = (
  summary: string,
  schema: unknown,
  extra = {},
  status = "200",
) => ({
  summary,
  security: [{ bearerAuth: [] }],
  responses: {
    [status]: jsonResponse(schema),
    "400": jsonResponse(schemaReference("Error")),
    "401": jsonResponse(schemaReference("Error")),
    "404": jsonResponse(schemaReference("Error")),
  },
  ...extra,
});
const stringSchema = { type: "string" };
const integerSchema = { type: "integer" };
const dateTimeSchema = { type: "string", format: "date-time" };
const booleanSchema = { type: "boolean" };
const monitorProperties = {
  name: { type: "string", minLength: 1 },
  url: { type: "string", format: "uri", description: "HTTP или HTTPS" },
  intervalSeconds: { type: "integer", minimum: 5, maximum: 86400, default: 60 },
  isActive: { type: "boolean", default: true },
};
export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Site Monitoring API",
    version: "1.0.0",
    description:
      "Мониторинг сайтов. Зарегистрируйтесь и укажите JWT в Authorize.",
  },
  paths: {
    "/health": {
      get: {
        summary: "Проверка работы HTTP-сервера",
        responses: {
          "200": jsonResponse({
            type: "object",
            properties: { status: stringSchema },
          }),
        },
      },
    },
    ...Object.fromEntries(
      ["register", "login"].map((action) => [
        `/api/auth/${action}`,
        {
          post: {
            summary: action === "register" ? "Регистрация" : "Вход",
            requestBody: requestBody(schemaReference("Credentials")),
            responses: {
              [action === "register" ? "201" : "200"]: jsonResponse(
                schemaReference("AuthResult"),
              ),
              "400": jsonResponse(schemaReference("Error")),
              "401": jsonResponse(schemaReference("Error")),
              "409": jsonResponse(schemaReference("Error")),
            },
          },
        },
      ]),
    ),
    "/api/monitors": {
      get: authenticatedOperation(
        "Мониторы текущего пользователя",
        schemaArray("Monitor"),
      ),
      post: authenticatedOperation(
        "Создать монитор",
        schemaReference("Monitor"),
        { requestBody: requestBody(schemaReference("MonitorInput")) },
        "201",
      ),
    },
    "/api/monitors/{id}": {
      parameters: [monitorIdParameter],
      get: authenticatedOperation(
        "Получить монитор",
        schemaReference("Monitor"),
      ),
      put: authenticatedOperation(
        "Обновить указанные поля монитора",
        schemaReference("Monitor"),
        {
          requestBody: requestBody({
            type: "object",
            properties: monitorProperties,
          }),
        },
      ),
      delete: {
        summary: "Удалить монитор и его историю",
        security: [{ bearerAuth: [] }],
        responses: {
          "204": { description: "Удалено" },
          "401": jsonResponse(schemaReference("Error")),
          "404": jsonResponse(schemaReference("Error")),
        },
      },
    },
    "/api/monitors/{id}/checks": {
      parameters: [monitorIdParameter],
      get: authenticatedOperation(
        "История: новые проверки первыми",
        schemaReference("CheckPage"),
        {
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer", minimum: 1, default: 1 },
            },
            {
              name: "pageSize",
              in: "query",
              schema: {
                type: "integer",
                minimum: 1,
                maximum: 100,
                default: 20,
              },
            },
          ],
        },
      ),
    },
    "/api/monitors/{id}/uptime": {
      parameters: [monitorIdParameter],
      get: authenticatedOperation(
        "Доля успешных проверок за период (по умолчанию 30 дней)",
        schemaReference("Uptime"),
        {
          parameters: ["from", "to"].map((name) => ({
            name,
            in: "query",
            schema: dateTimeSchema,
          })),
        },
      ),
    },
    "/api/monitors/{id}/notifications": {
      parameters: [monitorIdParameter],
      get: authenticatedOperation(
        "Правила уведомлений",
        schemaArray("Notification"),
      ),
      post: authenticatedOperation(
        "Добавить правило уведомления",
        schemaReference("Notification"),
        { requestBody: requestBody(schemaReference("NotificationInput")) },
        "201",
      ),
    },
    "/api/notifications/{id}": {
      parameters: [monitorIdParameter],
      delete: {
        summary: "Удалить правило уведомления",
        security: [{ bearerAuth: [] }],
        responses: {
          "204": { description: "Удалено" },
          "401": jsonResponse(schemaReference("Error")),
          "404": jsonResponse(schemaReference("Error")),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: stringSchema, details: { type: "object" } },
      },
      Credentials: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8, example: "demo-password" },
        },
      },
      AuthResult: {
        type: "object",
        properties: {
          token: stringSchema,
          user: {
            type: "object",
            properties: { id: stringSchema, email: stringSchema },
          },
        },
      },
      MonitorInput: {
        type: "object",
        required: ["name", "url"],
        properties: monitorProperties,
      },
      Monitor: {
        type: "object",
        properties: {
          ...monitorProperties,
          id: stringSchema,
          userId: stringSchema,
          lastStatus: {
            type: "string",
            nullable: true,
            enum: ["up", "down", null],
          },
          lastCheckedAt: { ...dateTimeSchema, nullable: true },
          nextCheckAt: dateTimeSchema,
          createdAt: dateTimeSchema,
          updatedAt: dateTimeSchema,
        },
      },
      Check: {
        type: "object",
        properties: {
          id: stringSchema,
          monitorId: stringSchema,
          checkedAt: dateTimeSchema,
          statusCode: { ...integerSchema, nullable: true },
          responseTimeMs: { ...integerSchema, nullable: true },
          responseSizeBytes: { ...integerSchema, nullable: true },
          isUp: booleanSchema,
          error: { ...stringSchema, nullable: true },
        },
      },
      CheckPage: {
        type: "object",
        properties: {
          data: schemaArray("Check"),
          page: integerSchema,
          pageSize: integerSchema,
          total: integerSchema,
          totalPages: integerSchema,
        },
      },
      Uptime: {
        type: "object",
        properties: {
          monitorId: stringSchema,
          from: dateTimeSchema,
          to: dateTimeSchema,
          totalChecks: integerSchema,
          upChecks: integerSchema,
          uptimePercentage: {
            type: "number",
            nullable: true,
            description:
              "100 * upChecks / totalChecks; null, если проверок нет",
          },
        },
      },
      NotificationInput: {
        type: "object",
        required: ["channel", "event"],
        properties: {
          channel: { type: "string", enum: ["log", "webhook"] },
          event: { type: "string", enum: ["up", "down", "both"] },
          webhookUrl: {
            type: "string",
            format: "uri",
            description: "Обязателен для webhook; HTTP(S)",
          },
        },
      },
      Notification: {
        allOf: [
          schemaReference("NotificationInput"),
          {
            type: "object",
            properties: {
              id: stringSchema,
              monitorId: stringSchema,
              isActive: booleanSchema,
              createdAt: dateTimeSchema,
            },
          },
        ],
      },
    },
  },
};
