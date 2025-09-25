import { RequestHandler } from "express";
import { fetchRecommendationsFromOpenAI } from "../services/openaiService";
import { saveRecommendation } from "../services/saveRecommendationService";
import { PrismaClient } from "@prisma/client";
import { buildProfileVersionData, mergeProfileForJourney } from "../services/profileVersionService";
import { recordRecommendationDuration } from "../utils/recommendationMetrics";

const prisma = new PrismaClient();

export const getRecommendations: RequestHandler = async (req, res, next) => {
  try {
    const { userProfile, journeySnapshot } = req.body || {};

    if (!userProfile?.email) {
      res.status(400).json({ error: "userProfile.email is required" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: userProfile.email } });
    if (!user) {
      res.status(404).json({ error: "User not found by email" });
      return;
    }

    const startTime = process.hrtime.bigint();

    const journey = await prisma.journey.create({
      data: {
        userId: user.id,
        label: journeySnapshot?.label ?? "First journey",
        selectedState: journeySnapshot?.selectedState ?? userProfile.state ?? null,
        selectedCity: journeySnapshot?.selectedCity ?? userProfile.city ?? null,
        inputs: journeySnapshot?.inputs ?? { userProfile },
        status: "RUNNING",
      },
      select: { id: true, selectedState: true, selectedCity: true, inputs: true },
    });

    // Fusionar perfil efectivo: base(user) + snapshot enviado
    const base = user;
    const pseudoJourney = {
      selectedState: journey.selectedState,
      selectedCity: journey.selectedCity,
      inputs: { userProfile }, // lo que enviaste
    };
    const mergedProfile = mergeProfileForJourney(base, pseudoJourney);

    // Guardar versión
    const versionData = buildProfileVersionData(user.id, journey.id, mergedProfile);
    await prisma.userProfileVersion.create({ data: versionData });

    // OpenAI + guardar reco
    const reco = await fetchRecommendationsFromOpenAI(mergedProfile);
    const saved = await saveRecommendation(reco, user.id, journey.id);

    await prisma.journey.update({
      where: { id: journey.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    recordRecommendationDuration(durationMs);

    res.status(200).json({
      message: "Recommendation saved",
      data: saved,
      journeyId: journey.id,
    });
  } catch (err) {
    next(err);
  }
};