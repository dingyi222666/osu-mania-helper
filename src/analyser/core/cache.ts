import * as fs from 'fs'
import * as path from 'path'

export class BeatmapCache {
    private cacheDir: string
    private maxAgeMs: number

    constructor(cacheDir: string, maxAgeHours: number) {
        this.cacheDir = cacheDir
        this.maxAgeMs = maxAgeHours * 60 * 60 * 1000
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true })
        }
    }

    private getFilePath(beatmapId: string): string {
        return path.join(this.cacheDir, `${beatmapId}.osu`)
    }

    /** Get cached .osu file content by beatmap ID. Returns null if missing or expired. */
    get(beatmapId: string): string | null {
        const filePath = this.getFilePath(beatmapId)
        if (!fs.existsSync(filePath)) return null

        const stat = fs.statSync(filePath)
        if (Date.now() - stat.mtimeMs > this.maxAgeMs) {
            try { fs.unlinkSync(filePath) } catch {}
            return null
        }

        try {
            return fs.readFileSync(filePath, 'utf-8')
        } catch {
            try { fs.unlinkSync(filePath) } catch {}
            return null
        }
    }

    /** Save .osu file content to cache. */
    set(beatmapId: string, content: string): void {
        try {
            fs.writeFileSync(this.getFilePath(beatmapId), content, 'utf-8')
        } catch {}
    }

    /** Delete a specific cached file (for refresh). */
    invalidate(beatmapId: string): void {
        const filePath = this.getFilePath(beatmapId)
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        } catch {}
    }

    /** Remove all expired cache files. */
    cleanup(): void {
        if (!fs.existsSync(this.cacheDir)) return
        const now = Date.now()
        try {
            const files = fs.readdirSync(this.cacheDir)
            for (const file of files) {
                if (!file.endsWith('.osu')) continue
                const filePath = path.join(this.cacheDir, file)
                try {
                    const stat = fs.statSync(filePath)
                    if (now - stat.mtimeMs > this.maxAgeMs) {
                        fs.unlinkSync(filePath)
                    }
                } catch {}
            }
        } catch {}
    }

    /** Remove all cached files. */
    clear(): void {
        if (!fs.existsSync(this.cacheDir)) return
        try {
            const files = fs.readdirSync(this.cacheDir)
            for (const file of files) {
                if (!file.endsWith('.osu')) continue
                try { fs.unlinkSync(path.join(this.cacheDir, file)) } catch {}
            }
        } catch {}
    }
}
