// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

export interface PatternsConfig {
  CORE_RATING_MULTIPLIER: Record<string, number>
  SUBTYPE_RATING_MULTIPLIER_BY_MODE: Record<string, Record<string, number>>
  RC_CORE_LN_SCALE: number
  RC_LN_CORE_SCALE: number
  RELEASE_WITH_DW_MULTIPLIER: number
  LN_MODE_LOW_THRESHOLD: number
  LN_MODE_HIGH_THRESHOLD: number
  HB_ROW_RATIO_THRESHOLD: number
  BPM_CLUSTER_THRESHOLD: number
  PATTERN_STABILITY_THRESHOLD: number
  IMPORTANT_CLUSTER_RATIO: number
  CATEGORY_JS_HS_SECONDARY_RATIO: number
  SV_AMOUNT_THRESHOLD: number
  SV_SPEED_EPS: number
  SV_EXTREME_BPM_MIN: number
  SV_EXTREME_BPM_MAX: number
  SV_EXTREME_BPM_RATIO: number
  LONGJACK_VIBRO_RATIO_THRESHOLD: number
  LONGJACK_VIBRO_MIN_BPM: number
  CLUSTER_SPECIFIC_NAME_MIN_RATIO: number
  ENABLE_MULTI_LABEL_SAME_WINDOW: boolean
  COORDINATION_SPECIFIC_ORDER: string[]
  DENSITY_SPECIFIC_ORDER: string[]
  WILDCARD_SPECIFIC_ORDER: string[]
  JACKY_MIN_BPM: number
  SHIELD_MAX_BEAT_RATIO: number
  INVERSE_GAP_TOLERANCE_MS: number
  INVERSE_MIN_FILLED_LANES: number
  RELEASE_SCAN_ROWS: number
  RELEASE_MIN_TAIL_ROWS: number
  RELEASE_ROLL_POINTS: number
  RELEASE_FULL_MATCH_ROWS: number
  JACKY_CONTEXT_WINDOW: number
  JACKY_FALLBACK_MAX_MSPB: number
}

const RC_SUBTYPE_BASE: Record<string, number> = {
  Rolls: 1.0 / 3.0,
  Trills: 1.0 / 3.0,
  Minitrills: 1.0 / 3.0,
  Handstream: 0.65,
  'Split Trill': 0.65,
  Jumptrill: 0.65,
  Jumpstream: 0.65,
  Brackets: 0.65,
  'Double Stream': 0.65,
  'Dense Chordstream': 0.65,
  'Light Chordstream': 0.65,
  'Chord Rolls': 0.65,
  Longjacks: 0.9,
  Quadstream: 0.9,
  Gluts: 0.9,
  Chordjacks: 0.9,
  Minijacks: 0.9,
}

const LN_SUBTYPE_BASE: Record<string, number> = {
  'Column Lock': 1.5,
  Release: 0.73,
  Shield: 0.8,
  'JS Density': 1.0,
  'HS Density': 1.0,
  'DS Density': 1.0,
  'LCS Density': 1.0,
  'DCS Density': 1.0,
  Inverse: 1.5,
  'Jacky WC': 0.55,
  'Speedy WC': 0.8,
}

export const PATTERNS_CONFIG: PatternsConfig = {
  CORE_RATING_MULTIPLIER: {
    Stream: 1.0 / 3.0,
    Chordstream: 0.65,
    Jacks: 0.9,
    Coordination: 0.75,
    Density: 0.9,
    Wildcard: 1.0,
  },
  SUBTYPE_RATING_MULTIPLIER_BY_MODE: {
    RC: {
      ...RC_SUBTYPE_BASE,
      ...LN_SUBTYPE_BASE,
    },
    LN: {
      ...RC_SUBTYPE_BASE,
      'Column Lock': 1.5,
      Release: 1.0,
      Shield: 0.8,
      'JS Density': 0.9,
      'HS Density': 0.9,
      'DS Density': 0.9,
      'LCS Density': 0.9,
      'DCS Density': 0.9,
      Inverse: 1.5,
      'Jacky WC': 0.55,
      'Speedy WC': 0.8,
    },
    HB: {
      ...RC_SUBTYPE_BASE,
      'Column Lock': 1.5,
      Release: 0.3,
      Shield: 0.8,
      'JS Density': 0.9,
      'HS Density': 0.9,
      'DS Density': 0.9,
      'LCS Density': 0.9,
      'DCS Density': 0.9,
      Inverse: 0.0,
      'Jacky WC': 0.65,
      'Speedy WC': 0.45,
    },
    Mix: {
      ...RC_SUBTYPE_BASE,
      'Column Lock': 1.5,
      Release: 0.3,
      Shield: 0.8,
      'JS Density': 0.9,
      'HS Density': 0.9,
      'DS Density': 0.9,
      'LCS Density': 0.9,
      'DCS Density': 0.9,
      Inverse: 0.0,
      'Jacky WC': 0.45,
      'Speedy WC': 0.45,
    },
  },
  RC_CORE_LN_SCALE: 0.3,
  RC_LN_CORE_SCALE: 0.0,
  RELEASE_WITH_DW_MULTIPLIER: 0.8,
  LN_MODE_LOW_THRESHOLD: 0.15,
  LN_MODE_HIGH_THRESHOLD: 0.9,
  HB_ROW_RATIO_THRESHOLD: 0.1,
  BPM_CLUSTER_THRESHOLD: 5.0,
  PATTERN_STABILITY_THRESHOLD: 5.0,
  IMPORTANT_CLUSTER_RATIO: 0.5,
  CATEGORY_JS_HS_SECONDARY_RATIO: 0.4,
  SV_AMOUNT_THRESHOLD: 2000.0,
  SV_SPEED_EPS: 0.05,
  SV_EXTREME_BPM_MIN: 20.0,
  SV_EXTREME_BPM_MAX: 450.0,
  SV_EXTREME_BPM_RATIO: 4.0,
  LONGJACK_VIBRO_RATIO_THRESHOLD: 0.6,
  LONGJACK_VIBRO_MIN_BPM: 180,
  CLUSTER_SPECIFIC_NAME_MIN_RATIO: 0.0,
  ENABLE_MULTI_LABEL_SAME_WINDOW: true,
  COORDINATION_SPECIFIC_ORDER: ['Column Lock', 'Shield', 'Release'],
  DENSITY_SPECIFIC_ORDER: ['Inverse', 'JS Density', 'HS Density', 'DS Density', 'DCS Density', 'LCS Density'],
  WILDCARD_SPECIFIC_ORDER: ['Speedy WC', 'Jacky WC'],
  JACKY_MIN_BPM: 90.0,
  SHIELD_MAX_BEAT_RATIO: 0.25,
  INVERSE_GAP_TOLERANCE_MS: 5.0,
  INVERSE_MIN_FILLED_LANES: 3,
  RELEASE_SCAN_ROWS: 4,
  RELEASE_MIN_TAIL_ROWS: 4,
  RELEASE_ROLL_POINTS: 2,
  RELEASE_FULL_MATCH_ROWS: 5,
  JACKY_CONTEXT_WINDOW: 6,
  JACKY_FALLBACK_MAX_MSPB: 185.0,
}
