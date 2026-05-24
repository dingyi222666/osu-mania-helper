import { Context } from 'koishi'
import { AnalyserConfig } from './config'
import {
    analyzeMap,
    type AnalysisOptions,
    type EstimatorAlgorithm
} from './core/analysis'
import { downloadBeatmap, parseBeatmapId } from './core/downloader'
import { BeatmapCache } from './core/cache'
import { sendTemporary, parseMods, readOsuFile, type ParsedMods } from './utils'
import { formatResult } from './formatters'

const promptTimeout = 1000 * 60

// ─── Command Registration ───────────────────────────────────────────────────

export function apply(ctx: Context, config: AnalyserConfig, cache: BeatmapCache) {
    ctx.command('mania-analyse [input:text]', { authority: 1 })
        .alias('ma')
        .option('refresh', '-r 强制重新下载谱面文件')
        .action(async ({ session, options }, input) => {
            let osuContent: string | null = null
            let resolvedBeatmapId: string | null = null
            const forceRefresh = options?.refresh ?? false

            // Parse +mods from input (e.g. "4812662 +dthr")
            let mods: ParsedMods | null = null
            if (input) {
                const tokens = input.trim().split(/\s+/)
                const modToken = tokens.find((t) => t.startsWith('+') && t.length > 1)
                if (modToken) {
                    mods = parseMods(modToken.slice(1))
                    input = tokens.filter((t) => t !== modToken).join(' ') || undefined
                }
            }

            // 1. Try to parse input as beatmap ID or URL
            if (input) {
                const beatmapId = parseBeatmapId(input)
                if (beatmapId) {
                    resolvedBeatmapId = String(beatmapId)

                    // If refresh requested, invalidate cached file
                    if (forceRefresh) {
                        cache.invalidate(resolvedBeatmapId)
                    }

                    // Try reading .osu content from cache
                    const cached = cache.get(resolvedBeatmapId)
                    if (cached) {
                        osuContent = cached
                    } else {
                        // Cache miss or refresh: download and save
                        try {
                            osuContent = await downloadBeatmap(
                                ctx,
                                beatmapId,
                                config.mirrors?.length > 0
                                    ? config.mirrors
                                    : undefined
                            )
                            // Save to cache
                            cache.set(resolvedBeatmapId, osuContent)
                        } catch (error) {
                            ctx.logger.debug('Download failed: %s', error instanceof Error ? error.message : String(error))
                            await sendTemporary(ctx, session, session.text('.download-failed'))
                            return
                        }
                    }
                } else {
                    // Treat as a direct URL to a .osu file
                    try {
                        osuContent = await ctx.http.get(input, {
                            responseType: 'text',
                            timeout: 10000,
                            headers: {
                                'User-Agent':
                                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        })
                    } catch {
                        await sendTemporary(ctx, session, session.text('.failed', ['无法从 URL 获取文件']))
                        return
                    }
                }
            }

            // 2. Try file attachment from current message
            if (!osuContent) {
                osuContent = await readOsuFile(session, ctx)
            }

            // 3. Prompt user for file
            if (!osuContent) {
                await sendTemporary(ctx, session, session.text('.prompt-file'))
                const prompted = await session.prompt(
                    async (next) => readOsuFile(next, ctx),
                    { timeout: promptTimeout }
                )
                if (prompted === undefined) {
                    await sendTemporary(ctx, session, session.text('.timeout'))
                    return
                }
                osuContent = prompted
            }

            if (!osuContent) {
                await sendTemporary(ctx, session, session.text('.no-file'))
                return
            }

            // File size check
            const fileSizeBytes = Buffer.byteLength(osuContent, 'utf-8')
            const maxBytes = config.maxFileSizeMb * 1024 * 1024
            if (fileSizeBytes > maxBytes) {
                await sendTemporary(ctx, session, session.text('.failed', [`文件过大（${(fileSizeBytes / 1024 / 1024).toFixed(1)}MB），最大允许 ${config.maxFileSizeMb}MB`]))
                return
            }

            await sendTemporary(ctx, session, session.text('.analysing'))

            // Map config algorithm to AnalysisOptions
            const algorithmMap: Record<string, EstimatorAlgorithm> = {
                sunny: 'Sunny',
                daniel: 'Daniel',
                azusa: 'Azusa'
            }

            const options_: AnalysisOptions = {
                estimatorAlgorithm: algorithmMap[config.algorithm] ?? 'Sunny',
                etternaVersion: config.etternaVersion,
                enableVibroDetection: config.enableVibro,
                enableSvDetection: config.enableSV,
                enablePatternAnalysis: true,
                enableEtternaAnalysis: true,
                speedRate: mods?.rate ?? 1.0
            }

            // For 'mixed' algorithm, use the mixed estimator directly
            if (config.algorithm === 'mixed') {
                try {
                    const { runMixedEstimatorFromText } =
                        await import('./core/estimator/mixedEstimator')
                    const mixedResult = runMixedEstimatorFromText(osuContent, {
                        speedRate: mods?.rate ?? 1.0
                    })
                    // Still run full analysis for pattern/etterna/vibro, but override estimator
                    const result = await analyzeMap(osuContent, {
                        ...options_,
                        estimatorAlgorithm: 'Sunny' // base, will be overridden by mixed
                    })
                    return await formatResult(
                        ctx,
                        result,
                        mixedResult,
                        config,
                        mods
                    )
                } catch (error) {
                    const message =
                        error instanceof Error ? error.message : String(error)
                    ctx.logger.warn(
                        'Mixed estimator failed, falling back to Sunny:',
                        message
                    )
                }
            }

            try {
                const result = await analyzeMap(osuContent, options_)
                return await formatResult(ctx, result, null, config, mods)
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error)
                ctx.logger.warn(error)
                await sendTemporary(ctx, session, session.text('.failed', [message]))
                return
            }
        })
}
