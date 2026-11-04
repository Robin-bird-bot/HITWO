/**
 * The rules engine (Phase 1 builds it).
 *
 * - Pure TypeScript: no React, no DOM and no Math.random. ESLint enforces this.
 * - The whole game is one serializable GameState, and every change goes
 *   through applyAction(state, action) => state.
 * - All randomness comes from a seeded RNG stored in the state.
 * - Every tunable number comes from src/config/balance.ts.
 *
 * See CLAUDE.md, "Architecture rules".
 */
export {};
