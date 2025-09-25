let lastDurationMs: number | null = null;
let lastCompletedAt: Date | null = null;

function formatSeconds(ms: number): string {
  return (ms / 1000).toFixed(2);
}

export function recordRecommendationDuration(durationMs: number) {
  lastDurationMs = durationMs;
  lastCompletedAt = new Date();

  const seconds = formatSeconds(durationMs);
  // eslint-disable-next-line no-console
  console.log(`[Recommendation] Completed in ${seconds}s (${durationMs.toFixed(0)} ms)`);
}

export function getLastRecommendationMetrics() {
  if (lastDurationMs === null || lastCompletedAt === null) {
    return null;
  }

  return {
    durationMs: lastDurationMs,
    completedAt: lastCompletedAt,
  };
}

export function getLastRecommendationSummary() {
  const metrics = getLastRecommendationMetrics();
  if (!metrics) {
    return "No recommendation generated yet";
  }

  const seconds = formatSeconds(metrics.durationMs);
  return `${seconds}s (completed at ${metrics.completedAt.toISOString()})`;
}
