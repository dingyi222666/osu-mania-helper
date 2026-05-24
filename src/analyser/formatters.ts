import { Context, h } from 'koishi'
import { AnalyserConfig } from './config'
import { type AnalysisResult } from './core/analysis'
import { fetchBeatmapOwners } from './core/downloader'
import { renderCard, buildCardData } from './render'
import { type ParsedMods } from './utils'

/**
 * Orchestrates result formatting: tries card rendering via puppeteer,
 * falls back to plain text if unavailable or on error.
 */
export async function formatResult(
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
            // Fetch beatmap owners from API for mapper line
            if (cardData.beatmapId) {
                const owners = await fetchBeatmapOwners(ctx, cardData.beatmapId)
                if (owners && owners.length > 0) {
                    cardData.mapperNames = owners
                }
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

/**
 * Formats analysis results as plain text (fallback when card rendering is unavailable).
 */
export function formatTextResult(
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
