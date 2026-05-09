# koishi-plugin-osu-mania-greek-alphabet

[![npm](https://img.shields.io/npm/v/koishi-plugin-osu-mania-greek-alphabet?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-osu-mania-greek-alphabet)

根据 osu!mania 段位生成带希腊字母图片的 Koishi 插件。

## 命令

- `greek <symbol>`

示例：

- `greek gamma`
- `greek γ -p top-right`
- `greek zeta -p center -s 42`
- `greek eta -b 70 -n 50 --scanline 60`

执行命令后发送图片，插件会在输入图片原始尺寸上叠加对应希腊字母。

## 支持的功能

- [x] 给定图片，根据 osu!mania 段位的原始希腊字母图片，生成带希腊字母的图片

## 致谢

感谢 [Brofriendosu/Dan-Maker](https://github.com/Brofriendosu/Dan-Maker/tree/main/assets/greek) 提供的希腊字母相关资源。
