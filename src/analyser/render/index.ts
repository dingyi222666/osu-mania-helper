import { Context, h } from 'koishi'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

declare module 'koishi' {
    interface Context {
        puppeteer: {
            page(): Promise<import('puppeteer-core').Page>
        }
    }
}

export interface PatternCluster {
    name: string
    amount: number
    subtypes?: string
}

export interface EtternaMSD {
    overall: number
    stream: number
    jumpstream: number
    handstream: number
    stamina: number
    jackSpeed: number
    chordjack: number
    technical: number
}

export interface CardRenderData {
    // Map metadata
    title: string
    artist: string
    creator: string
    version: string
    keyCount: number
    beatmapsetId?: string

    // Analysis results
    starRating: number
    lnPercent: number
    modeTag: string  // RC/LN/HB/Mix
    estimatorName: string
    difficultyText: string
    difficultyTextRc?: string  // RC difficulty line
    difficultyTextLn?: string  // LN difficulty line (if applicable)

    // Pattern data (optional)
    patterns?: PatternCluster[]

    // Etterna MSD (optional)
    etternaMSD?: EtternaMSD

    // Vibro/SV flags
    isVibro?: boolean
    hasSV?: boolean

    // Mods
    modsDisplay?: string
    rateDisplay?: string | null

    // Display mode
    bodyMode: 'pattern' | 'etterna' | 'none'
}

// ─── Star color system (osu! gamma 2.2 interpolation) ───────────────────────

/**
 * osu! star rating color breakpoints and colors.
 * Uses gamma 2.2 RGB interpolation between stops.
 */
const STAR_DOMAIN = [0.1, 1.25, 2, 2.5, 3.3, 4.2, 4.9, 5.8, 6.7, 7.7, 9]
const STAR_COLORS = [
    '#4290FB', '#4FC0FF', '#4FFFD5', '#7CFF4F', '#F6F05C',
    '#FF8068', '#FF4E6F', '#C645B8', '#6563DE', '#18158E', '#000000',
]

