import { createJimp } from '@jimp/core'
import { defaultFormats, defaultPlugins } from 'jimp'
import { fileURLToPath } from 'url'
import path from 'path'

const Jimp = createJimp({
    formats: [...defaultFormats],
    plugins: defaultPlugins
})

export type GreekSymbol =
    | 'alpha'
    | 'beta'
    | 'gamma'
    | 'delta'
    | 'epsilon'
    | 'zeta'
    | 'eta'
    | 'theta'
    | 'iota'
    | 'kappa'
    | 'thaumiel_zeta'

export type GreekPosition =
    | 'center'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'

export interface GreekPreset {
    size: number
    glitch: number
    rgb: number
    wave: number
    blocks: number
    noise: number
    scanline: number
    vignette: number
    ghost: number
}

export interface RenderGreekOptions {
    symbol: GreekSymbol
    position?: GreekPosition
    size?: number
    glitch?: number
    rgb?: number
    wave?: number
    blocks?: number
    noise?: number
    scanline?: number
    vignette?: number
    ghost?: number
    seed?: number
}

interface Rect {
    x: number
    y: number
    width: number
    height: number
}

const symbolFiles: Record<GreekSymbol, string> = {
    alpha: 'alpha.png',
    beta: 'beta.png',
    gamma: 'gamma.png',
    delta: 'delta.png',
    epsilon: 'epsilon.png',
    zeta: 'zeta.png',
    eta: 'eta.png',
    theta: 'theta.png',
    iota: 'iota.png',
    kappa: 'kappa.png',
    thaumiel_zeta: 'thaumiel_zeta.png'
}

const aliases: Record<string, GreekSymbol> = {
    a: 'alpha',
    alpha: 'alpha',
    'α': 'alpha',
    b: 'beta',
    beta: 'beta',
    'β': 'beta',
    g: 'gamma',
    gamma: 'gamma',
    'γ': 'gamma',
    d: 'delta',
    delta: 'delta',
    'δ': 'delta',
    e: 'epsilon',
    ep: 'epsilon',
    epsilon: 'epsilon',
    'ε': 'epsilon',
    z: 'zeta',
    zeta: 'zeta',
    'ζ': 'zeta',
    eta: 'eta',
    'η': 'eta',
    t: 'theta',
    theta: 'theta',
    'θ': 'theta',
    i: 'iota',
    iota: 'iota',
    'ι': 'iota',
    k: 'kappa',
    kappa: 'kappa',
    'κ': 'kappa',
    thaumiel: 'thaumiel_zeta',
    thaumiel_zeta: 'thaumiel_zeta',
    'thaumiel-zeta': 'thaumiel_zeta'
}

const positions: Record<string, GreekPosition> = {
    c: 'center',
    center: 'center',
    middle: 'center',
    top: 'top',
    bottom: 'bottom',
    left: 'left',
    right: 'right',
    tl: 'top-left',
    'top-left': 'top-left',
    lt: 'top-left',
    tr: 'top-right',
    'top-right': 'top-right',
    rt: 'top-right',
    bl: 'bottom-left',
    'bottom-left': 'bottom-left',
    lb: 'bottom-left',
    br: 'bottom-right',
    'bottom-right': 'bottom-right',
    rb: 'bottom-right'
}

const presets: Record<GreekSymbol, GreekPreset> = {
    alpha: createPreset(40, 0, 0, 0),
    beta: createPreset(42, 1, 1, 0),
    gamma: createPreset(46, 2, 6, 1, 1, 0, 1, 0, 0),
    delta: createPreset(48, 5, 10, 1, 1, 0, 1, 0, 0),
    epsilon: createPreset(52, 10, 14, 3, 0, 0, 0, 0, 0),
    zeta: createPreset(54, 18, 21, 7, 0, 0, 0, 0, 0),
    thaumiel_zeta: createPreset(54, 18, 21, 7, 0, 0, 0, 0, 0),
    eta: createPreset(58, 32, 28, 10, 16, 8, 14, 10, 3),
    theta: createPreset(62, 32, 34, 14, 22, 10, 18, 12, 4),
    iota: createPreset(62, 36, 38, 16, 26, 12, 20, 14, 5),
    kappa: createPreset(60, 40, 42, 18, 30, 14, 22, 16, 6)
}

export function parseGreekSymbol(input?: string): GreekSymbol | null {
    if (!input) return null
    const key = input.trim().toLocaleLowerCase().replace(/\s+/g, '-')
    return aliases[key] ?? null
}

