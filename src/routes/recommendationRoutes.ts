import express from "express";
import {
  fetchRecommendedAreas,
  fetchProperties,
  fetchSchools,
  fetchRaceEthnicity,
  fetchIncomeLevels,
  fetchCrimeData,
  fetchPropertySuggestion,
  fetchFullRecommendation,
  fetchByJourney, // 👈 nuevo
} from "../controllers/recommendationController";
// opcional: si quieres proteger by-journey con auth
// import { verifyToken } from "../middlewares/verifyToken";

const router = express.Router();

// Si quieres que estes endpoints “legacy” ya SIEMPRE pidan journeyId, déjalos así.
// (Si quieres mantener compatibilidad vieja, haz el param opcional `:journeyId?`)
router.get("/areas/:userId/:journeyId", fetchRecommendedAreas);
router.get("/properties/:userId/:journeyId", fetchProperties);
router.get("/schools/:userId/:journeyId", fetchSchools);
router.get("/race-ethnicity/:userId/:journeyId", fetchRaceEthnicity);
router.get("/income-levels/:userId/:journeyId", fetchIncomeLevels);
router.get("/crime-data/:userId/:journeyId", fetchCrimeData);
router.get("/property-suggestion/:userId/:journeyId", fetchPropertySuggestion);

// full por email + journeyId (como ya lo tienes)
router.get("/full/:email/:journeyId", fetchFullRecommendation);

// ✅ NUEVO: obtener recomendación por journeyId directo (lo usa tu ResultScreen)
router.get(
  "/by-journey/:journeyId",
  // verifyToken, // opcional (recomendado en producción)
  fetchByJourney
);

export default router;
