// ============================================
// AFRICAN VOICE & NARRATION ENGINE
// Central export for all African content modules
// ============================================

export { applyPronunciationCorrections, PRONUNCIATION_CORRECTIONS } from "./pronunciation-guide";
export { formatScriptForTTS } from "./script-formatter";
export { validateAfricanScript } from "./script-validator";
export { getFallbackScript, FALLBACK_TEMPLATES } from "./fallback-scripts";
export {
  generateAfricanScript,
  buildAfricanScriptPrompt,
  AFRICAN_SCRIPT_RULES,
  languageToCountry,
} from "./script-generator";
export {
  getAfricanVoiceConfig,
  isAfricanLanguage,
  AFRICAN_VOICE_PARAMS,
} from "./voice-config";
export type { AfricanVoiceConfig } from "./voice-config";
export type { ValidationResult } from "./script-validator";
