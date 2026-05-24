// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

import { buildInterludeRows } from './chartBuilder'
import { calculateInterludeDifficulty } from './difficulty'

function normalizeRate(rate: number): number {
  const value = Number(rate)
  if (!Number.isFinite(value) || value <= 0) {
    return 1.0
  }
  return value
}

// Single public entry point for Interlude SR calculation.
// `source` is the raw .osu file text content.
export function calculateInterludeStar(source: string, rate = 1.0, cvtFlag: string | null = null): number {
  const resolvedRate = normalizeRate(rate)
  const { rows } = buildInterludeRows(source, cvtFlag)
  const difficulty = calculateInterludeDifficulty(resolvedRate, rows)
  const overall = Number(difficulty?.overall)
  return Number.isFinite(overall) ? overall : 0.0
}

export default calculateInterludeStar

// Re-export sub-modules for granular access
export { buildInterludeRows } from './chartBuilder'
export { calculateInterludeDifficulty, weightedOverallDifficulty } from './difficulty'
export { calculateNoteRatings, noteDifficultyTotal } from './noteDifficulty'
export { calculateFingerStrains, calculateHandStrains } from './strain'
export { calculateVariety } from './variety'
export { keysOnLeftHand } from './layout'
export { f32, roundToEven } from './numberUtils'
export { NoteType, createEmptyRow, isPlayableNoteType, isRowEmpty } from './types'
export type {
  NoteRow,
  NoteDifficultyItem,
  FingerStrainRow,
  HandStrainRow,
  InterludeDifficultyResult,
  InterludeRowsResult,
} from './types'
