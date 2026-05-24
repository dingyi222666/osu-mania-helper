import { Context, h, Session } from 'koishi'
import { AnalyserConfig } from './config'
import {
    analyzeMap,
    type AnalysisOptions,
    type AnalysisResult,
    type EstimatorAlgorithm
} from './core/analysis'
import { renderCard, buildCardData } from './render'
import { downloadBeatmap, parseBeatmapId } from './core/downloader'
import { BeatmapCache } from './core/cache'

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
                            const message =
                                error instanceof Error
                                    ? error.message
                                    : String(error)
                            return session.text('.download-failed', [message])
                        }
                    }
                } else {
                    // Treat as a direct URL to a .osu file
                    try {
                        const response = await ctx.http(input, {
                            responseType: 'text',
                            method: 'get',
                            timeout: 10000,
                            headers: {
                                'User-Agent':
                                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        })
                        osuContent =
                            typeof response.data === 'string'
                                ? response.data
                                : String(response.data)
                    } catch {
                        return session.text('.failed', ['无法从 URL 获取文件'])
                    }
                }
            }

            // 2. Try file attachment from current message
            if (!osuContent) {
                osuContent = await readOsuFile(session, ctx)
            }

            // 3. Prompt user for file
            if (!osuContent) {
                await session.send(session.text('.prompt-file'))
                const prompted = await session.prompt(
                    async (next) => readOsuFile(next, ctx),
                    { timeout: promptTimeout }
                )
                if (prompted === undefined) return session.text('.timeout')
                osuContent = prompted
            }

            if (!osuContent) return session.text('.no-file')

            // File size check
            const fileSizeBytes = Buffer.byteLength(osuContent, 'utf-8')
            const maxBytes = config.maxFileSizeMb * 1024 * 1024
            if (fileSizeBytes > maxBytes) {
                return session.text('.failed', [`文件过大（${(fileSizeBytes / 1024 / 1024).toFixed(1)}MB），最大允许 ${config.maxFileSizeMb}MB`])
            }

            await session.send(session.text('.analysing'))

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
                return session.text('.failed', [message])
            }
        })
}

// ─── Mod Parsing ────────────────────────────────────────────────────────────

/** Known mod acronyms (2-char codes) */
const KNOWN_MODS = [
    'DT',
    'NC',
    'HT',
    'DC',
    'HR',
    'EZ',
    'FL',
    'HD',
    'FI',
    'NF',
    'SD',
    'PF',
    'MR'
] as const
type ModCode = (typeof KNOWN_MODS)[number]

interface ParsedMods {
    codes: ModCode[]
    rate: number
    displayString: string
}

/**
 * Parses a mod string like "DTHR" or "dt hr" into individual mod codes.
 * Case-insensitive, ignores spaces/commas.
 */
function parseMods(input: string): ParsedMods {
    const normalized = input.toUpperCase().replace(/[\s,]+/g, '')
    const codes: ModCode[] = []

    let i = 0
    while (i < normalized.length) {
        let matched = false
        for (const mod of KNOWN_MODS) {
            if (normalized.startsWith(mod, i)) {
                if (!codes.includes(mod)) codes.push(mod)
                i += mod.length
                matched = true
                break
            }
        }
        if (!matched) i++
    }

    // Determine rate multiplier
    let rate = 1.0
    if (codes.includes('DT') || codes.includes('NC')) {
        rate = 1.5
    } else if (codes.includes('HT') || codes.includes('DC')) {
        rate = 0.75
    }

    const displayString = codes.length > 0 ? codes.join('') : 'NM'

    return { codes, rate, displayString }
}

async function formatResult(
    ctx: Context,
    result: AnalysisResult,
    mixedOverride: unknown,
    config: AnalyserConfig,
    mods: ParsedMods | null
): Promise<h | string> {
    const mixed = mixedOverride as { estDiff?: string; star?: number } | null

    // Try card rendering with puppeteer
    if (ctx.puppeteer) {
        try {
            const cardData = buildCardData(result, mixed, config)
            // Inject mod info into card data if mods are active
            if (mods && mods.codes.length > 0) {
                ;(cardData as any).modsDisplay = mods.displayString
                ;(cardData as any).rateDisplay =
                    mods.rate !== 1.0 ? `${mods.rate.toFixed(2)}x` : null
            }
            const image = await renderCard(ctx, cardData)
            if (image) return image
        } catch (error) {
            ctx.logger.warn('Card render failed, falling back to text:', error)
        }
    }

    // Fallback to text format
    return formatTextResult(result, mixed, config, mods)
}

