import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { AuthedRequest } from "../types";
import * as notificationService from "./notification.service";

const router = Router();
router.use(requireAuth);

router.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    await notificationService.deleteNotification(req.userId!, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
