// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

// Re-export NoteType from the shared parser types
export { NoteType } from '../parser/types'
export type { NoteType as NoteTypeValue } from '../parser/types'

// ─── NoteRow ─────────────────────────────────────────────────────────────────

export interface NoteRow {
  time: number
  data: number[]
}

// ─── NoteDifficulty per-note rating ──────────────────────────────────────────

export interface NoteDifficultyItem {
  J: number
  SL: number
  SR: number
  Total: number
}

// ─── Strain output per row ───────────────────────────────────────────────────

export interface FingerStrainRow {
  NotesV1: number[]
  StrainV1Notes: number[]
}

// ─── Hand strain output per row ──────────────────────────────────────────────

export interface HandStrainRow {
  Strains: number[]
  Left: [number, number]
  Right: [number, number]
}

// ─── Interlude difficulty result ─────────────────────────────────────────────

export interface InterludeDifficultyResult {
  noteDifficulty: NoteDifficultyItem[][]
  strains: FingerStrainRow[]
  variety: number[]
  hands: HandStrainRow[]
  overall: number
}

// ─── Build result ────────────────────────────────────────────────────────────

export interface InterludeRowsResult {
  keyCount: number
  rows: NoteRow[]
}

// ─── Helper functions ────────────────────────────────────────────────────────

import { NoteType } from '../parser/types'

export function createEmptyRow(keyCount: number): number[] {
  return new Array(keyCount).fill(NoteType.NOTHING)
}

export function isPlayableNoteType(noteType: number): boolean {
  return noteType === NoteType.NORMAL || noteType === NoteType.HOLDHEAD
}

export function isRowEmpty(row: number[]): boolean {
  for (let i = 0; i < row.length; i += 1) {
    const noteType = row[i]
    if (noteType !== NoteType.NOTHING && noteType !== NoteType.HOLDBODY) {
      return false
    }
  }
  return true
}
