// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

import type { Chart, TimeItem, BPM } from '../parser/types'
import { NoteType } from '../parser/types'

// Re-export shared types from parser
export { NoteType }
export type { Chart, TimeItem, BPM }

// ─── Direction enum ──────────────────────────────────────────────────────────

export const Direction = {
  NONE: 'None',
  LEFT: 'Left',
  RIGHT: 'Right',
  OUTWARDS: 'Outwards',
  INWARDS: 'Inwards',
} as const

export type Direction = (typeof Direction)[keyof typeof Direction]

// ─── Core pattern names ──────────────────────────────────────────────────────

export const CorePattern = {
  Stream: 'Stream',
  Chordstream: 'Chordstream',
  Jacks: 'Jacks',
  Coordination: 'Coordination',
  Density: 'Density',
  Wildcard: 'Wildcard',
} as const

export type CorePatternName = (typeof CorePattern)[keyof typeof CorePattern]

// ─── Mode tags ───────────────────────────────────────────────────────────────

export type ModeTag = 'RC' | 'LN' | 'HB' | 'Mix'

// ─── Primitive row (output of calculatePrimitives) ───────────────────────────

export interface PrimitiveRow {
  Index: number
  Time: number
  MsPerBeat: number
  BeatLength: number
  Notes: number
  Jacks: number
  Direction: Direction
  Roll: boolean
  Keys: number
  LeftHandKeys: number
  LNHeads: number[]
  LNBodies: number[]
  LNTails: number[]
  NormalNotes: number[]
  RawNotes: number[]
}

// ─── Found pattern (output of findPatterns) ──────────────────────────────────

export interface FoundPattern {
  Pattern: CorePatternName
  SpecificType: string | null
  Mixed: boolean
  Start: number
  End: number
  MsPerBeat: number
}

// ─── Cluster (output of clustering) ─────────────────────────────────────────

export interface PatternCluster {
  Pattern: CorePatternName
  SpecificTypes: [string, number][]
  RatingMultiplier: number
  BPM: number
  Mixed: boolean
  Amount: number
  readonly Importance: number
  format(rate?: number): string
}

// ─── Pattern report (output of summary) ─────────────────────────────────────

export interface PatternReport {
  Clusters: PatternCluster[]
  Category: string
  LNPercent: number
  HBRowRatio: number
  ModeTag: ModeTag
  SVAmount: number
  Duration: number
  readonly ImportantClusters: PatternCluster[]
}

// ─── Specific pattern function type ─────────────────────────────────────────

export type SpecificPatternFn = (xs: PrimitiveRow[]) => number

// ─── Specific patterns map ──────────────────────────────────────────────────

export interface SpecificPatterns {
  Stream: [string, SpecificPatternFn][]
  Chordstream: [string, SpecificPatternFn][]
  Jack: [string, SpecificPatternFn][]
  Coordination: [string, SpecificPatternFn][]
  Density: [string, SpecificPatternFn][]
  Wildcard: [string, SpecificPatternFn][]
}

// ─── Clustering options ─────────────────────────────────────────────────────

export interface ClusteringOptions {
  modeTag?: ModeTag
}

// ─── Analysis result ─────────────────────────────────────────────────────────

export interface PatternAnalysisResult {
  report: PatternReport
  topFiveClusters: PatternCluster[]
}

// ─── Helper factories ────────────────────────────────────────────────────────

export function createTimeItem<T>(time: number, data: T): TimeItem<T> {
  return { Time: Number(time), Data: data }
}

export function createBPM(meter: number, msPerBeat: number): BPM {
  return { Meter: meter, MsPerBeat: msPerBeat }
}

export function createChart(keys: number, notes: TimeItem<NoteType[]>[], bpm: TimeItem<BPM>[], sv: TimeItem<number>[]): Chart {
  return {
    Keys: keys,
    Notes: notes,
    BPM: bpm,
    SV: sv,
    get FirstNote(): number {
      return this.Notes[0].Time
    },
    get LastNote(): number {
      return this.Notes[this.Notes.length - 1].Time
    },
  }
}
