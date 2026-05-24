// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

import { parseOsuManiaFromText } from '../parser/patternOsuParser'
import { fromChart } from './summary'
import type { PatternAnalysisResult } from './types'

export function analyzePatternFromText(osuText: string, _rate = 1.0): PatternAnalysisResult {
  const chart = parseOsuManiaFromText(osuText)
  const report = fromChart(chart)

  return {
    report,
    topFiveClusters: report.Clusters.slice(0, 5),
  }
}