import { Request, Response, NextFunction } from "express";
import { fetchRecommendationsFromOpenAI } from "../services/openaiService";
import { saveRecommendation } from "../services/saveRecommendationService";
import { PrismaClient, JourneyStatus } from "@prisma/client";

const prisma = new PrismaClient();

export const getRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log("📩 [Controller] Body recibido:", JSON.stringify(req.body, null, 2));
    const { userProfile } = req.body;

    // @ts-ignore
    const userId = req.user.id;

    const journey = await prisma.journey.create({
      data: {
        userId,
        status: JourneyStatus.RUNNING,
        selectedState: userProfile.selectedState ?? null,
        selectedCities: userProfile.selectedCities ?? [],
        inputs: userProfile,
      },
    });

    const recommendations = await fetchRecommendationsFromOpenAI(userProfile);

    const saved = await saveRecommendation(recommendations, userId, journey.id);

    await prisma.journey.update({
      where: { id: journey.id },
      data: { status: JourneyStatus.COMPLETED, completedAt: new Date() },
    });

    res.status(200).json({ message: "Recommendation saved", data: saved });
  } catch (error) {
    next(error);
  }
};
