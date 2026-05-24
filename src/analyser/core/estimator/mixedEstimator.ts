// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

import { runDanielEstimatorFromText } from './danielEstimator'
import { runSunnyEstimatorFromText } from './sunnyEstimator'
import { runAzusaEstimatorFromText } from './azusaEstimator'
import type {
  AzusaEstimatorResult,
  CompanellaPlan,
  EstimatorOptions,
  EstimatorResult,
  MixedEstimatorResult,
} from './types'

const MIXED_SUPPORTED_KEYS = new Set([4, 6, 7])

function modeTagFromLnRatio(lnRatio: number): string {
  if (!Number.isFinite(lnRatio)) {
    return 'Mix'
  }
  if (lnRatio <= 0.15) {
    return 'RC'
  }
  if (lnRatio >= 0.9) {
    return 'LN'
  }
  return 'Mix'
}

function parseCvtFlags(value: string | null | undefined): { inEnabled: boolean; hoEnabled: boolean } {
  const normalized = String(value ?? '').toUpperCase()
  return {
    inEnabled: normalized.includes('IN'),
    hoEnabled: normalized.includes('HO'),
  }
}

function splitDifficultyParts(value: string | null | undefined): { rc: string; ln: string } {
  const text = String(value ?? '').trim()
  if (!text) {
    return { rc: '-', ln: '-' }
  }

  const parts = text
    .split('||')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (parts.length >= 2) {
    return {
      rc: parts[0],
      ln: parts[1],
    }
  }

  return {
    rc: parts[0] || text,
    ln: parts[0] || text,
  }
}

export function composeDifficultyFromRcLn(rcLabel: string | null | undefined, lnLabel: string | null | undefined, lnRatio: number): string {
  const rc = String(rcLabel ?? '').trim()
  const ln = String(lnLabel ?? '').trim()
  const ratio = Number(lnRatio)

  if (!Number.isFinite(ratio) || ratio < 0.15) {
    return rc || ln || '-'
  }

  if (!rc) {
    return ln || '-'
  }
  if (!ln) {
    return rc
  }
  return `${rc} || ${ln}`
}

export function isDanielTooLowDifficulty(value: string | null | undefined): boolean {
  const text = String(value ?? '').trim()
  return /^<\s*alpha\b/i.test(text)
}

function tryRunDanielFallback(osuText: string, options: EstimatorOptions): EstimatorResult | null {
  try {
    return runDanielEstimatorFromText(osuText, options)
  } catch {
    return null
  }
}

function tryRunAzusaFallback(osuText: string, options: EstimatorOptions & { forceSunnyReferenceHo?: boolean; precomputedSunnyResult?: EstimatorResult | null }): (AzusaEstimatorResult & EstimatorResult) | null {
  try {
    const result = runAzusaEstimatorFromText(osuText, options)
    return result as AzusaEstimatorResult & EstimatorResult
  } catch {
    return null
  }
}

function canUseAzusaResult(result: EstimatorResult | null): boolean {
  if (!result || Number(result.columnCount) !== 4) {
    return false
  }

  const estDiff = String(result.estDiff ?? '').trim()
  if (!estDiff || /^Invalid\b/i.test(estDiff)) {
    return false
  }

  return true
}

