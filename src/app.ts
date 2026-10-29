import swaggerUi from "swagger-ui-express";
import { openapi } from "./openapi";
import express from "express";
import authRoutes from "./auth/auth.routes";
import monitorRoutes from "./monitors/monitor.routes";
import notificationRoutes from "./notifications/notification.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.get("/openapi.json", (_req, res) => res.json(openapi));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/monitors", monitorRoutes);
  app.use("/api/notifications", notificationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
