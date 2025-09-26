import { RequestHandler } from "express";
import prisma from "../config/prisma";
import { fetchRecommendationsFromOpenAI } from "../services/openaiService";
import { saveRecommendation } from "../services/saveRecommendationService";
import { buildProfileVersionData, mergeProfileForJourney } from "../services/profileVersionService";
import { enhanceImagesInBackground } from "../services/backgroundImageEnhancer";

// Extend Express Request type to include 'user'
declare global {
  namespace Express {
    interface Request {
      user?: {
        id?: number;
        email?: string;
      };
    }
  }
}

export const createJourney: RequestHandler = async (req, res, next) => {
  try {
    const authUser = req.user as { id?: number; email?: string };
    const { label, selectedState, selectedCity, inputs } = req.body || {};

    if (!authUser?.id) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

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

export const runJourney: RequestHandler = async (req, res, next) => {
  const startTime = Date.now();
  console.log('\n' + '='.repeat(60));
  console.log('🚀 JOURNEY START');
  console.log('='.repeat(60));
  
  try {
    const authUser = req.user as { id?: number };
    const journeyId = Number(req.params.id);

    console.log(`📋 Journey ID: ${journeyId}`);
    console.log(`👤 User ID: ${authUser.id}`);

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
    console.log('✅ Journey status → RUNNING');

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
    console.log('✅ Profile version saved');

    // ✅ FASE 1: OpenAI + imágenes críticas
    const openaiStart = Date.now();
    console.log('\n' + '─'.repeat(60));
    console.log('🤖 FASE 1: Generating recommendation with OpenAI...');
    console.log('─'.repeat(60));
    
    const reco = await fetchRecommendationsFromOpenAI(mergedProfile);
    
    const openaiDuration = ((Date.now() - openaiStart) / 1000).toFixed(1);
    console.log(`✅ OpenAI completed in ${openaiDuration}s`);
    
    // ✅ Guardar
    const saveStart = Date.now();
    console.log('💾 Saving to database...');
    const saved = await saveRecommendation(reco, authUser.id!, journey.id);
    const saveDuration = ((Date.now() - saveStart) / 1000).toFixed(1);
    console.log(`✅ Saved in ${saveDuration}s (Recommendation ID: ${saved.id})`);

    await prisma.journey.update({
      where: { id: journey.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    console.log('✅ Journey status → COMPLETED');

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log(`🎉 JOURNEY COMPLETED in ${totalDuration}s`);
    console.log('='.repeat(60));

    // ✅ RESPONDER INMEDIATAMENTE
    res.status(200).json({
      success: true,
      message: "Journey completed with priority images. Full gallery loading in background.",
      journeyId: journey.id,
      recommendationId: saved.id,
      timing: {
        openai: `${openaiDuration}s`,
        save: `${saveDuration}s`,
        total: `${totalDuration}s`
      }
    });

    // 🔥 FASES 2 y 3: Background
    console.log('\n' + '─'.repeat(60));
    console.log('🖼️ Starting background enhancement (phases 2-3)...');
    console.log('─'.repeat(60));
    
    // CRÍTICO: Envolver en setImmediate para asegurar que corre DESPUÉS de responder
    setImmediate(() => {
      enhanceImagesInBackground(saved.id, journey.userId)
        .then(() => {
          console.log('✅ Background enhancement finished successfully');
        })
        .catch(err => {
          console.error('❌ Background enhancement failed:');
          console.error(err);
        });
    });

  } catch (err) {
    const errorDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error('\n' + '='.repeat(60));
    console.error(`❌ JOURNEY FAILED after ${errorDuration}s`);
    console.error('='.repeat(60));
    console.error(err);
    next(err);
  }
};

export const listJourneys: RequestHandler = async (req, res, next) => {
  try {
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

export const getJourney: RequestHandler = async (req, res, next) => {
  try {
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