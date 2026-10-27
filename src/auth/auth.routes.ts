import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import * as authService from "./auth.service";

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов"),
});

router.post("/register", validateBody(credentialsSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.register(email, password);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/login", validateBody(credentialsSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
