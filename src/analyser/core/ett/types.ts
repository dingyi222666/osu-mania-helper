// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

// ─── WASM Module Interface ───────────────────────────────────────────────────
// The MinaCalc WASM modules (minaclac-XX.X.js + .wasm) are compiled binaries
// and cannot be converted to TypeScript. This interface describes what they export.

export interface MinaCalcWasmModule {
  _malloc(bytes: number): number
  _free(ptr: number): void
  _minacalc_compute(
    keycount: number,
    musicRate: number,
    scoreGoal: number,
    ptrMasks: number,
    ptrTimes: number,
    rowCount: number,
    ptrOut: number,
  ): number
  HEAPU32: Uint32Array
  HEAPF32: Float32Array
}

export type WasmLoaderOptions = {
  locateFile?: (path: string) => string
}

export type WasmLoader = (options?: WasmLoaderOptions) => Promise<MinaCalcWasmModule>

// ─── Version Registry ────────────────────────────────────────────────────────

export interface EtternaVersionEntry {
  loader: WasmLoader
  reason: string | null
  supportedKeycounts: readonly number[]
}

export interface ResolvedVersionLoader {
  requestedVersion: string
  version: string
  loader: WasmLoader
  fallbackReason: string | null
}

// ─── MSD Skillset Values ─────────────────────────────────────────────────────

export interface MsdSkillsetValues {
  Overall: number
  Stream: number
  Jumpstream: number
  Handstream: number
  Stamina: number
  JackSpeed: number
  Chordjack: number
  Technical: number
}

export type SkillsetName = keyof MsdSkillsetValues

// ─── ETT Analysis Options & Results ──────────────────────────────────────────

export interface EtternaAnalyzeOptions {
  musicRate?: number
  scoreGoal?: number
  keyOverride?: number | null
  cvtFlag?: string | null
  etternaVersion?: string | null
}

export interface EtternaAnalyzeResult {
  keycount: number
  lnRatio: number
  metadata: Record<string, string>
  requestedEtternaVersion?: string
  etternaVersion?: string
  etternaVersionFallbackReason?: string | null
  values: MsdSkillsetValues
  engine?: string
}
