// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

import { calculate as calculateSunny } from '../rework/sunnyAlgorithm'
import { estDiff, normalizeReworkResult } from './reworkEstimatorUtils'
import type { EstimatorOptions, EstimatorResult } from './types'

export function runSunnyEstimatorFromText(osuText: string, options: EstimatorOptions = {}): EstimatorResult {
  const speedRate = options.speedRate ?? 1.0
  const odFlag = options.odFlag ?? null
  const cvtFlag = options.cvtFlag ?? null
  const withGraph = options.withGraph === true

  const rawResult = calculateSunny(osuText, speedRate, odFlag, cvtFlag, { withGraph })
  const parsed = normalizeReworkResult(rawResult)

  return {
    ...parsed,
    estDiff: estDiff(parsed.star, parsed.lnRatio, parsed.columnCount),
    numericDifficulty: null,
    numericDifficultyHint: null,
  }
}