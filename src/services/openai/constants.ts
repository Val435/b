export const PREFERRED_HOSTS = [
  "upload.wikimedia.org",
  "images.unsplash.com",
  "cdn.pixabay.com",
  "lh3.googleusercontent.com",
];

export const FALLBACKS = {
  school:   "https://cdn.pixabay.com/photo/2016/11/21/16/36/school-1844439_1280.jpg",
  social:   "https://cdn.pixabay.com/photo/2016/11/29/12/35/club-1867421_1280.jpg",
  shopping: "https://cdn.pixabay.com/photo/2016/10/30/05/26/mall-1786475_1280.jpg",
  greens:   "https://cdn.pixabay.com/photo/2016/07/27/05/19/park-1544552_1280.jpg",
  sports:   "https://cdn.pixabay.com/photo/2016/11/29/09/08/sport-1867161_1280.jpg",
  property: "https://cdn.pixabay.com/photo/2016/08/26/15/06/house-1622401_1280.jpg",
  area:     "https://cdn.pixabay.com/photo/2016/11/29/04/28/architecture-1868667_1280.jpg",
};

export const RESIDENTIAL_TYPES = [
  "single_family","condo","condominium","townhouse",
  "apartment","duplex","triplex","loft",
  "bungalow","cottage","multi_family",
  "manufactured","mobile_home","rowhouse"
] as const;

export const COMMERCIAL_HINTS =
  /(commercial|retail|office|warehouse|industrial|chamber of commerce|bookkeeping|business(es)?|suite\s*#?\d+|unit\s*\d+|mall|plaza|center|company|inc\b|llc\b)/i;

export function ensurePreferred(url: string | undefined, type: keyof typeof FALLBACKS) {
  if (!url) return FALLBACKS[type];
  const u = url.trim();
  const isDirectFile   = /^https:\/\/\S+\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(u);
  const isUnsplashRaw  = /^https:\/\/images\.unsplash\.com\/.*[?&]fm=(jpg|jpeg|png|webp)\b/i.test(u);
  const isGooglePhotos = /^https:\/\/lh3\.googleusercontent\.com\/.+/i.test(u);
  return (isDirectFile || isUnsplashRaw || isGooglePhotos) ? u : FALLBACKS[type];
}
