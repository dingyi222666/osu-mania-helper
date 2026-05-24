// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

// ─── Mod Data Parsing ────────────────────────────────────────────────────────
// Parses mod flags from various osu! client data payloads (stable, lazer, tourney).

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ModDataOptions {
  sortedKnownModCodes: string[]
  modBitFlagEntries: [string, number][]
  fallbackClient?: string
  preferPlayMods?: boolean
}

export interface ModDataResult {
  client: string
  speedRate: number
  odFlag: string | number | null
  cvtFlag: string | null
  modSignature: string
  hasModPayload: boolean
  hasModInfo: boolean
  hasExplicitNoMod: boolean
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function collectValues(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }
  if (value && typeof value === 'object') {
    return Object.values(value).filter(Boolean)
  }
  return []
}

function collectPlayModsCandidates(data: Record<string, any>): any[] {
  const candidates: any[] = [data?.play?.mods]

  for (const tourneyClient of collectValues(data?.tourney?.clients)) {
    candidates.push((tourneyClient as any)?.play?.mods)
  }
  for (const ipcClient of collectValues(data?.tourney?.ipcClients)) {
    candidates.push((ipcClient as any)?.gameplay?.mods)
  }

  return candidates
}

function collectNonPlayModsCandidates(data: Record<string, any>): any[] {
  return [data?.menu?.mods, data?.resultsScreen?.mods]
}

function addCodesFromString(
  codes: Set<string>,
  value: unknown,
  sortedKnownModCodes: string[],
): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return
  }
  const normalized = value.toUpperCase().replace(/[^A-Z]/g, '')
  let index = 0
  while (index < normalized.length) {
    let matched = false
    for (const code of sortedKnownModCodes) {
      if (normalized.startsWith(code, index)) {
        codes.add(code)
        index += code.length
        matched = true
        break
      }
    }
    if (!matched) {
      index += 1
    }
  }
}