export function runMixedEstimatorFromText(osuText: string, options: EstimatorOptions = {}): MixedEstimatorResult {
  const sunnyBaseline = runSunnyEstimatorFromText(osuText, options)
  const columnCount = Number(sunnyBaseline.columnCount)
  if (!Number.isFinite(columnCount) || !MIXED_SUPPORTED_KEYS.has(columnCount)) {
    return {
      ...sunnyBaseline,
      mixedCompanellaPlan: null,
    }
  }

  const { inEnabled, hoEnabled } = parseCvtFlags(options.cvtFlag)
  const mixedModeTag = hoEnabled ? 'RC' : modeTagFromLnRatio(Number(sunnyBaseline.lnRatio))

  if (mixedModeTag === 'RC' && columnCount !== 4) {
    return {
      ...sunnyBaseline,
      mixedCompanellaPlan: null,
    }
  }

  let selectedRework: EstimatorResult = sunnyBaseline
  let estDiff = sunnyBaseline.estDiff
  let numericDifficulty = sunnyBaseline.numericDifficulty
  let numericDifficultyHint = sunnyBaseline.numericDifficultyHint
  let companellaPlan: CompanellaPlan | null = null

  if (mixedModeTag === 'RC') {
    if (!inEnabled) {
      const azusaResult = tryRunAzusaFallback(osuText, {
        ...options,
        forceSunnyReferenceHo: false,
        precomputedSunnyResult: sunnyBaseline,
      })
      if (canUseAzusaResult(azusaResult)) {
        selectedRework = azusaResult!
        estDiff = azusaResult!.estDiff
        numericDifficulty = azusaResult!.numericDifficulty
        numericDifficultyHint = azusaResult!.numericDifficultyHint
      } else {
        const danielResult = tryRunDanielFallback(osuText, options)
        const canUseDaniel = danielResult
          && Number(danielResult.columnCount) === 4
          && !isDanielTooLowDifficulty(danielResult.estDiff)

        if (canUseDaniel) {
          selectedRework = danielResult!
          estDiff = danielResult!.estDiff
          numericDifficulty = danielResult!.numericDifficulty
          numericDifficultyHint = danielResult!.numericDifficultyHint
        }
      }
    }
  } else {
    const sunnyParts = splitDifficultyParts(sunnyBaseline.estDiff)
    const lnRatio = Number(sunnyBaseline.lnRatio)
    const lnDifficulty = sunnyParts.ln

    let rcDifficulty = sunnyParts.rc
    let rcNumericDifficulty = sunnyBaseline.numericDifficulty
    let rcNumericDifficultyHint = sunnyBaseline.numericDifficultyHint

    if (columnCount === 4) {
      // NOTE: Companella path removed (requires ONNX Runtime).
      // For star < 9, we would have used Companella for RC estimation.
      // Instead, fall through to Daniel for high-star maps.
      if (Number(sunnyBaseline.star) >= 9) {
        const danielResult = tryRunDanielFallback(osuText, options)
        const canUseDaniel = danielResult
          && Number(danielResult.columnCount) === 4
          && !isDanielTooLowDifficulty(danielResult.estDiff)

        if (canUseDaniel) {
          rcDifficulty = danielResult!.estDiff
          rcNumericDifficulty = danielResult!.numericDifficulty
          rcNumericDifficultyHint = danielResult!.numericDifficultyHint
        }
      }
    }

    estDiff = composeDifficultyFromRcLn(rcDifficulty, lnDifficulty, lnRatio)
    numericDifficulty = rcNumericDifficulty
    numericDifficultyHint = rcNumericDifficultyHint
  }

  const normalizedLnRatio = Number(selectedRework.lnRatio)
  const forcedLnRatio = hoEnabled ? 0 : normalizedLnRatio

  return {
    ...selectedRework,
    lnRatio: Number.isFinite(forcedLnRatio) ? forcedLnRatio : 0,
    estDiff,
    numericDifficulty,
    numericDifficultyHint,
    mixedCompanellaPlan: companellaPlan,
  }
}

// NOTE: Companella is not included (requires ONNX Runtime).
// This function is kept for API compatibility but will always return the input unchanged.
export function applyCompanellaToMixedResult(mixedResult: MixedEstimatorResult, _companellaResult: EstimatorResult | null): MixedEstimatorResult {
  const plan = mixedResult?.mixedCompanellaPlan
  if (!plan || !_companellaResult) {
    return mixedResult
  }

  return {
    ...mixedResult,
    estDiff: composeDifficultyFromRcLn(
      _companellaResult.estDiff,
      plan.lnDifficulty,
      plan.lnRatio,
    ),
    numericDifficulty: _companellaResult.numericDifficulty,
    numericDifficultyHint: _companellaResult.numericDifficultyHint,
    mixedCompanellaPlan: null,
  }
}