// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

import { OsuFileParser } from '../parser/osuFileParser'
import { NoteType, createEmptyRow, isRowEmpty } from './types'
import type { NoteRow, InterludeRowsResult } from './types'
import type { ParsedBeatmap } from '../parser/types'

type CvtFlag = 'IN' | 'HO' | null

function normalizeCvtFlag(cvtFlag: string | null | undefined): CvtFlag {
  const normalized = String(cvtFlag || '').trim().toUpperCase()
  if (normalized === 'IN' || normalized === 'HO') {
    return normalized
  }
  return null
}

function setNoteType(row: number[], key: number, noteType: number): void {
  if (!Array.isArray(row) || key < 0 || key >= row.length) {
    return
  }

  if (row[key] === NoteType.NOTHING) {
    row[key] = noteType
  }
}

function getOrCreateRow(rowMap: Map<number, number[]>, keyCount: number, time: number): number[] {
  if (!rowMap.has(time)) {
    rowMap.set(time, createEmptyRow(keyCount))
  }
  return rowMap.get(time)!
}

function applyConversionFlag(parser: OsuFileParser, cvtFlag: CvtFlag): void {
  if (cvtFlag === 'IN') {
    parser.modIN()
  } else if (cvtFlag === 'HO') {
    parser.modHO()
  }
}

interface HoldSpan {
  key: number
  startTime: number
  endTime: number
}

function buildRowsFromParsed(parsed: ParsedBeatmap): NoteRow[] {
  const keyCount = Number(parsed?.columnCount) || 0
  if (keyCount < 3 || keyCount > 10) {
    return []
  }

  const columns = Array.isArray(parsed?.columns) ? parsed.columns : []
  const noteStarts = Array.isArray(parsed?.noteStarts) ? parsed.noteStarts : []
  const noteEnds = Array.isArray(parsed?.noteEnds) ? parsed.noteEnds : []
  const noteTypes = Array.isArray(parsed?.noteTypes) ? parsed.noteTypes : []

  const rowMap = new Map<number, number[]>()
  const holdSpans: HoldSpan[] = []

  for (let i = 0; i < columns.length; i += 1) {
    const key = Number(columns[i])
    const startTime = Number(noteStarts[i])
    const endTime = Number(noteEnds[i])
    const rawType = Number(noteTypes[i]) || 0
    const isLongNote = (rawType & 128) !== 0

    if (!Number.isFinite(key) || key < 0 || key >= keyCount || !Number.isFinite(startTime)) {
      continue
    }

    const startRow = getOrCreateRow(rowMap, keyCount, startTime)
    if (isLongNote) {
      setNoteType(startRow, key, NoteType.HOLDHEAD)

      if (Number.isFinite(endTime) && endTime > startTime) {
        const endRow = getOrCreateRow(rowMap, keyCount, endTime)
        setNoteType(endRow, key, NoteType.HOLDTAIL)
        holdSpans.push({ key, startTime, endTime })
      }
    } else {
      setNoteType(startRow, key, NoteType.NORMAL)
    }
  }

  const sortedTimes = Array.from(rowMap.keys()).sort((a, b) => a - b)

  for (let i = 0; i < holdSpans.length; i += 1) {
    const { key, startTime, endTime } = holdSpans[i]
    for (let t = 0; t < sortedTimes.length; t += 1) {
      const time = sortedTimes[t]
      if (time <= startTime || time >= endTime) {
        continue
      }
      const row = rowMap.get(time)!
      if (row[key] === NoteType.NOTHING) {
        row[key] = NoteType.HOLDBODY
      }
    }
  }

  return sortedTimes
    .map((time) => ({
      time,
      data: rowMap.get(time)!,
    }))
    .filter((row) => !isRowEmpty(row.data))
}

/**
 * Build interlude note rows from osu text content.
 * `source` is the raw .osu file text.
 * `cvtFlag` optionally applies IN (inverse) or HO (hold-off) conversion.
 */
export function buildInterludeRows(source: string, cvtFlag: string | null = null): InterludeRowsResult {
  const parser = new OsuFileParser(source)
  parser.process()

  applyConversionFlag(parser, normalizeCvtFlag(cvtFlag))

  const parsed = parser.getParsedData()
  if (parsed.status === 'NotMania') {
    throw new Error('Beatmap mode is not mania')
  }
  if (parsed.status === 'Fail') {
    throw new Error('Beatmap parse failed')
  }

  return {
    keyCount: Number(parsed.columnCount) || 0,
    rows: buildRowsFromParsed(parsed),
  }
}