function addCodesFromNumber(
  codes: Set<string>,
  value: unknown,
  modBitFlagEntries: [string, number][],
): void {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return
  }
  for (const [code, bit] of modBitFlagEntries) {
    if ((number & bit) !== 0) {
      codes.add(code)
    }
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function getModData(
  data: Record<string, any>,
  options: ModDataOptions,
): ModDataResult {
  const { sortedKnownModCodes, modBitFlagEntries, fallbackClient, preferPlayMods = false } = options

  const payloadClient = String(data?.client || '').toLowerCase()
  const client = payloadClient || String(fallbackClient || '').toLowerCase()

  const playModsCandidates = collectPlayModsCandidates(data)
  const nonPlayModsCandidates = collectNonPlayModsCandidates(data)
  const selectedModsCandidates = preferPlayMods
    ? playModsCandidates
    : [...playModsCandidates, ...nonPlayModsCandidates]

  const validMods = selectedModsCandidates.filter(
    (mods: any) => mods !== undefined && mods !== null,
  )
  const hasModPayload = validMods.length > 0

  const modCodes = new Set<string>()
  const modArrays: any[][] = []
  let hasModInfo = false
  let hasExplicitNoMod = false

  for (const mods of validMods) {
    const nameText = typeof mods?.name === 'string' ? mods.name.trim() : ''
    const strText = typeof mods?.str === 'string' ? mods.str.trim() : ''
    const acronymText = typeof mods?.acronym === 'string' ? mods.acronym.trim() : ''
    const numberValue = Number(mods?.number)
    const numValue = Number(mods?.num)

    if (nameText.length > 0) {
      hasModInfo = true
    }
    if (strText.length > 0) {
      hasModInfo = true
    }
    if (acronymText.length > 0) {
      hasModInfo = true
    }
    if (Number.isFinite(numberValue) || Number.isFinite(numValue)) {
      hasModInfo = true
    }

    if (/^(NM|NOMOD|NONE)$/i.test(nameText)
      || /^(NM|NOMOD|NONE)$/i.test(strText)
      || /^(NM|NOMOD|NONE)$/i.test(acronymText)
      || (Number.isFinite(numberValue) && numberValue === 0)
      || (Number.isFinite(numValue) && numValue === 0)) {
      hasExplicitNoMod = true
    }

    addCodesFromString(modCodes, mods?.name, sortedKnownModCodes)
    addCodesFromString(modCodes, mods?.str, sortedKnownModCodes)
    addCodesFromString(modCodes, mods?.acronym, sortedKnownModCodes)
    addCodesFromNumber(modCodes, mods?.number, modBitFlagEntries)
    addCodesFromNumber(modCodes, mods?.num, modBitFlagEntries)

    if (Array.isArray(mods?.array)) {
      if (mods.array.length > 0) {
        hasModInfo = true
      } else {
        hasExplicitNoMod = true
      }
      modArrays.push(mods.array)
    }
    if (Array.isArray(mods)) {
      if (mods.length > 0) {
        hasModInfo = true
      } else {
        hasExplicitNoMod = true
      }
      modArrays.push(mods)
    }
  }

  for (const arrayMods of modArrays) {
    for (const modItem of arrayMods) {
      if (!modItem) {
        continue
      }
      if (typeof modItem === 'string') {
        addCodesFromString(modCodes, modItem, sortedKnownModCodes)
        continue
      }
      addCodesFromString(modCodes, modItem?.acronym, sortedKnownModCodes)
    }
  }

  let speedRate = 1.0
  let odFlag: string | number | null = null
  let cvtFlag: string | null = null
  let daOverallDifficulty: number | null = null
  let lazerSpeedChange: number | null = null

  if (client === 'lazer') {
    for (const arrayMods of modArrays) {
      for (const modItem of arrayMods) {
        if (!modItem || typeof modItem !== 'object') {
          continue
        }

        const acronym = String(modItem?.acronym || '').toUpperCase()
        if (acronym) {
          modCodes.add(acronym)
        }

        const speedChange = Number(modItem?.settings?.speed_change)
        if (Number.isFinite(speedChange) && speedChange > 0) {
          lazerSpeedChange = speedChange
        }

        if (acronym === 'DA') {
          const overallDifficulty = Number(modItem?.settings?.overall_difficulty)
          if (Number.isFinite(overallDifficulty)) {
            daOverallDifficulty = overallDifficulty
          }
        }
      }
    }
  }

  if (client === 'lazer' && Number.isFinite(lazerSpeedChange) && lazerSpeedChange! > 0) {
    speedRate = lazerSpeedChange!
  } else if (modCodes.has('NC') || modCodes.has('DT')) {
    speedRate = 1.5
  } else if (modCodes.has('HT') || modCodes.has('DC')) {
    speedRate = 0.75
  }

  if (client === 'lazer' && Number.isFinite(daOverallDifficulty)) {
    odFlag = daOverallDifficulty
  } else if (modCodes.has('HR')) {
    odFlag = 'HR'
  } else if (modCodes.has('EZ')) {
    odFlag = 'EZ'
  }

  if (client === 'lazer') {
    if (modCodes.has('IN')) {
      cvtFlag = 'IN'
    } else if (modCodes.has('HO')) {
      cvtFlag = 'HO'
    }
  }

  const hasRelevantModInfo = modCodes.size > 0
    || Number.isFinite(lazerSpeedChange)
    || Number.isFinite(daOverallDifficulty)
    || cvtFlag != null
    || odFlag != null
    || Math.abs(Number(speedRate) - 1.0) > 1e-6

  const hasExplicitNoModSignal = hasExplicitNoMod
    && !hasRelevantModInfo

  // Only include calculation-relevant dimensions in signature.
  // This avoids recompute thrash when unrelated lazer mod payload fields fluctuate.
  const modSignature = [
    Number(speedRate).toFixed(5),
    odFlag == null ? 'none' : String(odFlag),
    cvtFlag == null ? 'none' : String(cvtFlag),
  ].join('|')

  return {
    client,
    speedRate,
    odFlag,
    cvtFlag,
    modSignature,
    hasModPayload,
    hasModInfo: hasRelevantModInfo,
    hasExplicitNoMod: hasExplicitNoModSignal,
  }
}

export function extractCurrentSongTimeMs(data: Record<string, any>): number | null {
  const liveTime = Number(data?.beatmap?.time?.live)
  if (Number.isFinite(liveTime)) {
    return liveTime
  }

  const candidates = [
    data?.beatmap?.time?.current,
    data?.menu?.bm?.time?.current,
    data?.play?.time?.current,
    data?.resultsScreen?.time?.current,
  ]

  for (const value of candidates) {
    const num = Number(value)
    if (Number.isFinite(num)) {
      return num
    }
  }

  return null
}
