// ============================================================
// GENESIS INTELLIGENCE — Module Index
// The self-learning African content intelligence brain
// ============================================================

export {
  fetchPostInsights,
  fetchAllPageInsights,
  calculatePerformanceScore,
  getPerformanceTier,
  recordPostForLearning,
  logFeedbackEvent,
  getTokenForPage,
} from "./fb-insights-fetcher";

export {
  analyzeTopicPerformance,
  analyzeBestPostingTime,
  analyzeBestDay,
  analyzeVideoLength,
  analyzeMusicPerformance,
  analyzeHookPerformance,
  extractViralFormula,
  detectTrendingPatterns,
  runFullAnalysis,
  getAllActivePageIds,
} from "./analyzer";

export {
  applyIntelligenceToProduction,
  getPageIntelligenceSummary,
} from "./decision-engine";

export {
  selectBestTopic,
} from "./topic-selector";
