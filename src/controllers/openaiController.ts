import { Request, Response, NextFunction } from "express";
import { fetchRecommendationsFromOpenAI } from "../services/openaiService";
import { saveRecommendation } from "../services/saveRecommendationService";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log("📩 [Controller] Body recibido:", JSON.stringify(req.body, null, 2));
    const userProfile = req.body.userProfile;


     console.log("🔎 [Controller] Buscando usuario por email:", userProfile.email);
    const user = await prisma.user.findUnique({
      where: { email: userProfile.email },
    });

    if (!user) {
      res.status(404).json({ error: "User not found by email" });
      return;
    }

    const recommendations = await fetchRecommendationsFromOpenAI(userProfile);

    const saved = await saveRecommendation(recommendations, user.id, );

    res.status(200).json({ message: "Recommendation saved", data: saved });
  } catch (error) {
    next(error);
  }
};
