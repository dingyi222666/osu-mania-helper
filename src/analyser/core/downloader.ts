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

// Matches beatmapset URLs without a specific beatmap ID in the fragment
const BEATMAPSET_URL_PATTERN = /osu\.ppy\.sh\/beatmapsets\/(\d+)(?:#\w+)?$/

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

    // URL patterns (beatmap ID takes priority)
    for (const pattern of BEATMAP_URL_PATTERNS) {
        const match = trimmed.match(pattern)
        if (match?.[1]) {
            const id = parseInt(match[1], 10)
            if (Number.isFinite(id) && id > 0) return id
        }
    }

    // Beatmapset URL without beatmap ID (e.g. /beatmapsets/2246343)
    const setMatch = trimmed.match(BEATMAPSET_URL_PATTERN)
    if (setMatch?.[1]) {
        const id = parseInt(setMatch[1], 10)
        if (Number.isFinite(id) && id > 0) return id
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

// ─── Beatmapset Resolution ──────────────────────────────────────────────────

/**
 * Attempts to resolve a beatmapset ID to the first mania beatmap ID in the set.
 * Tries multiple APIs with fallback.
 */
async function resolveBeatmapsetToFirstBeatmap(
    ctx: Context,
    setId: number,
): Promise<number | null> {
    // Try osu.direct API
    try {
        const data = await ctx.http.get<any>(`https://osu.direct/api/v2/s/${setId}`, {
            timeout: 6000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        })
        if (data?.beatmaps && Array.isArray(data.beatmaps)) {
            // Prefer mania beatmaps (mode 3), fall back to first available
            const maniaBeatmap = data.beatmaps.find((b: any) => b.mode_int === 3 || b.mode === 'mania')
            const beatmap = maniaBeatmap || data.beatmaps[0]
            if (beatmap?.id) return beatmap.id
        }
    } catch (e) {
        ctx.logger.debug('osu.direct set resolution failed: %s', e instanceof Error ? e.message : String(e))
    }

    // Try catboy.best API
    try {
        const data = await ctx.http.get<any>(`https://catboy.best/api/v2/s/${setId}`, {
            timeout: 6000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        })
        if (data?.ChildrenBeatmaps && Array.isArray(data.ChildrenBeatmaps)) {
            const maniaBeatmap = data.ChildrenBeatmaps.find((b: any) => b.Mode === 3)
            const beatmap = maniaBeatmap || data.ChildrenBeatmaps[0]
            if (beatmap?.BeatmapID) return beatmap.BeatmapID
        }
    } catch (e) {
        ctx.logger.debug('catboy.best set resolution failed: %s', e instanceof Error ? e.message : String(e))
    }

    return null
}

// ─── Downloader ─────────────────────────────────────────────────────────────

/**
 * Downloads a single .osu file by beatmap ID.
 * Tries multiple mirror sources with fallback. Uses ctx.http for requests.
 * If all sources fail, attempts to treat the ID as a beatmapset ID and resolves
 * the first beatmap in the set.
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
            ctx.logger.debug('Downloading from: %s', source.url)

            const text = await ctx.http.get<string>(source.url, {
                responseType: 'text',
                timeout: 8000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            })

            ctx.logger.debug(
                'Response from %s - type: %s, length: %d',
                source.name,
                typeof text,
                text?.length ?? 0,
            )

            // Safety: ensure we actually got a string back
            if (typeof text !== 'string' || !text) {
                errors.push(`${source.name}: response is not a string (got ${typeof text})`)
                continue
            }

            // Validate that the response is actually an .osu file
            if (text.trimStart().startsWith('osu file format')) {
                ctx.logger.debug('Valid .osu file from %s (%d bytes)', source.name, text.length)
                return text
            }

            errors.push(`${source.name}: response is not a valid .osu file (starts with: "${text.slice(0, 40)}...")`)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            ctx.logger.debug('Download failed from %s: %s', source.name, message)
            errors.push(`${source.name}: ${message}`)
        }
    }

    // All sources failed — try treating the ID as a beatmapset ID
    const numericId = typeof beatmapId === 'string' ? parseInt(beatmapId, 10) : beatmapId
    if (Number.isFinite(numericId) && numericId > 0) {
        ctx.logger.debug('All sources failed for ID %d, trying as beatmapset ID...', numericId)
        const resolvedId = await resolveBeatmapsetToFirstBeatmap(ctx, numericId)
        if (resolvedId && resolvedId !== numericId) {
            ctx.logger.debug('Resolved beatmapset %d to beatmap %d, retrying download...', numericId, resolvedId)
            // Retry download with the resolved beatmap ID (no recursive fallback)
            const resolvedSources = buildSourceList(resolvedId, customMirrors)
            for (const source of resolvedSources) {
                try {
                    const text = await ctx.http.get<string>(source.url, {
                        responseType: 'text',
                        timeout: 8000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        },
                    })
                    if (typeof text === 'string' && text.trimStart().startsWith('osu file format')) {
                        ctx.logger.debug('Valid .osu file from %s (resolved set) (%d bytes)', source.name, text.length)
                        return text
                    }
                } catch {
                    // continue to next source
                }
            }
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
