
export const safeUrl = (u?: string | null) =>
  u && /^https?:\/\/\S+$/i.test(u) ? u : "https://example.com/no-image.jpg";
