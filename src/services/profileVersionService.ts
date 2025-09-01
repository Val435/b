type AnyRec = Record<string, any>;

function toStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (v == null || v === "") return [];
  return [String(v)];
}

/** Construye un objeto con *todos* los campos normalizados para guardar en UserProfileVersion */
export function buildProfileVersionData(userId: number, journeyId: number, profile: AnyRec) {
  const p = profile || {};

  const toInt = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };

  return {
    userId,
    journeyId,
    name: p.name ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    countryCode: p.countryCode ?? null,
    state: p.state ?? null,
    city: toStringArray(p.city),

    environment: p.environment ?? null,
    education1: toStringArray(p.education1),
    education2: toStringArray(p.education2),
    family: toStringArray(p.family),
    employment1: toStringArray(p.employment1),
    employment2: toStringArray(p.employment2),
    socialLife: toStringArray(p.socialLife),
    hobbies: toStringArray(p.hobbies),
    transportation: toStringArray(p.transportation),
    pets: toStringArray(p.pets),
    greenSpace: toStringArray(p.greenSpace),
    shopping: toStringArray(p.shopping),
    restaurants: toStringArray(p.restaurants),

    occupancy: p.occupancy ?? null,
    property: p.property ?? null,
    timeframe: p.timeframe ?? null,
    priceRange: p.priceRange ?? null,
    downPayment: p.downPayment ?? null,
    employmentStatus: p.employmentStatus ?? null,
    grossAnnual: toInt(p.grossAnnual),
    credit: p.credit ?? null,
  };
}

/**
 * Fusiona: base(User) + selectedState/selectedCities del Journey + inputs.userProfile
 * Este “mergedProfile” es el que usarás:
 *   1) para crear el UserProfileVersion
 *   2) para llamar a OpenAI
 */
export function mergeProfileForJourney(base: AnyRec, journey: AnyRec) {
  const inputs = (journey?.inputs as AnyRec) || {};
  const inUserProfile = (inputs.userProfile as AnyRec) || {};

  const merged: AnyRec = {
    ...base,
    ...inUserProfile,
  };

  if (journey?.selectedState != null) merged.state = journey.selectedState;
  if (Array.isArray(journey?.selectedCities) && journey.selectedCities.length > 0) {
    merged.city = journey.selectedCities;
  }
  return merged;
}
