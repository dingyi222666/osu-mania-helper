# Upstream Sync Guide

- **Source repo:** https://github.com/LeoBlackMT/osumania_map_analyser
- **Branch:** main
- **Commit:** `fddbad284dde6eac8be071c51dbca53c02c68af3`
- **Port date:** 2025-05-24
- **Upstream license:** MIT (Copyright (c) 2026 Leo_Black)
- **License file:** [`src/analyser/core/LICENSE`](core/LICENSE)

---

## Directory Mapping

| Upstream Path | Our Path | Status |
|---|---|---|
| `js/parser/osuFileParser.js` | `src/analyser/core/parser/osuFileParser.ts` | Ported, typed |
| `js/parser/patternOsuParser.js` | `src/analyser/core/parser/patternOsuParser.ts` | Ported, typed |
| `js/estimator/azusaEstimator.js` | `src/analyser/core/estimator/azusaEstimator.ts` | Ported, typed |
| `js/estimator/sunnyEstimator.js` | `src/analyser/core/estimator/sunnyEstimator.ts` | Ported, typed |
| `js/estimator/danielEstimator.js` | `src/analyser/core/estimator/danielEstimator.ts` | Ported, typed |
| `js/estimator/mixedEstimator.js` | `src/analyser/core/estimator/mixedEstimator.ts` | Ported, Companella removed |
| `js/estimator/reworkEstimatorUtils.js` | `src/analyser/core/estimator/reworkEstimatorUtils.ts` | Ported, typed |
| `js/estimator/intervals/` | `src/analyser/core/estimator/intervals/` | Ported as-is |
| `js/rework/sunnyAlgorithm.js` | `src/analyser/core/rework/sunnyAlgorithm.ts` | Ported, typed |
| `js/rework/danielAlgorithm.js` | `src/analyser/core/rework/danielAlgorithm.ts` | Ported, typed |
| `js/ett/index.js` | `src/analyser/core/ett/index.ts` | Ported, typed |
| `js/ett/calc.js` | `src/analyser/core/ett/calc.ts` | Ported, typed |
| `js/ett/versions/index.js` | `src/analyser/core/ett/versions/index.ts` | Ported, WASM loading rewritten for Node.js |
| `js/ett/versions/*.js + *.wasm` | `resources/analyser/ett/*.cjs + *.wasm` | Copied, .js renamed to .cjs, patched import.meta→CJS |
| `js/interlude/` | `src/analyser/core/interlude/` | Ported, typed |
| `js/patterns/` | `src/analyser/core/patterns/` | Ported, typed |
| `js/app/vibro.js` | `src/analyser/core/vibro.ts` | Ported, typed |
| `js/app/modeLogic.js` | `src/analyser/core/modeLogic.ts` | Ported, typed |
| `js/app/modData.js` | `src/analyser/core/modData.ts` | Ported, typed |
| `js/app/analysis.js` | `src/analyser/core/analysis.ts` | Ported, HTTP/DOM/socket removed |
| `js/app/graph.js` | Not ported (graph rendering reimplemented in render module) | — |
| `js/app/graphMath.js` | Not ported | — |
| `js/app/socket.js` | Not ported (removed) | — |
| `js/app/socketHandlers.js` | Not ported (removed) | — |
| `js/app/display.js` | Not ported (replaced by puppeteer card) | — |
| `js/app/hud.js` | Not ported (removed) | — |
| `js/app/pauseDetection.js` | Not ported (removed) | — |
| `js/app/updateChecker.js` | Not ported (removed) | — |
| `js/app/settings.js` | Not ported (removed) | — |
| `js/app/scheduler.js` | Not ported (removed) | — |
| `js/app/appContext.js` | Not ported (removed) | — |
| `js/app/main.js` | Not ported (entry point, removed) | — |
| `js/parser/settingsParser.js` | Not ported (settings UI, removed) | — |
| `js/patterns/chart.js` | Not ported (chart rendering, removed) | — |
| `js/estimator/companellaEstimator.js` | Not ported (ONNX too heavy) | — |
| `js/estimator/companella/` | Not ported | — |

