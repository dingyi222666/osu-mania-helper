// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

// Public API
export { analyzePatternFromText } from './service'
export { fromChart } from './summary'
export { find } from './findPatterns'
export { calculateClusteredPatterns } from './clustering'
export { categoriseChart } from './categorise'
export { calculatePrimitives, detectDirection, lnPercent, svTime } from './primitives'
export { PATTERNS_CONFIG } from './config'
export {
  CORE_PATTERN_LIST,
  resolveRatingMultiplier,
  SPECIFIC_4K,
  SPECIFIC_7K,
  SPECIFIC_OTHER,
} from './patternsDef'

// Types
export { NoteType, CorePattern, Direction } from './types'
export type {
  Chart,
  TimeItem,
  BPM,
  ModeTag,
  CorePatternName,
  PrimitiveRow,
  FoundPattern,
  PatternCluster,
  PatternReport,
  SpecificPatternFn,
  SpecificPatterns,
  ClusteringOptions,
  PatternAnalysisResult,
} from './types'
export type { PatternsConfig } from './config'