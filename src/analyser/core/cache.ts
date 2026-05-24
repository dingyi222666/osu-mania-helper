import type { AnalysisResult } from './analysis'

export interface CacheEntry {
    result: AnalysisResult
    timestamp: number
    beatmapId: string
}

export class AnalysisCache {
    private cache = new Map<string, CacheEntry>()
    private maxAgeMs: number

    constructor(maxAgeHours: number) {
        this.maxAgeMs = maxAgeHours * 60 * 60 * 1000
    }

    get(beatmapId: string, mods: string): CacheEntry | null {
        const key = `${beatmapId}:${mods}`
        const entry = this.cache.get(key)
        if (!entry) return null
        if (Date.now() - entry.timestamp > this.maxAgeMs) {
            this.cache.delete(key)
            return null
        }
        return entry
    }

    set(beatmapId: string, mods: string, result: AnalysisResult): void {
        const key = `${beatmapId}:${mods}`
        this.cache.set(key, { result, timestamp: Date.now(), beatmapId })
    }

    clear(): void {
        this.cache.clear()
    }

    /** Periodic cleanup of expired entries */
    cleanup(): void {
        const now = Date.now()
        for (const [key, entry] of this.cache) {
            if (now - entry.timestamp > this.maxAgeMs) {
                this.cache.delete(key)
            }
        }
    }
}
