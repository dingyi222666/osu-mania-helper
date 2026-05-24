// Ported from https://github.com/LeoBlackMT/osumania_map_analyser
//
// This is the core analysis orchestrator, extracted as a pure function.
//
// ─── REMOVED from original analysis.js ───────────────────────────────────────
// - HTTP fetch (fetchBeatmapFile) - caller provides osu file content directly
// - DOM manipulation (all render*, show*, set* display functions)
// - appContext / state references (UI state machine)
// - HUD overlay / status bar updates
// - Graph rendering (renderDiffGraph, clearDiffGraph, etc.)
// - Skeleton/transition animations (waitForMainCardResizeTransition)
// - Auto-display profile switching (refreshAutoDisplayProfile)
// - Scheduler (scheduleRecompute)
// - Companella estimator (removed from project)
// - Mixed estimator Companella integration (removed from project)
// - Stale request tracking (not needed in pure function context)
//
// ─── KEPT ────────────────────────────────────────────────────────────────────
// - Metadata parsing from beatmap text
// - Estimator dispatch (Sunny, Daniel, Azusa)
// - Pattern analysis
// - Etterna MSD analysis
// - Interlude star calculation
// - Vibro detection
// - Mode tag classification
// - SV detection flag

import { OsuFileParser } from './parser/osuFileParser'
import { modeTagFromLnRatio, type ModeTag } from './modeLogic'
import {
    detectVibro,
    detectVibroFromLongjackPattern,
    type PatternReport
} from './vibro'
import type { EtternaAnalyzeResult, MsdSkillsetValues } from './ett/types'
import { logger } from '..'

// ─── Types ───────────────────────────────────────────────────────────────────

export type EstimatorAlgorithm = 'Sunny' | 'Daniel' | 'Azusa'

export interface AnalysisOptions {
    /** Music playback rate multiplier (default: 1.0) */
    speedRate?: number
    /** OD override flag: 'HR', 'EZ', or a numeric OD value */
    odFlag?: string | number | null
    /** Convert flag: 'IN' or 'HO' */
    cvtFlag?: string | null
    /** Which estimator algorithm to use (default: 'Sunny') */
    estimatorAlgorithm?: EstimatorAlgorithm
    /** Etterna version string for MSD calculation */
    etternaVersion?: string | null
    /** Whether to run pattern analysis (default: true) */
    enablePatternAnalysis?: boolean
    /** Whether to run Etterna MSD analysis (default: true) */
    enableEtternaAnalysis?: boolean
    /** Whether to run interlude star calculation (default: false) */
    enableInterludeAnalysis?: boolean
    /** Whether to detect vibro maps (default: true) */
    enableVibroDetection?: boolean
    /** Whether to detect SV maps (default: false) */
    enableSvDetection?: boolean
    /** Whether to compute difficulty graph data (default: false) */
    withGraph?: boolean
    /** Azusa-specific: force Sunny reference for HO maps */
    azusaSunnyReferenceHo?: boolean
    /** Vibro detection: JackSpeed/Overall ratio threshold */
    vibroJackSpeedRatioThreshold?: number
    /** Vibro detection: Longjack pattern ratio threshold */
    longjackVibroRatioThreshold?: number
    /** Vibro detection: minimum BPM for longjack vibro */
    longjackVibroMinBpm?: number
    /** SV detection: minimum SV amount to flag as SV map */
    svAmountThreshold?: number
    /** ETT default score goal */
    ettScoreGoal?: number
}

export interface EstimatorResult {
    star: number
    estDiff: string
    numericDifficulty: number
    numericDifficultyHint?: string | null
    columnCount: number
    lnRatio: number
    graph?: unknown
}

