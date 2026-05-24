// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

import { calculateDaniel } from '../rework/danielAlgorithm'
import { runSunnyEstimatorFromText } from './sunnyEstimator'
import {
  estDiff,
  estimateDanielDan,
  normalizeReworkResult,
} from './reworkEstimatorUtils'
import type { EstimatorOptions, EstimatorResult } from './types'

export function runDanielEstimatorFromText(osuText: string, options: EstimatorOptions = {}): EstimatorResult {
  const speedRate = options.speedRate ?? 1.0
  const odFlag = options.odFlag ?? null
  const cvtFlag = options.cvtFlag ?? null
  const withGraph = options.withGraph === true

  const danielResult = calculateDaniel(osuText, speedRate, odFlag, { withGraph })

  // Keep previous behavior: Daniel only supports 4K and falls back to Sunny.
  if (danielResult === -3) {
    return runSunnyEstimatorFromText(osuText, {
      speedRate,
      odFlag,
      cvtFlag,
      withGraph,
    })
  }

  const parsed = normalizeReworkResult(danielResult)
  const useDanielDifficulty = parsed.columnCount === 4
  const danielDifficulty = useDanielDifficulty ? estimateDanielDan(parsed.star) : null
  const numericDifficulty = useDanielDifficulty ? danielDifficulty!.numeric : null

  return {
    ...parsed,
    estDiff: useDanielDifficulty
      ? danielDifficulty!.label
      : estDiff(parsed.star, parsed.lnRatio, parsed.columnCount),
    numericDifficulty,
    numericDifficultyHint: useDanielDifficulty && !Number.isFinite(numericDifficulty as number)
      ? 'N/A'
      : null,
  }
}