export function parseGreekPosition(input?: string): GreekPosition | null {
    if (!input) return 'center'
    const key = input.trim().toLocaleLowerCase().replace(/_/g, '-')
    return positions[key] ?? null
}

export function getGreekPreset(symbol: GreekSymbol): GreekPreset {
    return presets[symbol]
}

export async function renderGreekImage(
    imageBuffer: Buffer,
    options: RenderGreekOptions
): Promise<Buffer> {
    const base = await Jimp.read(imageBuffer)
    const symbol = await Jimp.read(getSymbolPath(options.symbol))
    const preset = getGreekPreset(options.symbol)
    const width = base.bitmap.width
    const height = base.bitmap.height
    const size = clampNumber(options.size ?? preset.size, 5, 95)
    const targetHeight = Math.max(1, Math.round((height * size) / 100))
    const targetWidth = Math.max(
        1,
        Math.round((targetHeight * symbol.bitmap.width) / symbol.bitmap.height)
    )
    const maxWidth = Math.round(width * 0.95)
    const maxHeight = Math.round(height * 0.95)
    const scale = Math.min(1, maxWidth / targetWidth, maxHeight / targetHeight)
    const finalWidth = Math.max(1, Math.round(targetWidth * scale))
    const finalHeight = Math.max(1, Math.round(targetHeight * scale))
    const position = options.position ?? 'center'
    const resizedSymbol = symbol.resize({ w: finalWidth, h: finalHeight })
    const { x, y } = resolvePosition(width, height, finalWidth, finalHeight, position)
    const symbolRect: Rect = {
        x,
        y,
        width: finalWidth,
        height: finalHeight
    }
    const effects = {
        glitch: options.glitch ?? preset.glitch,
        rgb: options.rgb ?? preset.rgb,
        wave: options.wave ?? preset.wave,
        blocks: options.blocks ?? preset.blocks,
        noise: options.noise ?? preset.noise,
        scanline: options.scanline ?? preset.scanline,
        vignette: options.vignette ?? preset.vignette,
        ghost: options.ghost ?? preset.ghost,
        seed: options.seed ?? Date.now(),
        symbolRect
    }

    blendSymbol(base.bitmap.data, width, height, resizedSymbol.bitmap.data, {
        x,
        y,
        width: finalWidth,
        height: finalHeight
    })

    applyEffects(base.bitmap.data, width, height, effects)

    return await base.getBuffer('image/png')
}

function getResourceDir() {
    const runtimeDir =
        typeof __dirname === 'string'
            ? __dirname
            : path.dirname(fileURLToPath(import.meta.url))
    return path.resolve(runtimeDir, '../resources')
}

function getSymbolPath(symbol: GreekSymbol) {
    return path.join(getResourceDir(), symbolFiles[symbol])
}

function resolvePosition(
    canvasWidth: number,
    canvasHeight: number,
    symbolWidth: number,
    symbolHeight: number,
    position: GreekPosition
) {
    const padding = Math.round(Math.min(canvasWidth, canvasHeight) * 0.06)
    const centerX = Math.round((canvasWidth - symbolWidth) / 2)
    const centerY = Math.round((canvasHeight - symbolHeight) / 2)
    const left = padding
    const right = canvasWidth - symbolWidth - padding
    const top = padding
    const bottom = canvasHeight - symbolHeight - padding

    switch (position) {
        case 'top':
            return { x: centerX, y: top }
        case 'bottom':
            return { x: centerX, y: bottom }
        case 'left':
            return { x: left, y: centerY }
        case 'right':
            return { x: right, y: centerY }
        case 'top-left':
            return { x: left, y: top }
        case 'top-right':
            return { x: right, y: top }
        case 'bottom-left':
            return { x: left, y: bottom }
        case 'bottom-right':
            return { x: right, y: bottom }
        default:
            return { x: centerX, y: centerY }
    }
}

