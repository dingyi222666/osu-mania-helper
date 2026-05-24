import { Context, h, Session } from 'koishi'

const RECALL_DELAY = 20000

/**
 * Send a message that will be automatically recalled after `delay` ms.
 * Uses ctx.setTimeout so the timer is bound to the plugin lifecycle.
 */
export async function sendTemporary(ctx: Context, session: Session, content: string | h, delay = RECALL_DELAY) {
    const ids = await session.send(content)
    const messageId = ids?.[0]
    if (messageId) {
        ctx.setTimeout(() => {
            session.bot.deleteMessage(session.channelId, messageId).catch(() => {})
        }, delay)
    }
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
    'MR',
    'IN',
    'HO'
] as const
export type ModCode = (typeof KNOWN_MODS)[number]

export interface ParsedMods {
    codes: ModCode[]
    rate: number
    displayString: string
}

/**
 * Parses a mod string like "DTHR" or "dt hr" into individual mod codes.
 * Case-insensitive, ignores spaces/commas.
 * Accepts an optional customRate to override the default DT/HT rate.
 */
export function parseMods(input: string, customRate?: number | null): ParsedMods {
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

    // IN/HO are conversion mods - they don't affect rate
    const isCvtMod = codes.includes('IN') || codes.includes('HO')

    // Clamp custom rate to reasonable bounds (ignored for conversion-only mods)
    const clampedRate = (customRate != null && !isCvtMod)
        ? Math.max(0.1, Math.min(3.0, customRate))
        : null

    // Determine rate multiplier
    let rate = 1.0
    if (codes.includes('DT') || codes.includes('NC')) {
        rate = clampedRate ?? 1.5
    } else if (codes.includes('HT') || codes.includes('DC')) {
        rate = clampedRate ?? 0.75
    } else if (clampedRate) {
        rate = clampedRate
    }

    // Build display string - show custom rate if provided
    let displayString = codes.length > 0 ? codes.join('') : 'NM'
    const isSpeedMod = codes.includes('DT') || codes.includes('NC') || codes.includes('HT') || codes.includes('DC')
    if (clampedRate != null && isSpeedMod) {
        const defaultRate = (codes.includes('DT') || codes.includes('NC')) ? 1.5 : 0.75
        if (clampedRate !== defaultRate) {
            displayString += `(${clampedRate}x)`
        }
    }

    return { codes, rate, displayString }
}

// ─── File Reading ───────────────────────────────────────────────────────────

/**
 * Attempts to read a .osu file from message attachments (file, audio, or quoted file elements).
 * Also checks for inline text content that looks like an osu file.
 */
export async function readOsuFile(
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
            const text = await ctx.http.get(url, {
                responseType: 'text',
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            })
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