---

## Changes Made During Port

### All files

- Converted from JS to TypeScript with type annotations
- Removed `.js` extensions from imports

### Per-file changes

- **`analysis.ts`**: Removed HTTP fetch, DOM manipulation, socket references, appContext. Converted to pure function. Added `bpm` field to `AnalysisResult` with `calculatePrimaryBpm()` helper (duration-weighted primary BPM from uninherited timing points). Extended `parseMetadataFromBeatmap` to also return `timingPoints`.
- **`mixedEstimator.ts`**: Removed Companella estimator path entirely.
- **`ett/versions/index.ts`**: Rewrote WASM loading to use `require()` + `fs.readFileSync` for Node.js compatibility.
- **WASM glue files** (`resources/analyser/ett/*.cjs`): Renamed .js→.cjs, replaced `import.meta.url` with CJS equivalent, replaced `export default` with `module.exports`.
- **`parser/osuFileParser.ts`**: No logic changes, only type annotations added.
- **All estimators/rework**: No algorithm changes, only type annotations.

---

## Files We Created (Not From Upstream)

| File | Purpose |
|---|---|
| `src/analyser/core/cache.ts` | Beatmap file cache |
| `src/analyser/core/downloader.ts` | Multi-mirror .osu download |
| `src/analyser/core/analysis.ts` | Orchestrator rewritten as pure function (based on upstream `app/analysis.js`) |
| `src/analyser/core/LICENSE` | Upstream license file |
| `src/analyser/core/estimator/index.ts` | Barrel export for estimators |
| `src/analyser/core/estimator/types.ts` | TypeScript types for estimators |
| `src/analyser/core/ett/types.ts` | TypeScript types for ETT |
| `src/analyser/core/parser/index.ts` | Barrel export for parsers |
| `src/analyser/core/parser/types.ts` | TypeScript types for parsers |
| `src/analyser/core/patterns/index.ts` | Barrel export for patterns |
| `src/analyser/core/patterns/types.ts` | TypeScript types for patterns |
| `src/analyser/core/rework/index.ts` | Barrel export for rework |
| `src/analyser/core/rework/types.ts` | TypeScript types for rework |
| `src/analyser/core/interlude/types.ts` | TypeScript types for interlude |
| `src/analyser/render/` | Entire render module (puppeteer-based card rendering) |
| `src/analyser/commands.ts` | Koishi command handler |
| `src/analyser/config.ts` | Koishi Schema config |
| `src/analyser/formatters.ts` | Text/card formatting |
| `src/analyser/utils.ts` | Utilities |

---

## How to Sync Upstream Updates

### Step-by-step

1. Clone or pull the latest upstream repo.
2. Compare each file in the mapping table above.
3. **For algorithm files** (estimators, rework, interlude, patterns, parser):
   - Diff the upstream JS against our TS.
   - Apply logic changes while preserving type annotations.
   - Do NOT change function signatures without updating callers.
4. **For ETT WASM files:**
   - Copy new `.js` + `.wasm` files to `resources/analyser/ett/`.
   - Rename `.js` → `.cjs`.
   - Patch: replace `import.meta.url` with `require('url').pathToFileURL(__filename).href`.
   - Patch: replace `export default Module` with `module.exports = Module`.
   - Update version registry in `src/analyser/core/ett/versions/index.ts`.
5. **For new estimators/features:**
   - Create new `.ts` file following existing patterns.
   - Add types to the relevant `types.ts`.
   - Register in `index.ts` barrel exports.
   - Wire into `analysis.ts` orchestrator.
6. Run `yarn build` to verify.
7. Test with a known beatmap to verify results match upstream.

---

## Algorithm Fidelity Notes

- ALL mathematical logic is preserved exactly as upstream.
- No rounding changes, no algorithm modifications.
- The only exception: Mixed estimator's Companella path is removed (falls back to Azusa/Daniel).
- If upstream changes algorithm constants or logic, copy them verbatim.
