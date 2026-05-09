import { Context, Schema } from 'koishi'
import { apply as commands } from './commands'

export const name = 'osu-mania-greek-alphabet'

export const Config: Schema<object> = Schema.object({})

export function apply(ctx: Context) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ctx.i18n.define('zh-CN', require('./locales/zh-CN'))

    ctx.plugin(commands)
}
