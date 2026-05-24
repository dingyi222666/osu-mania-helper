// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

import type { DifficultyGraph } from '../rework/types'

// ─── Interval table types ────────────────────────────────────────────────────

/** A difficulty interval: [lowerBound, upperBound, label] */
export type DifficultyInterval = [lower: number, upper: number, label: string]

/** Key-specific interval tables for RC and LN */
export interface KeyIntervalTables {
  RC: Record<string, DifficultyInterval[]>
  LN: Record<string, DifficultyInterval[]>
}

/** Dan index mapping column count to interval tables */
export type DanIndex = Record<number, KeyIntervalTables>

// ─── Estimator options ───────────────────────────────────────────────────────

export interface EstimatorOptions {
  speedRate?: number
  odFlag?: string | number | null
  cvtFlag?: string | null
  withGraph?: boolean
}

export interface AzusaEstimatorOptions extends EstimatorOptions {
  forceSunnyReferenceHo?: boolean
  precomputedDanielResult?: EstimatorResult | null
  precomputedSunnyResult?: EstimatorResult | null
}

// ─── Estimator results ───────────────────────────────────────────────────────

export interface EstimatorResult {
  star: number
  lnRatio: number
  columnCount: number
  estDiff: string
  numericDifficulty: number | null
  numericDifficultyHint: string | null
  graph?: DifficultyGraph | null
}

export interface AzusaEstimatorResult extends EstimatorResult {
  rawNumericDifficulty: number | null
  debug: AzusaDebugInfo
}

export interface AzusaDebugInfo {
  primaryNumeric: number | null
  blendNumeric: number | null
  danielNumeric: number | null
  danielNumericForBlend: number | null
  danielHasNativeNumeric: boolean
  sunnyNumeric: number | null
  notes: number
  calibratedNumeric: number | null
  curveStats: {
    anchorImbalance: number | null
    chordRate: number | null
    jackQ95: number | null
  }
  curveGapResidual: number | null
  outputNumeric: number | null
  postCurveGapResidual: number | null
  finalNumeric: number | null
  blend: {
    lowGateSource: string | null
    lowGate: string | null
    highGate: string | null
    lowBase: string | null
    highBase: string | null
  }
}

export interface AzusaErrorResult {
  star: number
  lnRatio: number
  columnCount: number
  estDiff: string
  numericDifficulty: null
  numericDifficultyHint: string
  graph: null
  rawNumericDifficulty: null
  debug: {
    code: string
    message: string
  }
}

// ─── Daniel dan estimation ───────────────────────────────────────────────────

export interface DanielDanResult {
  label: string
  numeric: number | null
}

// ─── Mixed estimator ─────────────────────────────────────────────────────────

export interface MixedEstimatorResult extends EstimatorResult {
  mixedCompanellaPlan: CompanellaPlan | null
}

export interface CompanellaPlan {
  lnRatio: number
  lnDifficulty: string
}

// ─── Blend details ───────────────────────────────────────────────────────────

export interface BlendDetails {
  value: number | null
  lowGateSource: number | null
  lowGate: number | null
  highGate: number | null
  lowBase: number | null
  highBase: number | null
}

// ─── Curve hints ─────────────────────────────────────────────────────────────

export interface CurveHints {
  anchorImbalance?: number | null
  chordRate?: number | null
  jackQ95?: number | null
}

// ─── Internal Azusa types ────────────────────────────────────────────────────

export interface TapNote {
  t: number
  c: number
  hand: number
  rowSize: number
}

export interface DifficultyCurve {
  local: number[]
  speedSeries: number[]
  staminaSeries: number[]
  chordSeries: number[]
  techSeries: number[]
  jackSeries: number[]
  times: number[]
  density250: number[]
  density500: number[]
  jackRawSeries: number[]
  columnCounts: number[]
  chordNoteCount: number
}
