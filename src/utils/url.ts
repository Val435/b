
export const safeUrl = (u?: string | null) =>
  u && /^https?:\/\/\S+$/i.test(u)
    ? u
    : "https://placehold.co/600x400?text=No+Image"; 