export interface AnalysisResult {
    /** Parsed metadata from the beatmap */
    metadata: Record<string, string>
    /** Key count */
    keycount: number
    /** LN ratio (0-1) */
    lnRatio: number
    /** Mode classification: RC, LN, or Mix */
    modeTag: ModeTag
    /** Whether the map is classified as vibro */
    isVibro: boolean
    /** Whether the map is classified as SV */
    isSv: boolean
    /** Estimator result (star rating, difficulty text, etc.) */
    estimator: EstimatorResult | null
    /** Which estimator algorithm was actually used */
    actualEstimatorAlgorithm: EstimatorAlgorithm | null
    /** Pattern analysis result */
    patternReport: PatternReport | null
    /** Etterna MSD result */
    etternaResult: EtternaAnalyzeResult | null
    /** Interlude star rating */
    interludeStar: number | null
    /** Non-fatal errors encountered during analysis */
    errors: string[]
}

// ─── Default thresholds (from original PATTERNS_CONFIG / appContext) ─────────

const DEFAULT_VIBRO_JACKSPEED_RATIO_THRESHOLD = 0.7
const DEFAULT_LONGJACK_VIBRO_RATIO_THRESHOLD = 0.5
const DEFAULT_LONGJACK_VIBRO_MIN_BPM = 180
const DEFAULT_SV_AMOUNT_THRESHOLD = 3

// ─── Internal helpers ────────────────────────────────────────────────────────

function parseMetadataFromBeatmap(osuText: string): {
    metadata: Record<string, string>
    lnRatio: number
    columnCount: number
} {
    const parser = new OsuFileParser(osuText)
    parser.process()
    const parsed = parser.getParsedData()
    return {
        metadata: parsed.metaData || {},
        lnRatio: Number(parsed.lnRatio) || 0,
        columnCount: Number(parsed.columnCount) || 0
    }
}

// ─── Main orchestrator ───────────────────────────────────────────────────────

/**
 * Analyzes an osu!mania beatmap from its raw .osu file content.
 *
 * This is a pure function with no side effects - it does not access the DOM,
 * network, or any global state. All dependencies are injected via the options
 * parameter or dynamically imported.
 */
