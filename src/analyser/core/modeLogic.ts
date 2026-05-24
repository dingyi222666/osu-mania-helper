// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

// ─── Mode Tag Classification ─────────────────────────────────────────────────
// Classifies a beatmap into RC (Rice), LN (Long Note), or Mix based on LN ratio.

export type ModeTag = 'RC' | 'LN' | 'Mix'

export function modeTagFromLnRatio(lnRatio: number): ModeTag {
  if (!Number.isFinite(lnRatio)) {
    return 'Mix'
  }
  if (lnRatio <= 0.15) {
    return 'RC'
  }
  if (lnRatio >= 0.9) {
    return 'LN'
  }
  return 'Mix'
}

export function normalizeClientStateName(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

export function isPlayStateName(normalizedStateName: string): boolean {
  return normalizedStateName === 'play'
    || normalizedStateName === 'gameplay'
    || normalizedStateName === 'playing'
}

export function isResultScreenStateName(normalizedStateName: string): boolean {
  return normalizedStateName === 'resultscreen'
}

// ─── Auto Display Profile ────────────────────────────────────────────────────
// Determines which content bar and SR text to show based on mode tag.

export interface AutoDisplayProfile {
  contentBar: string
  srText: string
}

export function resolveAutoDisplayProfile(modeTag: ModeTag): AutoDisplayProfile {
  if (modeTag === 'RC') {
    return {
      contentBar: 'Etterna',
      srText: 'MSD',
    }
  }

  return {
    contentBar: 'Pattern',
    srText: 'ReworkSR',
  }
}
