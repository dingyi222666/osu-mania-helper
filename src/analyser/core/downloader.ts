import { Context } from 'koishi'

// ─── Beatmap ID Parsing ─────────────────────────────────────────────────────

const BEATMAP_URL_PATTERNS = [
    // https://osu.ppy.sh/beatmaps/12345
    /osu\.ppy\.sh\/beatmaps\/(\d+)/,
    // https://osu.ppy.sh/beatmapsets/999#mania/12345
    /osu\.ppy\.sh\/beatmapsets\/\d+#\w+\/(\d+)/,
    // https://osu.ppy.sh/b/12345
    /osu\.ppy\.sh\/b\/(\d+)/,
]

/**
 * Extracts a beatmap ID from various URL formats or a plain number string.
 * Returns null if the input cannot be parsed.
 */
export function parseBeatmapId(input: string): number | null {
    if (!input) return null
    const trimmed = input.trim()

    // Plain number
    if (/^\d+$/.test(trimmed)) {
        const id = parseInt(trimmed, 10)
        return Number.isFinite(id) && id > 0 ? id : null
    }

    // URL patterns
    for (const pattern of BEATMAP_URL_PATTERNS) {
        const match = trimmed.match(pattern)
        if (match?.[1]) {
            const id = parseInt(match[1], 10)
            if (Number.isFinite(id) && id > 0) return id
        }
    }

    return null
}

// ─── Mirror Sources ─────────────────────────────────────────────────────────

export interface MirrorSource {
    name: string
    url: (id: number | string) => string
}

export const DEFAULT_MIRRORS: MirrorSource[] = [
    {
        name: 'osu! official',
        url: (id) => `https://osu.ppy.sh/osu/${id}`,
    },
    {
        name: 'osu.direct',
        url: (id) => `https://osu.direct/api/osu/${id}`,
    },
    {
        name: 'chimu.moe',
        url: (id) => `https://api.chimu.moe/v1/download/${id}?n=1`,
    },
    {
        name: 'catboy.best',
        url: (id) => `https://catboy.best/osu/${id}`,
    },
]

// ─── Downloader ─────────────────────────────────────────────────────────────

/**
 * Downloads a single .osu file by beatmap ID.
 * Tries multiple mirror sources with fallback. Uses ctx.http for requests.
 *
 * @param ctx - Koishi context (provides ctx.http)
 * @param beatmapId - The beatmap ID to download
 * @param customMirrors - Optional custom mirror URL templates (use `{id}` as placeholder)
 * @returns The raw .osu file content as a string
 * @throws Error if all sources fail
 */
export async function downloadBeatmap(
    ctx: Context,
    beatmapId: number | string,
    customMirrors?: string[],
): Promise<string> {
    const sources = buildSourceList(beatmapId, customMirrors)
    const errors: string[] = []

    for (const source of sources) {
        try {
            const text = await ctx.http.get(source.url, {
                responseType: 'text',
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            })

            // Validate that the response is actually an .osu file
            if (text.trimStart().startsWith('osu file format')) {
                return text
            }

            errors.push(`${source.name}: response is not a valid .osu file`)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            errors.push(`${source.name}: ${message}`)
        }
    }

    throw new Error(
        `Failed to download beatmap ${beatmapId} from all sources:\n${errors.join('\n')}`,
    )
}

function buildSourceList(
    beatmapId: number | string,
    customMirrors?: string[],
): { name: string; url: string }[] {
    if (customMirrors && customMirrors.length > 0) {
        return customMirrors.map((template, i) => ({
            name: `mirror-${i + 1}`,
            url: template.replace('{id}', String(beatmapId)),
        }))
    }

    return DEFAULT_MIRRORS.map((m) => ({
        name: m.name,
        url: m.url(beatmapId),
    }))
}
