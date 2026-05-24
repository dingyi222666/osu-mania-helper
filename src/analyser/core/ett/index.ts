// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

import {
  analyzeEtternaFromText as analyzeEtternaWasm,
  DEFAULT_SCORE_GOAL,
  DISPLAY_SKILLSET_ORDER,
} from './calc'
import type { EtternaAnalyzeOptions, EtternaAnalyzeResult, MsdSkillsetValues, SkillsetName } from './types'

const SUPPORTED_KEYS = new Set([4, 6, 7])

function normalizeKeyOverride(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return SUPPORTED_KEYS.has(parsed) ? parsed : null
}

function sanitizeSkillValues(values: Partial<MsdSkillsetValues> | null | undefined): MsdSkillsetValues {
  const input = values && typeof values === 'object' ? values : {}
  const normalized: Record<string, number> = {}
  for (const name of DISPLAY_SKILLSET_ORDER) {
    const value = Number((input as Record<string, unknown>)[name])
    normalized[name] = Number.isFinite(value) ? value : 0
  }
  return normalized as unknown as MsdSkillsetValues
}

async function requestWasmCalc(
  osuText: string,
  options: EtternaAnalyzeOptions,
): Promise<EtternaAnalyzeResult> {
  const wasmResult = await analyzeEtternaWasm(osuText, options)
  return {
    ...wasmResult,
    values: sanitizeSkillValues(wasmResult?.values),
    engine: 'wasm',
  }
}

export async function analyzeEtternaFromText(
  osuText: string,
  options: EtternaAnalyzeOptions = {},
): Promise<EtternaAnalyzeResult> {
  const {
    musicRate = 1.0,
    scoreGoal = DEFAULT_SCORE_GOAL,
    keyOverride = null,
    cvtFlag = null,
    etternaVersion = null,
  } = options

  const normalizedOptions: EtternaAnalyzeOptions = {
    musicRate: Number.isFinite(Number(musicRate)) ? Number(musicRate) : 1.0,
    scoreGoal: Number.isFinite(Number(scoreGoal)) ? Number(scoreGoal) : DEFAULT_SCORE_GOAL,
    keyOverride: normalizeKeyOverride(keyOverride),
    cvtFlag,
    etternaVersion,
  }

  return requestWasmCalc(osuText, normalizedOptions)
}

export {
  DEFAULT_SCORE_GOAL,
  DISPLAY_SKILLSET_ORDER,
}

export type { EtternaAnalyzeOptions, EtternaAnalyzeResult, MsdSkillsetValues, SkillsetName }
