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
} from "../controllers/recommendationController";

const router = express.Router();

router.get("/areas/:userId/:journeyId", fetchRecommendedAreas);
router.get("/properties/:userId/:journeyId", fetchProperties);
router.get("/schools/:userId/:journeyId", fetchSchools);
router.get("/race-ethnicity/:userId/:journeyId", fetchRaceEthnicity);
router.get("/income-levels/:userId/:journeyId", fetchIncomeLevels);
router.get("/crime-data/:userId/:journeyId", fetchCrimeData);
router.get("/property-suggestion/:userId/:journeyId", fetchPropertySuggestion);

// 👇 esta es la que te marcaba error — ahora matchea RequestHandler
router.get("/full/:email/:journeyId", fetchFullRecommendation);

export default router;
