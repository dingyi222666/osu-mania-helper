# 与原始项目 (osumania_map_analyser) 的差异说明

本插件基于 [osumania_map_analyser](https://github.com/LeoBlackMT/osumania_map_analyser) v1.5.0 移植，为适配 Koishi 插件生态做了大量改动。以下是完整的差异列表。

---

## 移除的功能 (Removed)

| 功能 | 说明 |
| --- | --- |
| WebSocket / tosu 实时连接 | 原项目通过 WebSocket 连接 tosu 获取实时游戏数据，插件场景无需此功能 |
| 实时 HUD 覆盖层 | 原项目在浏览器中渲染实时 HUD overlay，插件以按需查询替代 |
| 暂停检测 (pauseDetection) | 依赖实时 socket 数据流，已随 tosu 集成一并移除 |
| 自动更新检查 (updateChecker) | 插件通过 npm 分发，由 Koishi 插件市场管理更新 |
| tosu 设置面板 (settings UI) | 原项目的浏览器端设置界面，已替换为 Koishi Schema 配置面板 |
| Companella 估算器 | 依赖 ONNX Runtime，体积过大（~50MB），不适合插件使用 |
| 浏览器端 DOM 渲染 | 原项目直接操作 DOM 展示结果，已替换为 Puppeteer 截图方案 |

---

## 新增的功能 (Added)

| 功能 | 说明 |
| --- | --- |
| Koishi 命令接口 (`/ma`) | 通过聊天命令触发谱面分析，支持 ID、URL、附件输入 |
| Puppeteer 卡片截图渲染 | 使用 Puppeteer 将 HTML 模板渲染为图片卡片，发送到聊天 |
| 多镜像源 .osu 文件下载 | 支持 osu.ppy.sh、osu.direct、chimu、catboy 等多个镜像源，可自定义 |
| Mods 支持 | 支持 DT/NC/HT/DC/HR/EZ 等 mod，影响谱面速率和难度计算 |
| Koishi Schema 配置面板 | 通过 Koishi 控制台 UI 配置算法、Etterna 版本、镜像源等参数 |
| 中文本地化 | 命令描述、错误提示、卡片文案均提供中文支持 |

---

## 技术变更 (Technical Changes)

| 变更项 | 详情 |
| --- | --- |
| 语言转换 | 全部代码从 vanilla JavaScript 转换为 TypeScript，增加完整类型标注 |
| 模块格式 | ES modules 保持不变，通过 esbuild 打包为 CJS/ESM 双格式输出 |
| 渲染方案 | DOM 渲染替换为 Puppeteer 截图，HTML 模板作为字符串内嵌 |
| 数据获取 | 实时 socket 数据替换为按需 HTTP 下载 .osu 文件 |
| ETT WASM 加载 | WASM 文件作为资源文件分发，运行时通过 `fs.readFile` 动态加载 |
| 资源路径解析 | 通过 `__dirname` 解析资源路径，适配 esbuild 打包后的 `lib/` 目录结构 |

---

## 算法保真度 (Algorithm Fidelity)

所有保留的算法逻辑与原始项目完全一致，未做任何数学修改。

**保留的算法：**

- Azusa 估算器
- Sunny 估算器
- Daniel 估算器
- Mixed 估算器
- Etterna MinaCalc（5 个版本：0.68.0, 0.70.0, 0.72.0, 0.72.3, 0.74.0）
- Interlude SR
- Pattern 识别

**唯一例外：**

Mixed 估算器中移除了 Companella 路径（因 ONNX Runtime 依赖已移除）。当原本会调用 Companella 的情况下，回退到 Azusa/Daniel 路径进行估算。
