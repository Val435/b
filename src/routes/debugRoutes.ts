import { Router } from "express";
import { testJsonParsing, getSystemInfo } from "../controllers/debugController";

const router = Router();

// Debug routes - only available in development
if (process.env.NODE_ENV !== 'production') {
  router.post("/test-json", testJsonParsing);
  router.get("/system-info", getSystemInfo);
}

export default router;