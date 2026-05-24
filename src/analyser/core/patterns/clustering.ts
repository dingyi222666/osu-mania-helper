// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

import { PATTERNS_CONFIG } from './config'
import { resolveRatingMultiplier } from './patternsDef'
import type { FoundPattern, PatternCluster, ClusteringOptions, CorePatternName, ModeTag } from './types'

interface ClusterBuilder {
  SumMs: number
  OriginalMsPerBeat: number
  Count: number
  BPM: number | null
  add(v: number): void
  calculate(): void
  readonly Value: number | null
}

function patternAmount(sortedStartsEnds: [number, number][]): number {
  let totalTime = 0
  let [currentStart, currentEnd] = sortedStartsEnds[0]

  for (const [start, end] of sortedStartsEnds) {
    if (currentEnd < end) {
      totalTime += (currentEnd - currentStart)
      currentStart = start
      currentEnd = end
    } else {
      currentEnd = Math.max(currentEnd, end)
    }
  }

  totalTime += (currentEnd - currentStart)
  return totalTime
}

function createClusterBuilder(value: number): ClusterBuilder {
  return {
    SumMs: value,
    OriginalMsPerBeat: value,
    Count: 1,
    BPM: null,
    add(v: number) {
      this.Count += 1
      this.SumMs += v
    },
    calculate() {
      const average = this.SumMs / this.Count
      this.BPM = average <= 0 ? 0 : Math.round(60000.0 / average)
    },
    get Value(): number | null {
      return this.BPM
    },
  }
}

function assignClusters(patterns: FoundPattern[]): [FoundPattern, ClusterBuilder][] {
  const bpmsNonMixed: ClusterBuilder[] = []
  const bpmsMixed = new Map<string, ClusterBuilder>()

  function addToCluster(msPerBeat: number): ClusterBuilder {
    for (const c of bpmsNonMixed) {
      if (Math.abs(c.OriginalMsPerBeat - msPerBeat) < PATTERNS_CONFIG.BPM_CLUSTER_THRESHOLD) {
        c.add(msPerBeat)
        return c
      }
    }
    const c = createClusterBuilder(msPerBeat)
    bpmsNonMixed.push(c)
    return c
  }

  function addToMixedCluster(pattern: string, value: number): ClusterBuilder {
    if (bpmsMixed.has(pattern)) {
      const c = bpmsMixed.get(pattern)!
      c.add(value)
      return c
    }
    const c = createClusterBuilder(value)
    bpmsMixed.set(pattern, c)
    return c
  }

  const patternsWithClusters: [FoundPattern, ClusterBuilder][] = []
  for (const p of patterns) {
    const c = p.Mixed ? addToMixedCluster(p.Pattern, p.MsPerBeat) : addToCluster(p.MsPerBeat)
    patternsWithClusters.push([p, c])
  }

  for (const c of bpmsNonMixed) c.calculate()
  for (const c of bpmsMixed.values()) c.calculate()

  return patternsWithClusters
}

function specificClusters(patternsWithClusters: [FoundPattern, ClusterBuilder][], options: ClusteringOptions = {}): PatternCluster[] {
  const modeTag: ModeTag = options.modeTag || 'Mix'
  const groups = new Map<string, { pattern: CorePatternName; mixed: boolean; bpm: number | null; data: [FoundPattern, ClusterBuilder][] }>()

  for (const [p, c] of patternsWithClusters) {
    const key = `${p.Pattern}@@${p.Mixed ? 1 : 0}@@${c.Value}`
    if (!groups.has(key)) {
      groups.set(key, { pattern: p.Pattern, mixed: p.Mixed, bpm: c.Value, data: [] })
    }
    groups.get(key)!.data.push([p, c])
  }

  const out: PatternCluster[] = []
  for (const group of groups.values()) {
    const startsEnds = group.data.map(([m]) => [m.Start, m.End] as [number, number]).sort((a, b) => a[0] - b[0])

    const dataCount = group.data.length
    const counter = new Map<string, number>()
    for (const [m] of group.data) {
      if (m.SpecificType != null) {
        counter.set(m.SpecificType, (counter.get(m.SpecificType) || 0) + 1)
      }
    }

    const specificTypes: [string, number][] = [...counter.entries()]
      .map(([name, count]) => [name, count / dataCount] as [string, number])
      .sort((a, b) => b[1] - a[1])

    const dominantSpecific = specificTypes.length ? specificTypes[0][0] : null
    const amount = startsEnds.length ? patternAmount(startsEnds) : 0

    out.push({
      Pattern: group.pattern,
      SpecificTypes: specificTypes,
      RatingMultiplier: resolveRatingMultiplier(group.pattern, dominantSpecific, modeTag),
      BPM: group.bpm ?? 0,
      Mixed: group.mixed,
      Amount: amount,
      get Importance(): number {
        return this.Amount * this.RatingMultiplier * Number(this.BPM)
      },
      format(rate = 1.0): string {
        const name = (this.SpecificTypes.length > 0 && this.SpecificTypes[0][1] >= PATTERNS_CONFIG.CLUSTER_SPECIFIC_NAME_MIN_RATIO)
          ? this.SpecificTypes[0][0]
          : this.Pattern
        if (this.Mixed) {
          return `~${Math.round(Number(this.BPM) * rate)}BPM Mixed ${name}`
        }
        return `${Math.round(Number(this.BPM) * rate)}BPM ${name}`
      },
    })
  }

  const hasDW = out.some((c) => c.Pattern === 'Density' || c.Pattern === 'Wildcard')
  if (hasDW && PATTERNS_CONFIG.RELEASE_WITH_DW_MULTIPLIER !== 1.0) {
    for (const c of out) {
      if (c.SpecificTypes.some(([name, ratio]) => name === 'Release' && ratio > 0)) {
        ;(c as { RatingMultiplier: number }).RatingMultiplier *= PATTERNS_CONFIG.RELEASE_WITH_DW_MULTIPLIER
      }
    }
  }

  return out
}

export function calculateClusteredPatterns(patterns: FoundPattern[], options: ClusteringOptions = {}): PatternCluster[] {
  const pwc = assignClusters(patterns)
  return specificClusters(pwc, options)
}