export async function analyzeMap(
    osuFileContent: string,
    options: AnalysisOptions = {}
): Promise<AnalysisResult> {
    const {
        speedRate = 1.0,
        odFlag = null,
        cvtFlag = null,
        estimatorAlgorithm = 'Sunny',
        etternaVersion = null,
        enablePatternAnalysis = true,
        enableEtternaAnalysis = true,
        enableInterludeAnalysis = false,
        enableVibroDetection = true,
        enableSvDetection = false,
        withGraph = false,
        azusaSunnyReferenceHo = false,
        vibroJackSpeedRatioThreshold = DEFAULT_VIBRO_JACKSPEED_RATIO_THRESHOLD,
        longjackVibroRatioThreshold = DEFAULT_LONGJACK_VIBRO_RATIO_THRESHOLD,
        longjackVibroMinBpm = DEFAULT_LONGJACK_VIBRO_MIN_BPM,
        svAmountThreshold = DEFAULT_SV_AMOUNT_THRESHOLD,
        ettScoreGoal
    } = options

    const errors: string[] = []
    const parsedInfo = parseMetadataFromBeatmap(osuFileContent)

    // ─── Estimator ─────────────────────────────────────────────────────────────
    let estimatorResult: EstimatorResult | null = null
    let actualEstimatorAlgorithm: EstimatorAlgorithm | null = null

    try {
        const estimatorOptions = {
            speedRate,
            odFlag,
            cvtFlag,
            withGraph
        }

        // Dynamic imports to avoid circular dependencies and allow tree-shaking
        if (estimatorAlgorithm === 'Daniel') {
            const { runDanielEstimatorFromText } =
                await import('./estimator/danielEstimator')
            estimatorResult = runDanielEstimatorFromText(
                osuFileContent,
                estimatorOptions
            )
            actualEstimatorAlgorithm = 'Daniel'
        } else if (estimatorAlgorithm === 'Azusa') {
            const { runAzusaEstimatorFromText } =
                await import('./estimator/azusaEstimator')
            const azusaOptions = {
                ...estimatorOptions,
                forceSunnyReferenceHo: azusaSunnyReferenceHo
            }
            const azusaResult = runAzusaEstimatorFromText(
                osuFileContent,
                azusaOptions
            )

            const isValid =
                Boolean(azusaResult) &&
                Number.isFinite(azusaResult.star) &&
                Number.isFinite(azusaResult.numericDifficulty) &&
                typeof azusaResult.estDiff === 'string'

            if (isValid) {
                estimatorResult = azusaResult
                actualEstimatorAlgorithm = 'Azusa'
            } else {
                // Fallback to Sunny if Azusa produces invalid result
                const { runSunnyEstimatorFromText } =
                    await import('./estimator/sunnyEstimator')
                estimatorResult = runSunnyEstimatorFromText(
                    osuFileContent,
                    estimatorOptions
                )
                actualEstimatorAlgorithm = 'Sunny'
            }
        } else {
            // Default: Sunny
            const { runSunnyEstimatorFromText } =
                await import('./estimator/sunnyEstimator')
            estimatorResult = runSunnyEstimatorFromText(
                osuFileContent,
                estimatorOptions
            )
            actualEstimatorAlgorithm = 'Sunny'
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`Estimator failed: ${message}`)
    }

    // ─── Interlude Star ────────────────────────────────────────────────────────
    let interludeStar: number | null = null
    if (enableInterludeAnalysis) {
        try {
            const { calculateInterludeStar } = await import('./interlude/index')
            const result = calculateInterludeStar(
                osuFileContent,
                speedRate,
                cvtFlag
            )
            interludeStar = Number.isFinite(result) ? result : null
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : String(error)
            errors.push(`Interlude analyze failed: ${message}`)
        }
    }

    // ─── Pattern Analysis ──────────────────────────────────────────────────────
    let patternReport: PatternReport | null = null
    if (enablePatternAnalysis) {
        try {
            const { analyzePatternFromText } =
                await import('./patterns/service')
            const patternResult = analyzePatternFromText(osuFileContent)
            patternReport = (patternResult?.report as PatternReport) || null
        } catch (error) {
            logger.error(`Pattern analyze failed`, error)
        }
    }

    // ─── Etterna MSD Analysis ──────────────────────────────────────────────────
    let ettResult: EtternaAnalyzeResult | null = null
    if (enableEtternaAnalysis) {
        try {
            const { analyzeEtternaFromText } = await import('./ett/index')
            ettResult = await analyzeEtternaFromText(osuFileContent, {
                musicRate: speedRate,
                scoreGoal: ettScoreGoal,
                cvtFlag,
                etternaVersion
            })
        } catch (error) {
            logger.error(`Etterna analyze failed`, error)
        }
    }

    // ─── Vibro Detection ───────────────────────────────────────────────────────
    let isVibro = false
    if (enableVibroDetection) {
        const reworkStarValue = Number(estimatorResult?.star)
        const vibroEligible =
            Number.isFinite(reworkStarValue) && reworkStarValue > 5.0

        if (vibroEligible) {
            isVibro =
                detectVibro(
                    ettResult?.values as Partial<MsdSkillsetValues> | undefined,
                    vibroJackSpeedRatioThreshold
                ) ||
                detectVibroFromLongjackPattern(
                    patternReport,
                    longjackVibroRatioThreshold,
                    longjackVibroMinBpm
                )
        }
    }

    // ─── Mode Tag ──────────────────────────────────────────────────────────────
    const lnRatio = estimatorResult?.lnRatio ?? parsedInfo.lnRatio
    const fallbackModeTag = modeTagFromLnRatio(lnRatio)
    const modeTag: ModeTag =
        (patternReport?.ModeTag as ModeTag) || fallbackModeTag

    // ─── SV Detection ─────────────────────────────────────────────────────────
    let isSv = false
    if (enableSvDetection && patternReport) {
        const svAmount = Number(patternReport.SVAmount)
        if (Number.isFinite(svAmount) && svAmount >= svAmountThreshold) {
            isSv = true
        }
    }

    return {
        metadata: parsedInfo.metadata,
        keycount: parsedInfo.columnCount,
        lnRatio,
        modeTag,
        isVibro: isVibro,
        isSv,
        estimator: estimatorResult,
        actualEstimatorAlgorithm,
        patternReport,
        etternaResult: ettResult,
        interludeStar,
        errors
    }
}
