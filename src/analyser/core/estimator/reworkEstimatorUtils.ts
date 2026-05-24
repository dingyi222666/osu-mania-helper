// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

import { DAN_INDEX } from './intervals/index'
import type { DanielDanResult, DifficultyInterval, EstimatorResult } from './types'
import type { DifficultyGraph } from '../rework/types'

const DAN_MEANS: [number, string][] = [
  [6.562, 'Alpha'],
  [6.957, 'Beta'],
  [7.459, 'Gamma'],
  [7.939, 'Delta'],
  [9.095, 'Epsilon'],
  [9.473, 'Emik Zeta'],
  [10.162, 'Thaumiel Eta'],
  [10.782, 'CloverWisp Theta'],
]

const DAN_ORDER_START = 11

function precomputeDanBoundaries(): [number, number][] {
  const means = DAN_MEANS.map(([mean]) => mean)
  const boundaries: [number, number][] = []

  for (let i = 0; i < DAN_MEANS.length; i += 1) {
    const mean = means[i]
    const lower = i > 0
      ? (means[i - 1] + mean) / 2
      : mean - (((means[1] + mean) / 2) - mean)
    const upper = i < means.length - 1
      ? (mean + means[i + 1]) / 2
      : mean + ((mean - means[i - 1]) / 2)
    boundaries.push([lower, upper])
  }

  return boundaries
}

const DAN_BOUNDARIES = precomputeDanBoundaries()

export function estimateDanielDan(sr: number): DanielDanResult {
  if (!Number.isFinite(sr)) {
    return {
      label: 'Unknown',
      numeric: null,
    }
  }

  if (sr < DAN_BOUNDARIES[0][0]) {
    return {
      label: `< ${DAN_MEANS[0][1]} Low`,
      numeric: null,
    }
  }

  if (sr >= DAN_BOUNDARIES[DAN_BOUNDARIES.length - 1][1]) {
    return {
      label: `> ${DAN_MEANS[DAN_MEANS.length - 1][1]} High`,
      numeric: null,
    }
  }

  for (let i = 0; i < DAN_MEANS.length; i += 1) {
    const [lower, upper] = DAN_BOUNDARIES[i]
    if (sr >= lower && sr < upper) {
      const tRaw = (sr - lower) / (upper - lower)
      const t = Math.max(0, Math.min(tRaw, 1))
      const numeric = Number((DAN_ORDER_START + i + t).toFixed(2))

      let label: string
      if (t < 1 / 3) {
        label = `${DAN_MEANS[i][1]} Low`
      } else if (t < 2 / 3) {
        label = `${DAN_MEANS[i][1]} Mid`
      } else {
        label = `${DAN_MEANS[i][1]} High`
      }

      return {
        label,
        numeric,
      }
    }
  }

  return {
    label: 'Unknown',
    numeric: null,
  }
}

function intervalLookup(sr: number, table: DifficultyInterval[], _fallbackLabel: string): string {
  for (const [lower, upper, name] of table) {
    if (lower <= sr && sr <= upper) return name
  }
  if (sr < table[0][0]) return `< ${table[0][2]}`
  if (sr > table[table.length - 1][1]) return `> ${table[table.length - 1][2]}`
  return _fallbackLabel
}

export function estDiff(sr: number, lnRatio: number, columnCount: number): string {
  const keys = DAN_INDEX[columnCount]
  if (!keys) return 'Unknown difficulty'

  const rcTable = keys.RC[Object.keys(keys.RC)[0]] ?? keys.RC.default
  const rcDiff = intervalLookup(sr, rcTable, 'Unknown RC difficulty')
  if (lnRatio < 0.15) return rcDiff

  const lnTable = keys.LN[Object.keys(keys.LN)[0]] ?? keys.LN.default
  const lnDiff = intervalLookup(sr, lnTable, 'Unknown LN difficulty')
  return `${rcDiff} || ${lnDiff}`
}

interface NormalizedResult {
  star: number
  lnRatio: number
  columnCount: number
  graph: DifficultyGraph | null
}

export function normalizeReworkResult(result: unknown): NormalizedResult {
  if (typeof result === 'number') {
    if (result === -1) {
      throw new Error('Beatmap parse failed')
    }
    if (result === -2) {
      throw new Error('Beatmap mode is not mania')
    }
    throw new Error(`Unknown result code: ${result}`)
  }

  let sr: number
  let lnRatio: number
  let columnCount: number
  let graph: DifficultyGraph | null = null

  if (Array.isArray(result)) {
    [sr, lnRatio, columnCount] = result
  } else if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>
    sr = Number(obj.star)
    lnRatio = Number(obj.lnRatio)
    columnCount = Number(obj.columnCount)
    graph = obj.graph && typeof obj.graph === 'object' ? obj.graph as DifficultyGraph : null
  } else {
    throw new Error('Unexpected calculation result format')
  }

  if (!Number.isFinite(sr) || !Number.isFinite(lnRatio) || !Number.isFinite(columnCount)) {
    throw new Error('Invalid estimator output')
  }

  return {
    star: sr,
    lnRatio,
    columnCount,
    graph,
  }
}