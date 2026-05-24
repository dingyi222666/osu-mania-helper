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

export interface GraphData {
    times: number[]
    values: number[]
}

export interface CardRenderData {
    // Map metadata
    title: string
    artist: string
    creator: string
    version: string
    keyCount: number
    beatmapsetId?: string
    beatmapId?: string

    // Mapper line info (from API)
    mapperNames?: string[]  // If multiple: guest difficulty by X, Y, Z

    // Analysis results
    starRating: number
    lnPercent: number
    bpm: number
    modeTag: string  // RC/LN/HB/Mix
    estimatorName: string
    difficultyText: string
    difficultyTextRc?: string  // RC difficulty line
    difficultyTextLn?: string  // LN difficulty line (if applicable)

    // Pattern data (optional)
    patterns?: PatternCluster[]

    // Etterna MSD (optional)
    etternaMSD?: EtternaMSD

    // Graph data (optional)
    graphData?: GraphData

    // Vibro/SV flags
    isVibro?: boolean
    hasSV?: boolean

    // Mods
    modsDisplay?: string
    rateDisplay?: string | null

    // Display mode
    bodyMode: 'pattern' | 'etterna' | 'graph' | 'none'
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

/**
 * Expands mode tag abbreviations to full community names.
 */
function expandModeTag(tag: string): string {
    switch (tag.toUpperCase()) {
        case 'RC': return 'Rice'
        case 'LN': return 'LN'
        case 'HB': return 'Hybrid'
        case 'MIX': return 'Mixed'
        default: return tag
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

// ─── HTML template ──────────────────────────────────────────────────────────

import { getCardTemplate } from './templates/cardTemplate'
import { MOD_SVG_DT, MOD_SVG_NC, MOD_SVG_HT, MOD_SVG_DC, MOD_SVG_HR, MOD_SVG_HD, MOD_SVG_EZ, MOD_SVG_NF, MOD_SVG_FL, MOD_SVG_FI, MOD_SVG_SD, MOD_SVG_PF, MOD_SVG_MR, MOD_SVG_IN, MOD_SVG_HO } from './modIcons'

// ─── Radar Chart SVG generation ─────────────────────────────────────────────

/**
 * Generates a radar chart SVG string.
 * @param data Array of {label, value} for each axis
 * @param maxValue Maximum value for the scale (edge of chart)
 * @param fillColor CSS color for the data polygon fill (will be made semi-transparent)
 * @param strokeColor CSS color for the data polygon stroke
 */
function buildRadarChartSvg(
    data: { label: string; value: number }[],
    maxValue: number,
    fillColor: string,
    strokeColor: string,
    valueFormat: 'percent' | 'decimal' = 'percent',
): string {
    const n = data.length
    if (n < 3) return ''

    const cx = 130
    const cy = 120
    const radius = 85
    const labelRadius = radius + 18
    const viewW = 280
    const viewH = 250

    // Angle for each axis (start from top, go clockwise)
    const angleStep = (2 * Math.PI) / n
    const startAngle = -Math.PI / 2

    function polarToXY(angle: number, r: number): [number, number] {
        return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
    }

    // Build grid polygons (3 levels: 33%, 66%, 100%)
    const gridLevels = [0.33, 0.66, 1.0]
    const gridPolygons = gridLevels.map(level => {
        const points = Array.from({ length: n }, (_, i) => {
            const angle = startAngle + i * angleStep
            const [x, y] = polarToXY(angle, radius * level)
            return `${x.toFixed(1)},${y.toFixed(1)}`
        }).join(' ')
        return `<polygon points="${points}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`
    }).join('\n    ')

    // Build axis lines
    const axisLines = Array.from({ length: n }, (_, i) => {
        const angle = startAngle + i * angleStep
        const [x, y] = polarToXY(angle, radius)
        return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`
    }).join('\n    ')

    // Build data polygon
    const dataPoints = data.map((d, i) => {
        const angle = startAngle + i * angleStep
        const ratio = Math.min(d.value / maxValue, 1)
        const [x, y] = polarToXY(angle, radius * ratio)
        return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')

    // Convert hex fill color to rgba
    const fillRgb = hexToRgb(fillColor)
    const fillRgba = `rgba(${fillRgb[0]},${fillRgb[1]},${fillRgb[2]},0.25)`
    const strokeRgba = `rgba(${fillRgb[0]},${fillRgb[1]},${fillRgb[2]},0.85)`

    // Build labels with values
    const labels = data.map((d, i) => {
        const angle = startAngle + i * angleStep
        const [x, y] = polarToXY(angle, labelRadius)
        // Text anchor based on position
        let anchor = 'middle'
        if (x < cx - 5) anchor = 'end'
        else if (x > cx + 5) anchor = 'start'
        // Vertical adjustment
        let dy = '0.35em'
        if (y < cy - 30) dy = '0.8em'
        else if (y > cy + 30) dy = '0em'
        const valueStr = d.value > 0
            ? (valueFormat === 'decimal' ? d.value.toFixed(2) : `${d.value.toFixed(1)}%`)
            : ''
        const valueLine = valueStr ? `<tspan x="${x.toFixed(1)}" dy="11" font-size="8" fill="rgba(255,255,255,0.55)">${valueStr}</tspan>` : ''
        return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="rgba(255,255,255,0.7)" font-size="9" font-weight="400" text-anchor="${anchor}" dy="${dy}"><tspan>${escapeHtml(d.label)}</tspan>${valueLine}</text>`
    }).join('\n    ')

    return `<svg viewBox="0 0 ${viewW} ${viewH}" width="${viewW}" height="${viewH}" xmlns="http://www.w3.org/2000/svg">
    ${gridPolygons}
    ${axisLines}
    <polygon points="${dataPoints}" fill="${fillRgba}" stroke="${strokeRgba}" stroke-width="1.5"/>
    ${labels}
</svg>`
}

// ─── Template rendering ─────────────────────────────────────────────────────

function buildPatternRadarSvg(patterns: PatternCluster[], fillColor: string): string {
    if (!patterns || patterns.length === 0) return ''

    const topItems = patterns.slice(0, 7) // Radar works best with 3-7 axes
    if (topItems.length < 3) {
        // Pad to minimum 3 for a valid polygon
        while (topItems.length < 3) {
            topItems.push({ name: '-', amount: 0 })
        }
    }

    // Calculate total for percentage conversion
    const totalAmount = patterns.reduce((sum, p) => sum + p.amount, 0) || 1

    const data = topItems.map(p => ({
        label: p.name,
        value: (p.amount / totalAmount) * 100, // percentage
    }))

    // Dynamic max scale: highest value × 1.2 (20% headroom), minimum 30
    const highestValue = Math.max(...data.map(d => d.value))
    const maxValue = Math.max(30, highestValue * 1.2)

    return `<div class="radar-chart">
        <span class="radar-chart__title">Patterns</span>
        ${buildRadarChartSvg(data, maxValue, fillColor, fillColor, 'percent')}
    </div>`
}

function buildEtternaRadarSvg(msd: EtternaMSD, fillColor: string): string {
    const data = [
        { label: 'Stream', value: msd.stream },
        { label: 'JS', value: msd.jumpstream },
        { label: 'HS', value: msd.handstream },
        { label: 'Stamina', value: msd.stamina },
        { label: 'Jack', value: msd.jackSpeed },
        { label: 'CJ', value: msd.chordjack },
        { label: 'Tech', value: msd.technical },
    ]

    const maxValue = 40

    return `<div class="radar-chart">
        <span class="radar-chart__title">Etterna MSD</span>
        ${buildRadarChartSvg(data, maxValue, fillColor, fillColor, 'decimal')}
    </div>`
}

// ─── Difficulty Graph SVG generation ────────────────────────────────────────

/**
 * Builds a difficulty-over-time SVG graph.
 * Uses position-based star rating colors with gradient transitions.
 * @param graphData The time/value series from the estimator
 * @param lineColor CSS color fallback (unused now, kept for API compat)
 */
function buildDiffGraphSvg(graphData: GraphData, lineColor: string): string {
    const { times, values } = graphData
    if (!times || !values || times.length < 2) return ''

    const width = 520
    const height = 120
    const padX = 0
    const padTop = 8
    const padBottom = 4

    const plotW = width - padX * 2
    const plotH = height - padTop - padBottom

    const minTime = times[0]
    const maxTime = times[times.length - 1]
    const timeSpan = maxTime - minTime
    if (timeSpan <= 0) return ''

    // Find min/max values for Y scaling
    // Use 0 as the floor so break sections appear as flat at the bottom
    let minVal = 0
    let maxVal = -Infinity
    for (const v of values) {
        if (v > maxVal) maxVal = v
    }
    // Ensure we have a valid range
    if (maxVal <= 0) maxVal = 1
    const valSpan = maxVal - minVal

    // Downsample if too many points (keep it under ~260 points for SVG size)
    const maxPoints = 260
    let sampledTimes = times
    let sampledValues = values
    if (times.length > maxPoints) {
        const step = times.length / maxPoints
        sampledTimes = []
        sampledValues = []
        for (let i = 0; i < maxPoints; i++) {
            const idx = Math.min(Math.floor(i * step), times.length - 1)
            sampledTimes.push(times[idx])
            sampledValues.push(values[idx])
        }
        // Always include last point
        sampledTimes.push(times[times.length - 1])
        sampledValues.push(values[values.length - 1])
    }

    // Build polyline points
    const points: string[] = []
    for (let i = 0; i < sampledTimes.length; i++) {
        const x = padX + ((sampledTimes[i] - minTime) / timeSpan) * plotW
        const y = padTop + plotH - ((sampledValues[i] - minVal) / valSpan) * plotH
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }

    // Build position-based gradient stops from sampled difficulty values
    // The raw values are strain values (typically 0-30+), NOT star ratings (0-9).
    // We normalize them to the 0-8 star range for color mapping, capping at 8
    // to avoid the black zone (starColorFor returns black at 9+).
    const normalizeForColor = (rawValue: number): number => {
        // Map raw strain value to approximate star rating equivalent
        // maxVal in the data represents the peak difficulty; map it to ~7-8 stars
        // Values near 0 should map to ~1 star (still colorful, not grey)
        const normalized = (rawValue / maxVal) * 7.5 + 0.5
        return Math.min(Math.max(normalized, 0.1), 8)
    }

    // Use more gradient stops for smoother color transitions (at least 40)
    const numStops = Math.min(sampledTimes.length, 50)
    const stopStep = Math.max(1, Math.floor(sampledTimes.length / numStops))
    const gradientStops: string[] = []
    for (let i = 0; i < sampledTimes.length; i += stopStep) {
        const offset = ((sampledTimes[i] - minTime) / timeSpan) * 100
        const color = starColorFor(normalizeForColor(sampledValues[i]))
        gradientStops.push(`<stop offset="${offset.toFixed(1)}%" stop-color="${color}"/>`)
    }
    // Always include last point
    const lastColor = starColorFor(normalizeForColor(sampledValues[sampledValues.length - 1]))
    gradientStops.push(`<stop offset="100%" stop-color="${lastColor}"/>`)

    const gradId = 'diffGrad'

    // Subtle grid lines (3 horizontal)
    const gridLines: string[] = []
    for (let i = 1; i <= 3; i++) {
        const gy = padTop + (plotH * i) / 4
        gridLines.push(`<line x1="${padX}" y1="${gy.toFixed(1)}" x2="${padX + plotW}" y2="${gy.toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>`)
    }

    return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;">
    <defs>
        <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
            ${gradientStops.join('\n            ')}
        </linearGradient>
    </defs>
    ${gridLines.join('\n    ')}
    <polyline points="${points.join(' ')}" fill="none" stroke="url(#${gradId})" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`
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

    // osu! mod type colour (from osu-web: colors.less)
    // --c-saturation-1: 100%, --c-lightness-1: 70%
    //   DifficultyIncrease (red-1): hsl(360, 100%, 70%)
    //   DifficultyReduction (lime-1): hsl(90, 100%, 70%)
    //   Conversion (purple-1): hsl(255, 100%, 70%)
    //   Automation (blue-1): hsl(200, 100%, 70%)
    //   Fun (pink-1): hsl(333, 100%, 70%)
    //   System: #ffcc22
    function modTypeColour(mod: string): string {
        switch (mod) {
            case 'DT': case 'NC': case 'HR': case 'HD': case 'FL': case 'FI': case 'SD': case 'PF':
                return 'hsl(360, 100%, 70%)'
            case 'HT': case 'DC': case 'EZ': case 'NF':
                return 'hsl(90, 100%, 70%)'
            case 'IN': case 'HO': case 'MR':
                return 'hsl(255, 100%, 70%)'
            default:
                return 'hsl(200, 100%, 70%)'
        }
    }

    // Map mod acronym to its SVG icon data URI
    // Extracted from osu-web: public/images/badges/mods/mod-*.svg
    function modIconSvg(mod: string): string {
        switch (mod) {
            case 'DT': return MOD_SVG_DT
            case 'NC': return MOD_SVG_NC
            case 'HT': return MOD_SVG_HT
            case 'DC': return MOD_SVG_DC
            case 'HR': return MOD_SVG_HR
            case 'HD': return MOD_SVG_HD
            case 'EZ': return MOD_SVG_EZ
            case 'NF': return MOD_SVG_NF
            case 'FL': return MOD_SVG_FL
            case 'FI': return MOD_SVG_FI
            case 'SD': return MOD_SVG_SD
            case 'PF': return MOD_SVG_PF
            case 'MR': return MOD_SVG_MR
            case 'IN': return MOD_SVG_IN
            case 'HO': return MOD_SVG_HO
            default: return ''
        }
    }

    // Determine which mod gets the rate extender
    const speedMods = new Set(['DT', 'NC', 'HT', 'DC'])

    let html = ''
    for (const mod of mods) {
        const colour = modTypeColour(mod)
        const hasRate = speedMods.has(mod) && rateDisplay
        const iconSvg = modIconSvg(mod)

        html += `<span class="mod-group" style="--mod-colour:${colour}">`
        html += `<span class="mod-icon"><span class="mod-icon__bg"></span>`
        if (iconSvg) {
            html += `<span class="mod-icon__fg" style="mask-image:url(&quot;${iconSvg}&quot;)"></span>`
        }
        html += `</span>`
        if (hasRate) {
            html += `<span class="mod-extender"><span>${escapeHtml(rateDisplay!)}</span></span>`
        }
        html += `</span>`
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

    // Title bar name: "Title by Artist" (osu! style)
    const titleBarName = `${data.title} by ${data.artist}`

    // Mapper line: "guest difficulty by X, Y, Z" or "mapped by Creator"
    // Rendered as inline text that flows naturally after the version name
    let mapperHtml: string
    if (data.mapperNames && data.mapperNames.length > 1) {
        const names = data.mapperNames.map(n => `<span class="title-bar__mapper-name">${escapeHtml(n)}</span>`)
        mapperHtml = `<span class="title-bar__mapper">guest difficulty by ${names.join(', ')}</span>`
    } else {
        const name = data.mapperNames?.[0] || data.creator || 'Unknown'
        mapperHtml = `<span class="title-bar__mapper">mapped by <span class="title-bar__mapper-name">${escapeHtml(name)}</span></span>`
    }

    // Build body content - radar charts or graph
    let radarHtml = ''

    // Compute MSD-based fill color for radar charts (capped to avoid too-dark colors)
    const msdForColor = data.etternaMSD ? data.etternaMSD.overall : 0
    const radarFillColor = starColorFor(Math.min(msdForColor * 9 / 30, 6.5))

    if (data.bodyMode === 'graph' && data.graphData) {
        radarHtml = buildDiffGraphSvg(data.graphData, starColor)
    } else if (data.bodyMode === 'etterna' && data.etternaMSD) {
        radarHtml = buildEtternaRadarSvg(data.etternaMSD, radarFillColor)
    } else if (data.bodyMode === 'pattern' && data.patterns && data.patterns.length > 0) {
        radarHtml = buildPatternRadarSvg(data.patterns, radarFillColor)
    }

    // Etterna overall badge - always show when MSD data is available
    const ettOverallHtml = data.etternaMSD
        ? `<div class="stat-chip"><span class="stat-chip__label">MSD</span><span class="stat-chip__value" style="color:#ffffff">${data.etternaMSD.overall.toFixed(2)}</span></div>`
        : ''

    // Mode tag: expand abbreviations to full names
    const modeTagDisplay = expandModeTag(data.modeTag)

    // Mods
    const modsHtml = buildModsHtml(data.modsDisplay, data.rateDisplay)

    // Flags
    const flagsHtml = buildFlagsHtml(data.hasSV, data.isVibro)

    // Replace placeholders
    return template
        .replace(/\{\{fontCss\}\}/g, fontCss)
        .replace('{{titleText}}', escapeHtml(data.title))
        .replace('{{artistText}}', escapeHtml(data.artist))
        .replace('{{starColor}}', starColor)
        .replace('{{badgeTextColor}}', badgeTextColor)
        .replace(/\{\{starRating\}\}/g, data.starRating.toFixed(2))
        .replace('{{version}}', escapeHtml(`[${data.keyCount}K] ${data.version || '-'}`))
        .replace('{{mapperHtml}}', mapperHtml)
        .replace('{{coverImgTag}}', coverImgTag)
        .replace('{{difficultyTextRc}}', escapeHtml(data.difficultyTextRc || data.difficultyText))
        .replace('{{difficultyLnHtml}}', data.difficultyTextLn
            ? `<div class="main-panel__rating">${escapeHtml(data.difficultyTextLn)}</div>`
            : '')
        .replace('{{modeTag}}', escapeHtml(modeTagDisplay))
        .replace('{{modeTagValueStyle}}', modeTagValueStyle(data.modeTag))
        .replace('{{modsHtml}}', modsHtml)
        .replace('{{flagsHtml}}', flagsHtml)
        .replace('{{lnPercent}}', (data.lnPercent * 100).toFixed(1))
        .replace('{{bpmChipHtml}}', data.bpm > 0
            ? `<div class="stat-chip"><span class="stat-chip__label">BPM</span><span class="stat-chip__value">${data.bpm}</span></div>`
            : '')
        .replace('{{ettOverallHtml}}', ettOverallHtml)
        .replace('{{radarContent}}', radarHtml)
        .replace('{{radarDisplay}}', data.bodyMode !== 'none' && radarHtml ? 'flex' : 'none')
}

// ─── Puppeteer rendering ────────────────────────────────────────────────────

export async function renderCard(ctx: Context, data: CardRenderData): Promise<h | null> {
    if (!ctx.puppeteer) return null

    const html = buildHtml(data)

    let page: Awaited<ReturnType<typeof ctx.puppeteer.page>> | undefined
    try {
        page = await ctx.puppeteer.page()
        await page.setViewport({ width: 620, height: 800, deviceScaleFactor: 2 })
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
    const beatmapId = meta['BeatmapID'] || undefined

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
    // In 'auto' mode, follow original project logic:
    //   RC → Etterna, everything else (LN/HB/Mix) → Pattern
    let bodyMode: 'pattern' | 'etterna' | 'graph' | 'none' = 'none'
    if (config.cardBody === 'graph') {
        bodyMode = 'graph'
    } else if (config.cardBody === 'auto') {
        if (result.modeTag === 'RC') {
            // RC maps show Etterna MSD if available, otherwise fall back to pattern
            if (result.etternaResult?.values) {
                bodyMode = 'etterna'
            } else if (result.patternReport?.Clusters && result.patternReport.Clusters.length > 0) {
                bodyMode = 'pattern'
            }
        } else {
            // LN/HB/Mix maps show pattern if available, otherwise fall back to etterna
            if (result.patternReport?.Clusters && result.patternReport.Clusters.length > 0) {
                bodyMode = 'pattern'
            } else if (result.etternaResult?.values) {
                bodyMode = 'etterna'
            }
        }
    } else if (config.cardBody === 'pattern') {
        bodyMode = 'pattern'
    } else if (config.cardBody === 'etterna') {
        bodyMode = 'etterna'
    }

    // Extract graph data from estimator result
    let graphData: GraphData | undefined
    if (bodyMode === 'graph') {
        const graph = result.estimator?.graph as GraphData | null | undefined
        if (graph && graph.times?.length >= 2) {
            graphData = { times: graph.times, values: graph.values }
        }
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
        beatmapId,
        starRating,
        lnPercent: result.lnRatio,
        bpm: result.bpm,
        modeTag: result.modeTag,
        estimatorName,
        difficultyText,
        difficultyTextRc,
        difficultyTextLn,
        patterns,
        etternaMSD,
        graphData,
        isVibro: result.isVibro,
        hasSV: result.isSv,
        bodyMode,
    }
}