function blendSymbol(
    base: Buffer,
    baseWidth: number,
    baseHeight: number,
    symbol: Buffer,
    rect: { x: number; y: number; width: number; height: number }
) {
    for (let sy = 0; sy < rect.height; sy++) {
        const by = rect.y + sy
        if (by < 0 || by >= baseHeight) continue

        for (let sx = 0; sx < rect.width; sx++) {
            const bx = rect.x + sx
            if (bx < 0 || bx >= baseWidth) continue

            const srcIndex = (sy * rect.width + sx) * 4
            const srcAlpha = symbol[srcIndex + 3] / 255
            if (srcAlpha <= 0) continue

            const dstIndex = (by * baseWidth + bx) * 4
            const dstAlpha = base[dstIndex + 3] / 255
            const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha)

            for (let channel = 0; channel < 3; channel++) {
                const src = symbol[srcIndex + channel]
                const dst = base[dstIndex + channel]
                base[dstIndex + channel] = Math.round(
                    (src * srcAlpha + dst * dstAlpha * (1 - srcAlpha)) /
                        outAlpha
                )
            }

            base[dstIndex + 3] = Math.round(outAlpha * 255)
        }
    }
}

function applyEffects(
    data: Buffer,
    width: number,
    height: number,
    options: {
        glitch: number
        rgb: number
        wave: number
        blocks: number
        noise: number
        scanline: number
        vignette: number
        ghost: number
        seed: number
        symbolRect?: Rect
    }
) {
    if (options.ghost > 0) {
        applyGhost(data, width, height, options.ghost)
    }
    if (options.glitch > 0) {
        applyGlitch(
            data,
            width,
            height,
            options.glitch,
            options.seed,
            options.symbolRect
        )
    }
    if (options.blocks > 0) {
        applyBlockGlitch(data, width, height, options.blocks, options.seed + 17)
    }
    if (options.rgb > 0) {
        applyRgbShift(data, width, height, options.rgb)
    }
    if (options.wave > 0) {
        applyWave(data, width, height, options.wave)
    }
    if (options.noise > 0) {
        applyNoise(data, width, height, options.noise, options.seed + 31)
    }
    if (options.scanline > 0) {
        applyScanline(data, width, height, options.scanline)
    }
    if (options.vignette > 0) {
        applyVignette(data, width, height, options.vignette)
    }
}

function createPreset(
    size: number,
    glitch: number,
    rgb: number,
    wave: number,
    blocks = 0,
    noise = 0,
    scanline = 0,
    vignette = 0,
    ghost = 0
): GreekPreset {
    return {
        size,
        glitch,
        rgb,
        wave,
        blocks,
        noise,
        scanline,
        vignette,
        ghost
    }
}

function applyGlitch(
    data: Buffer,
    width: number,
    height: number,
    intensity: number,
    seed: number,
    symbolRect?: Rect
) {
    let rnd = Math.abs(Math.floor(seed)) % 233280 || 1
    const random = () => {
        rnd = (rnd * 9301 + 49297) % 233280
        return rnd / 233280
    }
    const scale = Math.max(0.55, Math.min(width / 1920, height / 1080))
    const slices = Math.max(2, Math.floor(intensity / 14) + 3)
    const maxOffset = Math.min(
        Math.round(width * 0.16),
        Math.round(intensity * 2.2 * scale)
    )
    const maxSliceHeight = Math.max(6, Math.round(80 * scale))
    const minOffset = intensity >= 8 ? Math.max(1, Math.round(2 * scale)) : 0

    const moveSlice = (
        y: number,
        sliceHeight: number,
        offsetX: number,
        segmentX = 0,
        segmentWidth = width
    ) => {
        const actualY = clampNumber(y, 0, height - 1)
        const actualHeight = Math.min(sliceHeight, height - actualY)
        const actualX = clampNumber(segmentX, 0, width - 1)
        const actualWidth = Math.min(segmentWidth, width - actualX)
        if (actualHeight <= 0 || actualWidth <= 0 || offsetX === 0) return

        const slice = Buffer.alloc(actualWidth * actualHeight * 4)
        for (let row = 0; row < actualHeight; row++) {
            const srcStart = ((actualY + row) * width + actualX) * 4
            data.copy(
                slice,
                row * actualWidth * 4,
                srcStart,
                srcStart + actualWidth * 4
            )
            dimRow(data, srcStart, actualWidth)
        }

        for (let row = 0; row < actualHeight; row++) {
            for (let x = 0; x < actualWidth; x++) {
                const targetX = actualX + x + offsetX
                if (targetX < 0 || targetX >= width) continue
                const srcIndex = (row * actualWidth + x) * 4
                const dstIndex = ((actualY + row) * width + targetX) * 4
                slice.copy(data, dstIndex, srcIndex, srcIndex + 4)
            }
        }
    }

    const randomOffset = () => {
        if (maxOffset <= 0) return 0
        const sign = random() > 0.5 ? 1 : -1
        const value = Math.round(random() * maxOffset)
        return sign * Math.max(minOffset, value)
    }

    const randomSegment = () => {
        if (random() < 0.24) return { x: 0, width }

        const minWidth = Math.max(24, Math.round(width * 0.14))
        const maxWidth = Math.max(minWidth, Math.round(width * 0.46))
        const segmentWidth = Math.min(
            width,
            minWidth + Math.round(random() * (maxWidth - minWidth))
        )

        if (random() < 0.5) {
            return { x: Math.round(random() * width * 0.2), width: segmentWidth }
        }

        return {
            x: Math.round(width - segmentWidth - random() * width * 0.2),
            width: segmentWidth
        }
    }

    for (let i = 0; i < slices; i++) {
        const y = Math.floor(random() * height)
        const sliceHeight = Math.max(
            2,
            Math.floor(random() * Math.min(maxSliceHeight, height / 6))
        )
        const segment = randomSegment()
        moveSlice(y, sliceHeight, randomOffset(), segment.x, segment.width)
    }

    if (intensity >= 18) {
        const y = Math.floor(random() * height)
        const sliceHeight = Math.max(2, Math.round(maxSliceHeight * 0.32))
        moveSlice(y, sliceHeight, randomOffset())
    }

    if (symbolRect && intensity >= 6) {
        const focusCount = intensity >= 18 ? 3 : 2
        for (let i = 0; i < focusCount; i++) {
            const ratio = focusCount === 2 ? i : i / (focusCount - 1)
            const jitter = Math.round((random() - 0.5) * symbolRect.height * 0.16)
            const y = Math.round(
                symbolRect.y + symbolRect.height * (0.18 + ratio * 0.64) + jitter
            )
            const sliceHeight = Math.max(
                2,
                Math.round(Math.min(maxSliceHeight, symbolRect.height * 0.09))
            )
            const segment = randomSegment()
            moveSlice(y, sliceHeight, randomOffset(), segment.x, segment.width)
        }
    }
}

