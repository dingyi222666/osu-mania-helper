import { Context, Schema } from 'koishi'
import { apply as commands } from './commands'

export const name = 'osu-mania-greek-alphabet'

export const Config: Schema<object> = Schema.object({})

export const usage = `
## 注意事项

当前版本只保留命令入口，具体生成逻辑暂未实现。

## 支持的功能

- [ ] 给定图片，根据 osu!mania 段位生成带希腊字母的图片

`

export function apply(ctx: Context) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ctx.i18n.define('zh-CN', require('./locales/zh-CN'))

    ctx.plugin(commands)
}
