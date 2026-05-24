import { Context, Schema } from 'koishi'
import { apply as greek } from './greek'
import { apply as analyser, Config as AnalyserConfig } from './analyser'
import type { AnalyserConfig as AnalyserConfigType } from './analyser/config'

export const name = 'osu-mania-helper'

export const inject = {
    optional: ['puppeteer'],
}

export interface Config {
    analyser: AnalyserConfigType
}

export const Config: Schema<Config> = Schema.object({
    analyser: AnalyserConfig.description('谱面分析器配置'),
})

export function apply(ctx: Context, config: Config) {
    ctx.plugin(greek)
    ctx.plugin(analyser, config.analyser)
}