function dimRow(data: Buffer, rowStart: number, width: number) {
    for (let x = 0; x < width; x++) {
        const index = rowStart + x * 4
        data[index] = Math.round(data[index] * 0.45)
        data[index + 1] = Math.round(data[index + 1] * 0.45)
        data[index + 2] = Math.round(data[index + 2] * 0.45)
    }
}

function applyRgbShift(
    data: Buffer,
    width: number,
    height: number,
    intensity: number
) {
    const source = Buffer.from(data)
    const shift = Math.min(Math.round(width * 0.12), Math.round(intensity))

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4
            const redX = clampNumber(x - shift, 0, width - 1)
            const blueX = clampNumber(x + shift, 0, width - 1)
            const redIndex = (y * width + redX) * 4
            const blueIndex = (y * width + blueX) * 4

            data[index] = source[redIndex]
            data[index + 1] = source[index + 1]
            data[index + 2] = source[blueIndex + 2]
            data[index + 3] = source[index + 3]
        }
    }
}

function applyBlockGlitch(
    data: Buffer,
    width: number,
    height: number,
    intensity: number,
    seed: number
) {
    const source = Buffer.from(data)
    const scale = Math.min(width / 1920, height / 1080)
    let rnd = Math.abs(Math.floor(seed)) || 1
    const random = () => {
        rnd = (rnd * 9301 + 49297) % 233280
        return rnd / 233280
    }
    const count = Math.floor(intensity / 8) + 2
    const maxBlockWidth = Math.max(8, Math.round(width * 0.24))
    const maxBlockHeight = Math.max(8, Math.round(height * 0.18))
    const maxOffset = Math.max(1, Math.round(intensity * 2.4 * scale))

    for (let i = 0; i < count; i++) {
        const blockWidth = Math.max(6, Math.round(random() * maxBlockWidth))
        const blockHeight = Math.max(4, Math.round(random() * maxBlockHeight))
        const srcX = Math.floor(random() * Math.max(1, width - blockWidth))
        const srcY = Math.floor(random() * Math.max(1, height - blockHeight))
        const dstX = clampNumber(
            srcX + Math.round((random() * 2 - 1) * maxOffset),
            0,
            Math.max(0, width - blockWidth)
        )
        const dstY = clampNumber(
            srcY + Math.round((random() * 2 - 1) * maxOffset * 0.35),
            0,
            Math.max(0, height - blockHeight)
        )
        const opacity = 0.35 + random() * 0.4

        for (let y = 0; y < blockHeight; y++) {
            for (let x = 0; x < blockWidth; x++) {
                const srcIndex = ((srcY + y) * width + srcX + x) * 4
                const dstIndex = ((dstY + y) * width + dstX + x) * 4
                for (let channel = 0; channel < 3; channel++) {
                    data[dstIndex + channel] = Math.round(
                        data[dstIndex + channel] * (1 - opacity) +
                            source[srcIndex + channel] * opacity
                    )
                }
            }
        }
    }
}

