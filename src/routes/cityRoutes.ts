import { Router } from "express";
import { getCities } from "../controllers/cityController";

const router = Router();
router.get("/cities", getCities);

export default router;