function hexToRgb(hex: string): [number, number, number] {
    const stripped = hex.replace('#', '')
    const full = stripped.length === 3
        ? stripped.split('').map(ch => ch + ch).join('')
        : stripped
    const int = parseInt(full, 16)
    return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
    const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0')
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Gamma 2.2 interpolation between two hex colors.
 * Linearizes each channel (pow 2.2), lerps, then delinearizes (pow 1/2.2).
 */
function interpolateGamma22(hexA: string, hexB: string, t: number): string {
    const a = hexToRgb(hexA)
    const b = hexToRgb(hexB)
    const gamma = 2.2
    const invGamma = 1 / gamma

    const result: [number, number, number] = [0, 0, 0]
    for (let i = 0; i < 3; i++) {
        // Linearize (normalize to 0-1, then apply gamma)
        const linA = Math.pow(a[i] / 255, gamma)
        const linB = Math.pow(b[i] / 255, gamma)
        // Lerp in linear space
        const linResult = linA + (linB - linA) * t
        // Delinearize
        result[i] = Math.pow(linResult, invGamma) * 255
    }

    return rgbToHex(result[0], result[1], result[2])
}

/**
 * Returns the osu! star rating color for a given star value.
 * Uses gamma 2.2 interpolation matching the official osu! implementation.
 */
export function starColorFor(starValue: number): string {
    if (!Number.isFinite(starValue) || starValue < 0.1) return '#AAAAAA'
    if (starValue >= 9) return '#000000'

    // Clamp to domain
    const clamped = Math.max(0.1, Math.min(starValue, 9))

    // Find segment
    for (let i = 0; i < STAR_DOMAIN.length - 1; i++) {
        if (clamped >= STAR_DOMAIN[i] && clamped <= STAR_DOMAIN[i + 1]) {
            const t = (clamped - STAR_DOMAIN[i]) / (STAR_DOMAIN[i + 1] - STAR_DOMAIN[i])
            return interpolateGamma22(STAR_COLORS[i], STAR_COLORS[i + 1], t)
        }
    }

    return '#000000'
}

/**
 * Badge text color spectrum for ratings >= 9.
 * Separate interpolation domain/range from the background color.
 */
const TEXT_SPECTRUM_DOMAIN = [9, 9.9, 10.6, 11.5, 12.4]
const TEXT_SPECTRUM_COLORS = [
    '#F6F05C', '#FF8068', '#FF4E6F', '#C645B8', '#6563DE', '#18158E',
]

/**
 * Returns the text color for the difficulty badge based on star rating.
 * - < 6.5: black
 * - < 9: yellow (#F6F05C)
 * - >= 9: interpolated via a separate warm→purple→indigo spectrum
 */
export function starTextColorFor(starValue: number): string {
    if (!Number.isFinite(starValue) || starValue < 0.1) return '#000000'
    if (starValue < 6.5) return '#000000'
    if (starValue < 9) return '#F6F05C'

    // >= 9: interpolate through the text spectrum
    const clamped = Math.min(starValue, TEXT_SPECTRUM_DOMAIN[TEXT_SPECTRUM_DOMAIN.length - 1])

    for (let i = 0; i < TEXT_SPECTRUM_DOMAIN.length - 1; i++) {
        if (clamped >= TEXT_SPECTRUM_DOMAIN[i] && clamped <= TEXT_SPECTRUM_DOMAIN[i + 1]) {
            const t = (clamped - TEXT_SPECTRUM_DOMAIN[i]) / (TEXT_SPECTRUM_DOMAIN[i + 1] - TEXT_SPECTRUM_DOMAIN[i])
            return interpolateGamma22(TEXT_SPECTRUM_COLORS[i], TEXT_SPECTRUM_COLORS[i + 1], t)
        }
    }

    // Beyond max domain: use last color
    return TEXT_SPECTRUM_COLORS[TEXT_SPECTRUM_COLORS.length - 1]
}

// ─── Mode tag colors ────────────────────────────────────────────────────────

function modeTagStyle(tag: string): string {
    switch (tag.toUpperCase()) {
        case 'RC': return 'background:rgba(63,122,216,0.85);border-color:rgba(100,160,255,0.5)'
        case 'LN': return 'background:rgba(150,93,207,0.85);border-color:rgba(180,130,240,0.5)'
        case 'HB': return 'background:rgba(206,121,58,0.85);border-color:rgba(240,160,90,0.5)'
        case 'MIX': return 'background:rgba(72,141,122,0.85);border-color:rgba(100,180,155,0.5)'
        default: return 'background:rgba(72,141,122,0.85);border-color:rgba(100,180,155,0.5)'
    }
}

function modeTagValueStyle(tag: string): string {
    switch (tag.toUpperCase()) {
        case 'RC': return 'color:rgba(100,170,255,1)'
        case 'LN': return 'color:rgba(180,130,240,1)'
        case 'HB': return 'color:rgba(240,160,90,1)'
        case 'MIX': return 'color:rgba(100,200,170,1)'
        default: return 'color:rgba(100,200,170,1)'
    }
}

// ─── Per-bar gradient (multi-stop, only up to the fill point's color) ───────

/**
 * The full spectrum domain (position 0-1) and colors.
 * We slice this spectrum up to the bar's fill ratio, then stretch
 * the included stops to fill the bar width (0%-100%).
 */
const SPECTRUM_DOMAIN = [0, 0.125, 0.2, 0.25, 0.33, 0.42, 0.49, 0.58, 0.67, 0.77]
const SPECTRUM_COLORS = [
    '#4290FB', '#4FC0FF', '#4FFFD5', '#7CFF4F', '#F6F05C',
    '#FF8068', '#FF4E6F', '#C645B8', '#6563DE', '#18158E',
]

/**
 * Builds a multi-stop CSS gradient that only covers the spectrum
 * from 0 up to `cutoff` (0-1). All included stops are remapped
 * to 0%-100% within the bar, and the exact color at the cutoff
 * is interpolated and placed at 100%.
 *
 * This means a bar at 30% fill shows blue→cyan→green (bright),
 * while a bar at 75% shows blue→...→pink. Dark purple/black never appears
 * because typical MSD values don't reach that high.
 */
function buildSpectrumGradient(cutoff: number): string {
    const c = Math.max(0.01, Math.min(cutoff, 1))

    const stops: string[] = []

    // Add all spectrum stops that fall within [0, cutoff)
    for (let i = 0; i < SPECTRUM_DOMAIN.length; i++) {
        if (SPECTRUM_DOMAIN[i] < c) {
            const pct = (SPECTRUM_DOMAIN[i] / c) * 100
            stops.push(`${SPECTRUM_COLORS[i]} ${pct.toFixed(1)}%`)
        } else if (SPECTRUM_DOMAIN[i] === c) {
            // Exact match at cutoff
            stops.push(`${SPECTRUM_COLORS[i]} 100%`)
            return `linear-gradient(to right, ${stops.join(', ')})`
        } else {
            break
        }
    }

    // Interpolate the exact color at the cutoff point
    let endColor = SPECTRUM_COLORS[SPECTRUM_COLORS.length - 1]
    for (let i = 0; i < SPECTRUM_DOMAIN.length - 1; i++) {
        if (c >= SPECTRUM_DOMAIN[i] && c <= SPECTRUM_DOMAIN[i + 1]) {
            const t = (c - SPECTRUM_DOMAIN[i]) / (SPECTRUM_DOMAIN[i + 1] - SPECTRUM_DOMAIN[i])
            endColor = interpolateGamma22(SPECTRUM_COLORS[i], SPECTRUM_COLORS[i + 1], t)
            break
        }
    }
    stops.push(`${endColor} 100%`)

    // Fallback: if only one stop, make a solid color
    if (stops.length === 1) {
        return `linear-gradient(to right, #4290FB, ${endColor})`
    }

    return `linear-gradient(to right, ${stops.join(', ')})`
}

/**
 * Computes a per-bar inline gradient for Etterna MSD bars.
 * Maps MSD value (0-30) to the spectrum cutoff (0-0.77 range).
 * Using 30 as the max compresses the color range so higher MSD values
 * (20-26+) appear darker/more intense, matching Etterna's feel.
 */
function barGradientFor(msdValue: number): string {
    // MSD 0-30 maps to spectrum position 0-0.77 (full domain range)
    // Values above 30 clamp to the darkest end of the spectrum
    const cutoff = Math.max(0.01, Math.min(msdValue / 30, 1)) * 0.77
    return buildSpectrumGradient(cutoff)
}

/**
 * Computes a per-bar inline gradient for pattern bars based on fill ratio.
 * Fill ratio 0-1 maps to spectrum position 0-0.49 (stays in bright range).
 */
function barGradientForRatio(fillRatio: number): string {
    // Pattern bars: map 0-1 fill to 0-0.49 of spectrum (blue to pink, stays bright)
    const cutoff = Math.max(0.01, Math.min(fillRatio, 1)) * 0.49
    return buildSpectrumGradient(cutoff)
}

// ─── HTML template ──────────────────────────────────────────────────────────

import { getCardTemplate } from './templates/cardTemplate'

// ─── Template rendering ─────────────────────────────────────────────────────

function buildPatternBarsHtml(patterns: PatternCluster[], starColor: string): string {
    if (!patterns || patterns.length === 0) return ''

    const topFive = patterns.slice(0, 5)
    const totalAmount = topFive.reduce((sum, p) => sum + p.amount, 0) || 1
    const maxAmount = Math.max(...topFive.map(p => p.amount), 1)

    return topFive.map((cluster) => {
        const percent = (cluster.amount / totalAmount) * 100
        const fillRatio = Math.max(0, Math.min(cluster.amount / maxAmount, 1))
        const gradient = barGradientForRatio(fillRatio)
        const subtype = cluster.subtypes || ''
        const subtypeHtml = subtype
            ? `<div class="bar-item__subtypes">${escapeHtml(subtype)}</div>`
            : ''
        return `
            <div class="bar-item">
                <div class="bar-item__header">
                    <span class="bar-item__label">${escapeHtml(cluster.name)}</span>
                    <span class="bar-item__value">${percent.toFixed(1)}%</span>
                </div>
                <div class="bar-item__track">
                    <div class="bar-item__fill" style="width:${(fillRatio * 100).toFixed(1)}%;background:${gradient}"></div>
                </div>
                ${subtypeHtml}
            </div>
        `
    }).join('')
}

function buildEtternaBarsHtml(msd: EtternaMSD): string {
    const skills: [string, number][] = [
        ['Stream', msd.stream],
        ['Jumpstream', msd.jumpstream],
        ['Handstream', msd.handstream],
        ['Stamina', msd.stamina],
        ['JackSpeed', msd.jackSpeed],
        ['Chordjack', msd.chordjack],
        ['Technical', msd.technical],
    ]

    // Absolute scale: MSD 40 = 100% fill (cap at 40)
    const MSD_MAX = 40

    return skills.map(([name, value]) => {
        const fillRatio = Math.min(1, Math.max(0, value / MSD_MAX))
        const width = fillRatio * 100
        const gradient = barGradientFor(value)
        return `
            <div class="ett-item">
                <div class="ett-item__header">
                    <span class="ett-item__label">${name}</span>
                    <span class="ett-item__value">${value.toFixed(2)}</span>
                </div>
                <div class="ett-item__track">
                    <div class="ett-item__fill" style="width:${width.toFixed(1)}%;background:${gradient}"></div>
                </div>
            </div>
        `
    }).join('')
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function buildModsHtml(modsDisplay?: string, rateDisplay?: string | null): string {
    if (!modsDisplay || modsDisplay === 'NM') return ''

    // Parse individual mod codes (2-char each)
    const mods: string[] = []
    for (let i = 0; i < modsDisplay.length; i += 2) {
        mods.push(modsDisplay.slice(i, i + 2))
    }

    const speedMods = ['DT', 'NC', 'HR']
    const easyMods = ['HT', 'DC', 'EZ']

    let html = mods.map(mod => {
        const isSpeed = speedMods.includes(mod)
        const isEasy = easyMods.includes(mod)
        const cls = isSpeed ? 'pill--mod-speed' : isEasy ? 'pill--mod-easy' : 'pill--mod-speed'
        return `<span class="pill pill--mod ${cls}">${mod}</span>`
    }).join('')

    if (rateDisplay) {
        html += `<span class="pill pill--mod pill--mod-speed">${escapeHtml(rateDisplay)}</span>`
    }

    return html
}

function buildFlagsHtml(hasSV?: boolean, isVibro?: boolean): string {
    let html = ''
    if (hasSV) html += '<span class="pill pill--sv">SV</span>'
    if (isVibro) html += '<span class="pill pill--vibro">VIBRO</span>'
    return html
}

// ─── Font embedding (base64 for reliable puppeteer rendering) ───────────────

let _fontCssCache: string | null = null

function getFontCss(): string {
    if (_fontCssCache !== null) return _fontCssCache

    const runtimeDir = typeof __dirname === 'string' ? __dirname : path.dirname(fileURLToPath(import.meta.url))
    const fontsDir = path.resolve(runtimeDir, '../resources/analyser/fonts')

    const torusFonts: { file: string; weight: number }[] = [
        { file: 'Torus-Light.otf', weight: 300 },
        { file: 'Torus-Regular.otf', weight: 400 },
        { file: 'Torus-SemiBold.otf', weight: 600 },
        { file: 'Torus-Bold.otf', weight: 700 },
    ]

    let css = torusFonts.map(({ file, weight }) => {
        const filePath = path.join(fontsDir, file)
        const base64 = fs.readFileSync(filePath).toString('base64')
        return `@font-face {
    font-family: 'Torus';
    font-weight: ${weight};
    src: url(data:font/opentype;base64,${base64}) format('opentype');
    font-display: block;
}`
    }).join('\n')

    // Icon fonts: Font Awesome 5 Free (solid, weight 900) for star icon
    const faSolidPath = path.join(fontsDir, 'fa-solid-900.woff2')
    if (fs.existsSync(faSolidPath)) {
        const base64 = fs.readFileSync(faSolidPath).toString('base64')
        css += `\n@font-face {
    font-family: 'Font Awesome 5 Free';
    font-weight: 900;
    src: url(data:font/woff2;base64,${base64}) format('woff2');
    font-display: block;
}`
    }

    // Icon fonts: FontAwesomeExtra (weight 400) for mania mode icon
    const faExtraPath = path.join(fontsDir, 'FontAwesomeExtra.woff2')
    if (fs.existsSync(faExtraPath)) {
        const base64 = fs.readFileSync(faExtraPath).toString('base64')
        css += `\n@font-face {
    font-family: 'FontAwesomeExtra';
    font-weight: 400;
    src: url(data:font/woff2;base64,${base64}) format('woff2');
    font-display: block;
}`
    }

    _fontCssCache = css
    return _fontCssCache
}

function buildHtml(data: CardRenderData): string {
    const template = getCardTemplate()

    // Embed fonts as base64 data URIs for reliable puppeteer rendering
    const fontCss = getFontCss()

    const starColor = starColorFor(data.starRating)
    const badgeTextColor = starTextColorFor(data.starRating)

    // Cover image URL
    const coverUrl = data.beatmapsetId
        ? `https://assets.ppy.sh/beatmaps/${data.beatmapsetId}/covers/cover@2x.jpg`
        : ''

    // Build cover <img> tag (uses <img> so document.images can detect it for load waiting)
    const coverImgTag = coverUrl
        ? `<img class="main-panel__cover" src="${coverUrl}" alt="" />`
        : ''

    // Title bar name: "artist - title"
    const titleBarName = `${data.artist} - ${data.title}`

    // Build body content
    let patternHtml = ''
    let etternaHtml = ''

    if (data.bodyMode === 'pattern' && data.patterns && data.patterns.length > 0) {
        patternHtml = buildPatternBarsHtml(data.patterns, starColor)
    } else if (data.bodyMode === 'etterna' && data.etternaMSD) {
        etternaHtml = buildEtternaBarsHtml(data.etternaMSD)
    }

    // Etterna overall badge
    const ettOverallHtml = data.etternaMSD && data.bodyMode === 'etterna'
        ? `<div class="stat-chip"><span class="stat-chip__label">MSD</span><span class="stat-chip__value">${data.etternaMSD.overall.toFixed(2)}</span></div>`
        : ''

    // Mods
    const modsHtml = buildModsHtml(data.modsDisplay, data.rateDisplay)

    // Flags
    const flagsHtml = buildFlagsHtml(data.hasSV, data.isVibro)

    // Replace placeholders
    return template
        .replace(/\{\{fontCss\}\}/g, fontCss)
        .replace('{{titleBarName}}', escapeHtml(titleBarName))
        .replace('{{starColor}}', starColor)
        .replace('{{badgeTextColor}}', badgeTextColor)
        .replace(/\{\{starRating\}\}/g, data.starRating.toFixed(2))
        .replace('{{version}}', escapeHtml(data.version || '-'))
        .replace('{{creator}}', escapeHtml(data.creator || 'Unknown'))
        .replace('{{coverImgTag}}', coverImgTag)
        .replace('{{difficultyTextRc}}', escapeHtml(data.difficultyTextRc || data.difficultyText))
        .replace('{{difficultyLnHtml}}', data.difficultyTextLn
            ? `<div class="main-panel__rating">${escapeHtml(data.difficultyTextLn)}</div>`
            : '')
        .replace('{{modeTag}}', escapeHtml(data.modeTag))
        .replace('{{modeTagValueStyle}}', modeTagValueStyle(data.modeTag))
        .replace('{{modsHtml}}', modsHtml)
        .replace('{{flagsHtml}}', flagsHtml)
        .replace('{{keyCount}}', String(data.keyCount))
        .replace('{{lnPercent}}', (data.lnPercent * 100).toFixed(1))
        .replace('{{bpmChipHtml}}', '')  // BPM not currently available in analysis
        .replace('{{ettOverallHtml}}', ettOverallHtml)
        .replace('{{patternContent}}', patternHtml)
        .replace('{{etternaContent}}', etternaHtml)
        .replace('{{patternDisplay}}', data.bodyMode === 'pattern' ? 'flex' : 'none')
        .replace('{{etternaDisplay}}', data.bodyMode === 'etterna' ? 'flex' : 'none')
}

// ─── Puppeteer rendering ────────────────────────────────────────────────────

export async function renderCard(ctx: Context, data: CardRenderData): Promise<h | null> {
    if (!ctx.puppeteer) return null

    const html = buildHtml(data)

    let page: Awaited<ReturnType<typeof ctx.puppeteer.page>> | undefined
    try {
        page = await ctx.puppeteer.page()
        await page.setViewport({ width: 740, height: 800 })
        await page.setContent(html, { waitUntil: 'domcontentloaded' })
        await page.evaluate(() => document.fonts.ready)
        // Wait for images to load (with 5s timeout so it doesn't hang forever)
        await page.evaluate(() => {
            return Promise.race([
                Promise.all(
                    Array.from(document.images).map(img =>
                        img.complete ? Promise.resolve() : new Promise(resolve => {
                            img.onload = resolve
                            img.onerror = resolve
                        })
                    )
                ),
                new Promise(resolve => setTimeout(resolve, 5000))
            ])
        })

        const card = await page.$('.card')
        if (!card) {
            await page.close()
            return null
        }

        const screenshot = await card.screenshot({ type: 'png' }) as Buffer
        await page.close()
        return h.image(screenshot, 'image/png')
    } catch (error) {
        if (page) {
            try { await page.close() } catch { /* ignore */ }
        }
        ctx.logger.warn('Card render failed:', error)
        return null
    }
}

// ─── Build CardRenderData from AnalysisResult ───────────────────────────────

export function buildCardData(
    result: import('../core/analysis').AnalysisResult,
    mixedOverride: { estDiff?: string; star?: number } | null,
    config: { cardBody: string },
): CardRenderData {
    const meta = result.metadata
    const title = meta['Title'] || meta['TitleUnicode'] || 'Unknown'
    const artist = meta['Artist'] || meta['ArtistUnicode'] || 'Unknown'
    const version = meta['Version'] || ''
    const creator = meta['Creator'] || ''
    const beatmapsetId = meta['BeatmapSetID'] || undefined

    let starRating = 0
    let difficultyText = '-'
    let estimatorName = '-'
    let difficultyTextRc: string | undefined
    let difficultyTextLn: string | undefined

    if (mixedOverride && 'star' in mixedOverride) {
        starRating = mixedOverride.star ?? 0
        difficultyText = mixedOverride.estDiff ?? '-'
        estimatorName = 'Mixed'
    } else if (result.estimator) {
        starRating = result.estimator.star
        difficultyText = result.estimator.estDiff
        estimatorName = result.actualEstimatorAlgorithm ?? '-'
    }

    // Split difficulty text into RC and LN parts
    const diffParts = difficultyText.split('||').map(s => s.trim()).filter(s => s.length > 0)
    if (diffParts.length >= 2) {
        difficultyTextRc = diffParts[0]
        difficultyTextLn = diffParts[1]
    } else {
        difficultyTextRc = diffParts[0] || difficultyText
        // Only show LN line if the map actually has significant LN content
        difficultyTextLn = undefined
    }

    // Determine body mode
    // In 'auto' mode, prefer etterna MSD (more meaningful difficulty info) over raw pattern counts
    let bodyMode: 'pattern' | 'etterna' | 'none' = 'none'
    if (config.cardBody === 'auto') {
        if (result.etternaResult?.values) {
            bodyMode = 'etterna'
        } else if (result.patternReport?.Clusters && result.patternReport.Clusters.length > 0) {
            bodyMode = 'pattern'
        }
    } else if (config.cardBody === 'pattern') {
        bodyMode = 'pattern'
    } else if (config.cardBody === 'etterna') {
        bodyMode = 'etterna'
    }

    // Build pattern clusters
    let patterns: PatternCluster[] | undefined
    if (result.patternReport?.Clusters) {
        patterns = result.patternReport.Clusters.map((c) => ({
            name: String(c.Pattern || ''),
            amount: Number(c.Amount) || 0,
            subtypes: Array.isArray(c.SpecificTypes)
                ? c.SpecificTypes.map(([name, ratio]) =>
                    `${name} (${(ratio * 100).toFixed(1)}%)`
                ).join(', ')
                : undefined,
        }))
    }

    // Build etterna MSD
    let etternaMSD: EtternaMSD | undefined
    if (result.etternaResult?.values) {
        const v = result.etternaResult.values
        etternaMSD = {
            overall: Number(v.Overall) || 0,
            stream: Number(v.Stream) || 0,
            jumpstream: Number(v.Jumpstream) || 0,
            handstream: Number(v.Handstream) || 0,
            stamina: Number(v.Stamina) || 0,
            jackSpeed: Number(v.JackSpeed) || 0,
            chordjack: Number(v.Chordjack) || 0,
            technical: Number(v.Technical) || 0,
        }
    }

    return {
        title,
        artist,
        creator,
        version,
        keyCount: result.keycount,
        beatmapsetId,
        starRating,
        lnPercent: result.lnRatio,
        modeTag: result.modeTag,
        estimatorName,
        difficultyText,
        difficultyTextRc,
        difficultyTextLn,
        patterns,
        etternaMSD,
        isVibro: result.isVibro,
        hasSV: result.isSv,
        bodyMode,
    }
}
