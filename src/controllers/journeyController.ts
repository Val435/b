import { RequestHandler } from "express";
import prisma from "../config/prisma";
import { fetchRecommendationsFromOpenAI } from "../services/openaiService";
import { saveRecommendation } from "../services/saveRecommendationService";
import { buildProfileVersionData, mergeProfileForJourney } from "../services/profileVersionService";
import { enhanceImagesInBackground } from "../services/backgroundImageEnhancer";
/**
 * Crea un Journey en estado PENDING.
 * Calcula un index incremental (1..N) por usuario.
 */
export const createJourney: RequestHandler = async (req, res, next) => {
  try {
    // @ts-ignore – agregado por verifyToken
    const authUser = req.user as { id?: number; email?: string };
    const { label, selectedState, selectedCity, inputs } = req.body || {};

    if (!authUser?.id) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    // index incremental por usuario
    const last = await prisma.journey.findFirst({
      where: { userId: authUser.id },
      orderBy: { createdAt: "desc" },
      select: { index: true },
    });
    const nextIndex = (last?.index ?? 0) + 1;

    const journey = await prisma.journey.create({
      data: {
        userId: authUser.id,
        label: label ?? null,
        selectedState: selectedState ?? null,
        selectedCity: selectedCity ?? null,
        inputs: inputs ?? null,
        index: nextIndex,
       
      },
      select: {
        id: true,
        label: true,
        selectedState: true,
        selectedCity: true,
        status: true,
        index: true,
        createdAt: true,
      },
    });

    res.status(201).json({ success: true, journey });
  } catch (err) {
    next(err);
  }
};

/**
 * Ejecuta un Journey:
 * - Pone RUNNING
 * - Llama a OpenAI + guarda recommendation ligada a journeyId
 * - Pone COMPLETED (o CANCELLED si falla)
 */

// ...

export const runJourney: RequestHandler = async (req, res, next) => {
  try {
    // @ts-ignore
    const authUser = req.user as { id?: number };
    const journeyId = Number(req.params.id);

    const journey = await prisma.journey.findUnique({ where: { id: journeyId } });
    if (!journey || journey.userId !== authUser.id) {
      res.status(404).json({ success: false, error: "Journey not found" });
      return;
    }

    const running = await prisma.journey.findFirst({
      where: { userId: authUser.id, status: "RUNNING" },
    });
    if (running && running.id !== journey.id) {
      res.status(409).json({ success: false, error: "Another journey is running for this user" });
      return;
    }

    await prisma.journey.update({
      where: { id: journey.id },
      data: { status: "RUNNING" },
    });

    const user = await prisma.user.findUnique({ where: { id: authUser.id } });
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    const mergedProfile = mergeProfileForJourney(user, journey);
    const versionData = buildProfileVersionData(user.id, journey.id, mergedProfile);
    await prisma.userProfileVersion.upsert({
      where: { journeyId: journey.id },
      update: versionData,
      create: versionData,
    });

    // ✅ Obtener recomendación CON imágenes críticas (2-3 min)
    console.log('🤖 Generating recommendation with critical images...');
    const reco = await fetchRecommendationsFromOpenAI(mergedProfile);
    
    // ✅ Guardar
    const saved = await saveRecommendation(reco, authUser.id!, journey.id);

    await prisma.journey.update({
      where: { id: journey.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    // ✅ RESPONDER INMEDIATAMENTE (imágenes críticas ya incluidas)
    res.status(200).json({
      success: true,
      message: "Journey completed with priority images. Full gallery loading in background.",
      journeyId: journey.id,
      recommendationId: saved.id,
    });

    // 🔥 Background: completar el resto (fases 2 y 3)
    console.log('🖼️ Starting background enhancement (phases 2-3)...');
    enhanceImagesInBackground(saved.id, journey.userId).catch(err => {
      console.error('❌ Background enhancement failed:', err);
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Lista journeys del usuario autenticado, ordenados desc.
 * Devuelve un payload amigable para el front.
 */
export const listJourneys: RequestHandler = async (req, res, next) => {
  try {
    // @ts-ignore – agregado por verifyToken
    const authUser = req.user as { id?: number };
    if (!authUser?.id) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const journeys = await prisma.journey.findMany({
      where: { userId: authUser.id },
      orderBy: { createdAt: "desc" },
      include: {
        recommendation: { select: { id: true, createdAt: true } },
      },
    });

    const data = journeys.map((j) => ({
      id: j.id,
      label: j.label,
      selectedState: j.selectedState,
      selectedCity: j.selectedCity,
      status: j.status,
      index: j.index,
      createdAt: j.createdAt,
      recommendationId: j.recommendation?.id ?? null,
      recommendationCreatedAt: j.recommendation?.createdAt ?? null,
    }));

    res.status(200).json({ success: true, journeys: data });
  } catch (err) {
    next(err);
  }
};

/**
 * Obtiene un journey puntual del usuario autenticado.
 */
export const getJourney: RequestHandler = async (req, res, next) => {
  try {
    // @ts-ignore – agregado por verifyToken
    const authUser = req.user as { id?: number };
    const journeyId = Number(req.params.id);

    if (!authUser?.id) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    if (!Number.isFinite(journeyId)) {
      res.status(400).json({ success: false, error: "Invalid journey id" });
      return;
    }

    const journey = await prisma.journey.findFirst({
      where: { id: journeyId, userId: authUser.id },
      include: {
        recommendation: { select: { id: true, createdAt: true } },
      },
    });

    if (!journey) {
      res.status(404).json({ success: false, error: "Journey not found" });
      return;
    }

    const data = {
      id: journey.id,
      label: journey.label,
      selectedState: journey.selectedState,
      selectedCity: journey.selectedCity,
      status: journey.status,
      index: journey.index,
      createdAt: journey.createdAt,
      recommendationId: journey.recommendation?.id ?? null,
      recommendationCreatedAt: journey.recommendation?.createdAt ?? null,
    };

    res.status(200).json({ success: true, journey: data });
  } catch (err) {
    next(err);
  }
};
