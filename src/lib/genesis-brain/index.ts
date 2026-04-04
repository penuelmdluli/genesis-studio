// ============================================
// GENESIS BRAIN — Module Exports
// ============================================

export { planProduction, calculateBrainCredits, estimateBrainCredits } from "./planner";
export { ConsistencyEngine, consistencyEngine } from "./consistency";
export { generateVoiceover, selectMusic, generateCaptions, AVAILABLE_VOICES, SUPPORTED_LANGUAGES } from "./audio";
export type { AudioResult, CaptionEntry } from "./audio";
export {
  createProduction,
  updateProduction,
  getProduction,
  getUserProductions,
  createProductionScenes,
  updateProductionScene,
  getProductionScenes,
  executeProduction,
  cancelProduction,
} from "./orchestrator";
