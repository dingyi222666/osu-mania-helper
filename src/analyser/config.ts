import { Schema } from 'koishi'

export interface AnalyserConfig {
    algorithm: 'mixed' | 'azusa' | 'sunny' | 'daniel'
    etternaVersion: '0.68.0' | '0.70.0' | '0.72.0' | '0.72.3' | '0.74.0'
    enableVibro: boolean
    enableSV: boolean
    cardBody: 'auto' | 'pattern' | 'etterna' | 'graph'
    mirrors: string[]
    cacheMaxAge: number
    cacheDir: string
    maxFileSizeMb: number
}

export const AnalyserConfig: Schema<AnalyserConfig> = Schema.object({
    algorithm: Schema.union(['mixed', 'azusa', 'sunny', 'daniel']).default('mixed').description('难度估算算法'),
    etternaVersion: Schema.union(['0.68.0', '0.70.0', '0.72.0', '0.72.3', '0.74.0']).default('0.72.3').description('Etterna MinaCalc 版本'),
    enableVibro: Schema.boolean().default(true).description('启用振动谱面检测'),
    enableSV: Schema.boolean().default(true).description('启用 SV 检测'),
    cardBody: Schema.union(['auto', 'pattern', 'etterna', 'graph']).default('auto').description('卡片主体内容'),
    mirrors: Schema.array(Schema.string()).default([]).description('自定义 .osu 文件下载镜像 URL（使用 {id} 作为谱面 ID 占位符，留空使用默认源）'),
    cacheMaxAge: Schema.number().default(24).description('.osu 谱面文件缓存最大存活时间（小时）'),
    cacheDir: Schema.string().default('').description('缓存目录路径（留空使用默认路径 data/osu-mania-analyser/cache）'),
    maxFileSizeMb: Schema.number().default(50).description('允许的最大 .osu 文件大小（MB）'),
})
