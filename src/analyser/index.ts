import * as path from 'path'
import { Context, Logger } from 'koishi'
import { AnalyserConfig } from './config'
import { apply as commands } from './commands'
import { BeatmapCache } from './core/cache'

export const name = 'osu-mania-analyser'
export { AnalyserConfig as Config } from './config'
export let logger: Logger
export const inject = {
    optional: ['puppeteer']
}

export function apply(ctx: Context, config: AnalyserConfig) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ctx.i18n.define('zh-CN', require('./locales/zh-CN'))
    logger = ctx.logger('osu-mania-analyser')

    const cacheDir = config.cacheDir
        ? path.resolve(config.cacheDir)
        : path.join(ctx.baseDir, 'data', 'osu-mania-analyser', 'cache')
    const cache = new BeatmapCache(cacheDir, config.cacheMaxAge)

    // Periodic cache cleanup every hour
    const cleanupInterval = setInterval(() => cache.cleanup(), 60 * 60 * 1000)
    ctx.on('dispose', () => {
        clearInterval(cleanupInterval)
    })

    ctx.plugin((childCtx) => commands(childCtx, config, cache))
}
