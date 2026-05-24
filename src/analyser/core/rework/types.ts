// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

/** Graph data for difficulty over time */
export interface DifficultyGraph {
  times: number[]
  values: number[]
}

/** Result returned by rework algorithms when withGraph is true */
export interface ReworkResultObject {
  star: number
  lnRatio: number
  columnCount: number
  graph: DifficultyGraph
}

/** Result returned by rework algorithms (array form) */
export type ReworkResultArray = [star: number, lnRatio: number, columnCount: number]

/** Union of all possible rework calculation results */
export type ReworkResult = ReworkResultObject | ReworkResultArray | number

/** Options for the Sunny algorithm */
export interface SunnyCalculateOptions {
  withGraph?: boolean
}

/** Options for the Daniel algorithm */
export interface DanielCalculateOptions {
  withGraph?: boolean
}

/** Preprocessed file data shared between algorithms */
export interface PreprocessedData {
  status: 'OK' | 'Fail' | 'NotMania'
  x: number
  K: number
  T: number
  noteSeq: NoteEntry[]
  noteSeqByColumn: NoteEntry[][]
  lnSeq: NoteEntry[]
  tailSeq: NoteEntry[]
  lnSeqByColumn: NoteEntry[][]
  lnRatio: number
  columnCount: number
}

/** Daniel preprocessed data (no LN info) */
export interface DanielPreprocessedData {
  status: 'OK' | 'Fail' | 'NotMania' | 'UnsupportedKeys'
  x: number
  K: number
  T: number
  noteSeq: DanielNoteEntry[]
  noteSeqByColumn: DanielNoteEntry[][]
  lnRatio: number
  columnCount: number
}

/** A note entry: [column, headTime, tailTime] where tailTime < 0 means no LN */
export type NoteEntry = [column: number, head: number, tail: number]

/** Daniel note entry: [column, headTime] (no tail info) */
export type DanielNoteEntry = [column: number, head: number]

/** Corners structure used in difficulty computation */
export interface Corners {
  allCorners: number[]
  baseCorners: number[]
  ACorners: number[]
}

/** LN sparse representation for efficient range queries */
export interface LnSparseRepresentation {
  points: number[]
  cumsum: number[]
  values: number[]
}
