// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

import { PATTERNS_CONFIG } from './config'
import { calculatePrimitives } from './primitives'
import { CorePattern } from './types'
import type { Chart, PrimitiveRow, FoundPattern, CorePatternName, SpecificPatterns, SpecificPatternFn } from './types'
import {
  CORE_CHORDSTREAM,
  CORE_COORDINATION,
  CORE_DENSITY,
  CORE_JACKS,
  CORE_STREAM,
  CORE_WILDCARD,
  SPECIFIC_4K,
  SPECIFIC_7K,
  SPECIFIC_OTHER,
} from './patternsDef'

function pickSpecificFirst(specificList: [string, SpecificPatternFn][], remaining: PrimitiveRow[]): [number, string] | null {
  for (const [name, p] of specificList) {
    const n = p(remaining)
    if (n !== 0) return [n, name]
  }
  return null
}

function pickSpecificAll(specificList: [string, SpecificPatternFn][], remaining: PrimitiveRow[]): [number, string][] {
  const matched: [number, string][] = []
  for (const [name, p] of specificList) {
    const n = p(remaining)
    if (n !== 0) matched.push([n, name])
  }
  return matched
}

function resolvedMspb(pattern: CorePatternName, specificType: string | null, meanMspb: number): number {
  if (pattern === CorePattern.Density && specificType === 'Inverse') {
    return 0.0
  }
  return meanMspb
}

function appendFoundPattern(
  results: FoundPattern[],
  pattern: CorePatternName,
  specificType: string | null,
  n2: number,
  remaining: PrimitiveRow[],
  lastNote: number,
): void {
  const d = remaining.slice(0, n2)
  const meanMspb = d.reduce((sum, x) => sum + x.MsPerBeat, 0) / d.length
  const mixed = !d.every((x) => Math.abs(x.MsPerBeat - meanMspb) < PATTERNS_CONFIG.PATTERN_STABILITY_THRESHOLD)

  const start = remaining[0].Time
  let end: number

  if (pattern === CorePattern.Jacks) {
    const endCandidate = n2 < remaining.length ? remaining[n2].Time : lastNote
    end = Math.max(remaining[0].Time + remaining[0].MsPerBeat * 0.5, endCandidate)
  } else {
    end = n2 < remaining.length ? remaining[n2].Time : lastNote
  }

  results.push({
    Pattern: pattern,
    SpecificType: specificType,
    Mixed: mixed,
    Start: start,
    End: end,
    MsPerBeat: resolvedMspb(pattern, specificType, meanMspb),
  })
}

function appendCoreMatches(
  results: FoundPattern[],
  pattern: CorePatternName,
  coreN: number,
  specificList: [string, SpecificPatternFn][],
  remaining: PrimitiveRow[],
  lastNote: number,
): void {
  if (coreN === 0) return

  if (PATTERNS_CONFIG.ENABLE_MULTI_LABEL_SAME_WINDOW) {
    const matched = pickSpecificAll(specificList, remaining)
    if (!matched.length) {
      appendFoundPattern(results, pattern, null, coreN, remaining, lastNote)
      return
    }

    for (const [m, specificType] of matched) {
      appendFoundPattern(results, pattern, specificType, Math.max(coreN, m), remaining, lastNote)
    }
    return
  }

  const picked = pickSpecificFirst(specificList, remaining)
  if (picked == null) {
    appendFoundPattern(results, pattern, null, coreN, remaining, lastNote)
    return
  }

  const [m, specificType] = picked
  appendFoundPattern(results, pattern, specificType, Math.max(coreN, m), remaining, lastNote)
}

function matches(specificPatterns: SpecificPatterns, lastNote: number, primitives: PrimitiveRow[]): FoundPattern[] {
  let remaining = [...primitives]
  const results: FoundPattern[] = []

  while (remaining.length > 0) {
    appendCoreMatches(results, CorePattern.Stream, CORE_STREAM(remaining), specificPatterns.Stream, remaining, lastNote)
    appendCoreMatches(results, CorePattern.Chordstream, CORE_CHORDSTREAM(remaining), specificPatterns.Chordstream, remaining, lastNote)
    appendCoreMatches(results, CorePattern.Jacks, CORE_JACKS(remaining), specificPatterns.Jack, remaining, lastNote)
    appendCoreMatches(results, CorePattern.Coordination, CORE_COORDINATION(remaining), specificPatterns.Coordination, remaining, lastNote)
    appendCoreMatches(results, CorePattern.Density, CORE_DENSITY(remaining), specificPatterns.Density, remaining, lastNote)
    appendCoreMatches(results, CorePattern.Wildcard, CORE_WILDCARD(remaining), specificPatterns.Wildcard, remaining, lastNote)

    remaining = remaining.slice(1)
  }

  return results
}

export function find(chart: Chart): FoundPattern[] {
  const primitives = calculatePrimitives(chart)
  let keymodePatterns: SpecificPatterns

  if (chart.Keys === 4) keymodePatterns = SPECIFIC_4K()
  else if (chart.Keys === 7) keymodePatterns = SPECIFIC_7K()
  else keymodePatterns = SPECIFIC_OTHER()

  return matches(keymodePatterns, chart.LastNote - chart.FirstNote, primitives)
}