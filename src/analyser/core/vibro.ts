// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

import type { MsdSkillsetValues } from './ett/types'

// ─── Pattern Report types (minimal interface for vibro detection) ─────────────

export interface PatternCluster {
  Pattern: string
  BPM: number
  Amount: number
  SpecificTypes: [string, number][]
}

export interface PatternReport {
  Clusters: PatternCluster[]
  Category?: string
  ModeTag?: string
  SVAmount?: number
}

// ─── Vibro Detection ─────────────────────────────────────────────────────────

function pickNumber(obj: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!obj || typeof obj !== 'object') {
    return null
  }

  for (const key of keys) {
    const value = Number(obj[key])
    if (Number.isFinite(value)) {
      return value
    }
  }

  return null
}

export function detectVibro(
  values: Partial<MsdSkillsetValues> | null | undefined,
  threshold: number,
): boolean {
  const overall = pickNumber(values as Record<string, unknown> | null, ['Overall', 'overall'])
  const jackSpeed = pickNumber(values as Record<string, unknown> | null, ['JackSpeed', 'Jackspeed', 'jackSpeed', 'jackspeed'])

  if (!Number.isFinite(overall) || overall! <= 0 || !Number.isFinite(jackSpeed)) {
    return false
  }

  return (jackSpeed! / overall!) >= threshold
}

export function detectVibroFromLongjackPattern(
  patternReport: PatternReport | null | undefined,
  threshold: number,
  minBpm: number,
): boolean {
  if (!patternReport || !Array.isArray(patternReport.Clusters)) {
    return false
  }

  const bpmLimit = Number.isFinite(minBpm) && minBpm > 0 ? minBpm : 0

  for (const cluster of patternReport.Clusters) {
    if (!Array.isArray(cluster.SpecificTypes)) {
      continue
    }
    const clusterBpm = Number(cluster.BPM)
    if (!Number.isFinite(clusterBpm) || clusterBpm < bpmLimit) {
      continue
    }
    for (const [name, ratio] of cluster.SpecificTypes) {
      if (name === 'Longjacks' && Number.isFinite(ratio) && ratio >= threshold) {
        return true
      }
    }
  }

  return false
}