function formatTextResult(
    result: AnalysisResult,
    mixedOverride: { estDiff?: string; star?: number } | null,
    config: AnalyserConfig,
    mods: ParsedMods | null
): string {
    const meta = result.metadata
    const title = meta['Title'] || meta['TitleUnicode'] || 'Unknown'
    const artist = meta['Artist'] || meta['ArtistUnicode'] || 'Unknown'
    const version = meta['Version'] || ''
    const creator = meta['Creator'] || ''

    const lines: string[] = []
    lines.push(`🎵 ${artist} - ${title}`)
    if (version) lines.push(`   [${version}] by ${creator}`)
    lines.push(``)
    lines.push(
        `Keys: ${result.keycount}K | Mode: ${result.modeTag} | LN: ${(result.lnRatio * 100).toFixed(1)}%`
    )

    // Mods info
    if (mods && mods.codes.length > 0) {
        let modLine = `Mods: ${mods.displayString}`
        if (mods.rate !== 1.0) modLine += ` (${mods.rate.toFixed(2)}x)`
        lines.push(modLine)
    }

    // Estimator result
    if (mixedOverride && 'estDiff' in mixedOverride) {
        lines.push(
            `Difficulty: ${mixedOverride.estDiff ?? '-'} (★${mixedOverride.star?.toFixed(2) ?? '-'})`
        )
        lines.push(`Algorithm: Mixed`)
    } else if (result.estimator) {
        lines.push(
            `Difficulty: ${result.estimator.estDiff} (★${result.estimator.star.toFixed(2)})`
        )
        lines.push(`Algorithm: ${result.actualEstimatorAlgorithm}`)
    }

    // Flags
    const flags: string[] = []
    if (result.isVibro) flags.push('Vibro')
    if (result.isSv) flags.push('SV')
    if (flags.length > 0) lines.push(`Flags: ${flags.join(', ')}`)

    // Etterna MSD
    if (result.etternaResult?.values) {
        const vals = result.etternaResult.values
        const msdParts: string[] = []
        if (vals.Overall)
            msdParts.push(`Overall: ${Number(vals.Overall).toFixed(2)}`)
        if (vals.Stream)
            msdParts.push(`Stream: ${Number(vals.Stream).toFixed(2)}`)
        if (vals.Jumpstream)
            msdParts.push(`JS: ${Number(vals.Jumpstream).toFixed(2)}`)
        if (vals.Handstream)
            msdParts.push(`HS: ${Number(vals.Handstream).toFixed(2)}`)
        if (vals.JackSpeed)
            msdParts.push(`Jack: ${Number(vals.JackSpeed).toFixed(2)}`)
        if (vals.Chordjack)
            msdParts.push(`CJ: ${Number(vals.Chordjack).toFixed(2)}`)
        if (vals.Technical)
            msdParts.push(`Tech: ${Number(vals.Technical).toFixed(2)}`)
        if (msdParts.length > 0) {
            lines.push(``)
            lines.push(`Etterna MSD (v${config.etternaVersion}):`)
            lines.push(`  ${msdParts.join(' | ')}`)
        }
    }

    // Errors
    if (result.errors.length > 0) {
        lines.push(``)
        lines.push(`⚠️ ${result.errors.join('; ')}`)
    }

    return lines.join('\n')
}

async function readOsuFile(
    session: Session,
    ctx: Context
): Promise<string | null> {
    // Check for file elements in message
    const fileElements = [
        ...h.select(session.elements, 'file'),
        ...h.select(session.elements, 'audio'),
        ...h.select(
            session.quote?.elements ?? h.parse(session.quote?.content ?? ''),
            'file'
        )
    ]

    for (const el of fileElements) {
        const url = (el.attrs.url ?? el.attrs.src) as string
        if (!url) continue
        try {
            const response = await ctx.http(url, {
                responseType: 'text',
                method: 'get',
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            })
            const text =
                typeof response.data === 'string'
                    ? response.data
                    : String(response.data)
            if (text.includes('osu file format')) return text
        } catch {
            continue
        }
    }

    // Also check for plain text that looks like an osu file (some platforms inline small files)
    const textElements = h.select(session.elements, 'text')
    for (const el of textElements) {
        const content = el.attrs.content as string
        if (content && content.includes('osu file format')) return content
    }

    return null
}