function applyGhost(
    data: Buffer,
    width: number,
    height: number,
    intensity: number
) {
    const source = Buffer.from(data)
    const shift = Math.max(1, Math.round((intensity / 100) * width * 0.035))
    const alpha = Math.min(0.38, intensity / 260)

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dstIndex = (y * width + x) * 4
            const redX = clampNumber(x - shift, 0, width - 1)
            const blueX = clampNumber(x + shift, 0, width - 1)
            const redIndex = (y * width + redX) * 4
            const blueIndex = (y * width + blueX) * 4

            data[dstIndex] = Math.round(
                data[dstIndex] * (1 - alpha) + source[redIndex] * alpha
            )
            data[dstIndex + 2] = Math.round(
                data[dstIndex + 2] * (1 - alpha) +
                    source[blueIndex + 2] * alpha
            )
        }
    }
}

function applyNoise(
    data: Buffer,
    width: number,
    height: number,
    intensity: number,
    seed: number
) {
    let rnd = Math.abs(Math.floor(seed)) || 1
    const random = () => {
        rnd = (rnd * 9301 + 49297) % 233280
        return rnd / 233280
    }
    const chance = Math.min(0.35, intensity / 260)
    const power = intensity * 1.3

    for (let i = 0; i < width * height; i++) {
        if (random() > chance) continue
        const index = i * 4
        const delta = Math.round((random() * 2 - 1) * power)
        data[index] = clampNumber(data[index] + delta + intensity * 0.18, 0, 255)
        data[index + 1] = clampNumber(data[index + 1] + delta * 0.45, 0, 255)
        data[index + 2] = clampNumber(data[index + 2] - delta * 0.35, 0, 255)
    }
}

function applyScanline(
    data: Buffer,
    width: number,
    height: number,
    intensity: number
) {
    const step = intensity >= 60 ? 2 : 3
    const darken = 1 - Math.min(0.38, intensity / 260)
    const redBoost = Math.min(26, intensity * 0.3)

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4
            data[index] = clampNumber(data[index] * darken + redBoost, 0, 255)
            data[index + 1] = clampNumber(data[index + 1] * darken, 0, 255)
            data[index + 2] = clampNumber(data[index + 2] * darken, 0, 255)
        }
    }
}

function applyVignette(
    data: Buffer,
    width: number,
    height: number,
    intensity: number
) {
    const cx = width / 2
    const cy = height / 2
    const maxDistance = Math.sqrt(cx * cx + cy * cy)
    const amount = clampNumber(intensity, 0, 100) / 100

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx = x - cx
            const dy = y - cy
            const distance = Math.sqrt(dx * dx + dy * dy) / maxDistance
            const edge = Math.max(0, (distance - 0.35) / 0.65)
            const darken = 1 - edge * amount * 0.72
            const index = (y * width + x) * 4

            data[index] = clampNumber(data[index] * darken + edge * amount * 28, 0, 255)
            data[index + 1] = clampNumber(data[index + 1] * darken, 0, 255)
            data[index + 2] = clampNumber(data[index + 2] * darken, 0, 255)
        }
    }
}

function applyWave(
    data: Buffer,
    width: number,
    height: number,
    intensity: number
) {
    const source = Buffer.from(data)
    const amp = Math.max(1, (intensity / 3) * (width / 1920))
    const freq = 0.02 * (1080 / height) + intensity / 1200

    for (let y = 0; y < height; y++) {
        const dx = Math.floor(Math.sin(y * freq) * amp)
        for (let x = 0; x < width; x++) {
            const sourceX = clampNumber(x + dx, 0, width - 1)
            const sourceIndex = (y * width + sourceX) * 4
            const targetIndex = (y * width + x) * 4
            source.copy(data, targetIndex, sourceIndex, sourceIndex + 4)
        }
    }
}

function clampNumber(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value))
}

function wrapNumber(value: number, max: number) {
    return ((value % max) + max) % max
}
