// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

export { runAzusaEstimatorFromText } from './azusaEstimator'
export { runDanielEstimatorFromText } from './danielEstimator'
export {
  composeDifficultyFromRcLn,
  isDanielTooLowDifficulty,
  runMixedEstimatorFromText,
  applyCompanellaToMixedResult,
} from './mixedEstimator'
export { runSunnyEstimatorFromText } from './sunnyEstimator'
export { estDiff, estimateDanielDan, normalizeReworkResult } from './reworkEstimatorUtils'
export { DAN_INDEX } from './intervals/index'
export type {
  AzusaDebugInfo,
  AzusaErrorResult,
  AzusaEstimatorOptions,
  AzusaEstimatorResult,
  BlendDetails,
  CompanellaPlan,
  CurveHints,
  DanIndex,
  DanielDanResult,
  DifficultyCurve,
  DifficultyInterval,
  EstimatorOptions,
  EstimatorResult,
  KeyIntervalTables,
  MixedEstimatorResult,
  TapNote,
} from './types'
