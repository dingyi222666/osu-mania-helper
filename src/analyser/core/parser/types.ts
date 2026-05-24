// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

// ─── NoteType enum ───────────────────────────────────────────────────────────

export const NoteType = {
  NOTHING: 0,
  NORMAL: 1,
  HOLDHEAD: 2,
  HOLDBODY: 3,
  HOLDTAIL: 4,
} as const

export type NoteType = (typeof NoteType)[keyof typeof NoteType]

// ─── Generic time-indexed item ───────────────────────────────────────────────

export interface TimeItem<T> {
  Time: number
  Data: T
}

// ─── BPM data ────────────────────────────────────────────────────────────────

export interface BPM {
  Meter: number
  MsPerBeat: number
}

// ─── Chart (output of patternOsuParser) ──────────────────────────────────────

export interface Chart {
  Keys: number
  Notes: TimeItem<NoteType[]>[]
  BPM: TimeItem<BPM>[]
  SV: TimeItem<number>[]
  readonly FirstNote: number
  readonly LastNote: number
}

// ─── OsuFileParser types ─────────────────────────────────────────────────────

export type ParserStatus = 'init' | 'OK' | 'Fail' | 'NotMania'

export interface ParsedBeatmap {
  columnCount: number
  columns: number[]
  noteStarts: number[]
  noteEnds: number[]
  noteTypes: number[]
  od: number
  gameMode: string | null
  status: ParserStatus
  lnRatio: number
  metaData: Record<string, string>
  breaks: [number, number][]
  objectIntervals: [number, number][]
}

/** Column index -> sorted array of note start times */
export type NoteTimes = Record<number, number[]>

// ─── patternOsuParser internal types ─────────────────────────────────────────

export interface UninheritedTimingPoint {
  kind: 'Uninherited'
  Time: number
  MsPerBeat: number
  Meter: number
}

export interface InheritedTimingPoint {
  kind: 'Inherited'
  Time: number
  Multiplier: number
}

export type TimingPoint = UninheritedTimingPoint | InheritedTimingPoint

export interface HitCircleObject {
  kind: 'HitCircle'
  X: number
  Time: number
}

export interface HoldObject {
  kind: 'Hold'
  X: number
  Time: number
  EndTime: number
}

export type HitObject = HitCircleObject | HoldObject
