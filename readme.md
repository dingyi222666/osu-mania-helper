# koishi-plugin-osu-mania-helper

[![npm](https://img.shields.io/npm/v/koishi-plugin-osu-mania-helper?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-osu-mania-helper)

一个提供 osu!mania 工具集的 Koishi 插件，包括谱面难度分析和希腊字母图片生成。

## 命令

### `greek <symbol>`

根据 osu!mania 段位生成带希腊字母的图片。

示例：

- `greek gamma`
- `greek γ -p top-right`
- `greek zeta -p center -s 42`
- `greek eta -b 70 -n 50 --scanline 60`

执行命令后发送图片，插件会在输入图片原始尺寸上叠加对应希腊字母。

### `mania-analyse [input]`（别名 `ma`）

分析 osu!mania 谱面难度。

用法：

```
ma <beatmap_id_or_url> [+mods]
```

示例：

- `ma 12345` — 通过谱面 ID 分析
- `ma https://osu.ppy.sh/beatmaps/12345 +dt` — 通过 URL 分析并应用 DT mod
- `ma 12345 +dthr` — 组合多个 mods
- `ma 12345 +nc` — 应用 NC mod

也可以直接发送 `.osu` 文件附件进行分析（无需提供 ID 或 URL）。

支持的 Mods：DT, NC, HT, DC, HR, EZ, FL, HD, FI, NF, SD, PF, MR

## 配置

| 配置项                    | 类型                                                       | 默认值     | 说明                                                                           |
| ------------------------- | ---------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| `analyser.algorithm`      | `'mixed' \| 'azusa' \| 'sunny' \| 'daniel'`                | `'mixed'`  | 难度估算算法                                                                   |
| `analyser.etternaVersion` | `'0.68.0' \| '0.70.0' \| '0.72.0' \| '0.72.3' \| '0.74.0'` | `'0.72.3'` | Etterna MinaCalc 版本                                                          |
| `analyser.enableVibro`    | `boolean`                                                  | `true`     | 启用振动谱面检测                                                               |
| `analyser.enableSV`       | `boolean`                                                  | `true`     | 启用 SV 检测                                                                   |
| `analyser.cardBody`       | `'auto' \| 'pattern' \| 'etterna' \| 'graph'`              | `'auto'`   | 卡片主体内容                                                                   |
| `analyser.mirrors`        | `string[]`                                                 | `[]`       | 自定义 .osu 文件下载镜像 URL（使用 `{id}` 作为谱面 ID 占位符，留空使用默认源） |

## 与原项目的差异

详细差异说明见 [DIFFERENCES.md](./DIFFERENCES.md)

## 致谢

- 谱面分析器移植自 [LeoBlackMT/osumania_map_analyser](https://github.com/LeoBlackMT/osumania_map_analyser)（v1.5.0）
- 希腊字母资源来自 [Brofriendosu/Dan-Maker](https://github.com/Brofriendosu/Dan-Maker/tree/main/assets/greek)
- Etterna MinaCalc 来自 [Etterna](https://github.com/etternagame/etterna) 项目
- Interlude SR 来自 [YAVSRG](https://github.com/YAVSRG/YAVSRG) 项目

## License

MIT
