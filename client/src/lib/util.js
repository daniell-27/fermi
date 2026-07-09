// Client-side id generator for blocks and formula tokens (these live inside a
// model's JSON; MongoDB assigns the top-level document ids).
export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
