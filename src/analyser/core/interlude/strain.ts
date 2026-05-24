// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

import { keysOnLeftHand } from './layout'
import { isPlayableNoteType } from './types'
import { f32 } from './numberUtils'
import type { NoteRow, NoteDifficultyItem, FingerStrainRow, HandStrainRow } from './types'

const STRAIN_SCALE = f32(0.01626)
const STRAIN_TIME_CAP = f32(200.0)

function createStrainFunction(halfLife: number): (value: number, input: number, delta: number) => number {
  const decayRate = f32(Math.log(0.5) / halfLife)

  return (value: number, input: number, delta: number): number => {
    const clampedDelta = Math.min(STRAIN_TIME_CAP, delta)
    const decay = f32(Math.exp(decayRate * clampedDelta))
    const timeCapDecay = delta > STRAIN_TIME_CAP
      ? f32(Math.exp(decayRate * (delta - STRAIN_TIME_CAP)))
      : 1.0
    const a = f32(value * timeCapDecay)
    const b = f32(input * input * STRAIN_SCALE)
    return f32(b - (b - a) * decay)
  }
}

const strainBurst = createStrainFunction(1575.0)
const strainStamina = createStrainFunction(60000.0)

export function calculateFingerStrains(rate: number, noteRows: NoteRow[], noteDifficulty: NoteDifficultyItem[][]): FingerStrainRow[] {
  if (!Array.isArray(noteRows) || noteRows.length === 0) {
    return []
  }

  const rateValue = Number.isFinite(rate) && rate > 0 ? rate : 1.0
  const keys = noteRows[0].data.length

  const lastNoteInColumn = new Array<number>(keys).fill(0.0)
  const strainV1 = new Array<number>(keys).fill(0.0)

  const output: FingerStrainRow[] = []

  for (let i = 0; i < noteRows.length; i += 1) {
    const row = noteRows[i]
    const offset = Number(row.time)

    const notesV1 = new Array<number>(keys).fill(0.0)
    const rowStrainV1 = new Array<number>(keys).fill(0.0)

    for (let k = 0; k < keys; k += 1) {
      if (!isPlayableNoteType(row.data[k])) {
        continue
      }

      notesV1[k] = Number(noteDifficulty[i][k].Total) || 0.0
      strainV1[k] = strainBurst(
        strainV1[k],
        notesV1[k],
        (offset - lastNoteInColumn[k]) / rateValue,
      )
      rowStrainV1[k] = strainV1[k]
      lastNoteInColumn[k] = offset
    }

    output.push({
      NotesV1: notesV1,
      StrainV1Notes: rowStrainV1,
    })
  }

  return output
}

export function calculateHandStrains(rate: number, noteRows: NoteRow[], noteDifficulty: NoteDifficultyItem[][]): HandStrainRow[] {
  if (!Array.isArray(noteRows) || noteRows.length === 0) {
    return []
  }

  const rateValue = Number.isFinite(rate) && rate > 0 ? rate : 1.0
  const keys = noteRows[0].data.length
  const handSplit = keysOnLeftHand(keys)

  const lastNoteInColumn: [number, number, number][] = Array.from({ length: keys }, () => [0.0, 0.0, 0.0])
  const output: HandStrainRow[] = []

  for (let i = 0; i < noteRows.length; i += 1) {
    const row = noteRows[i]
    const offset = Number(row.time)

    let leftHandBurst = 0.0
    let leftHandStamina = 0.0
    let rightHandBurst = 0.0
    let rightHandStamina = 0.0

    const strains = new Array<number>(keys).fill(0.0)

    for (let k = 0; k < keys; k += 1) {
      if (!isPlayableNoteType(row.data[k])) {
        continue
      }

      const d = Number(noteDifficulty[i][k].Total) || 0.0

      if (k < handSplit) {
        for (let handK = 0; handK < handSplit; handK += 1) {
          const [prevBurst, prevStamina, prevTime] = lastNoteInColumn[handK]
          leftHandBurst = Math.max(leftHandBurst, strainBurst(prevBurst, d, (offset - prevTime) / rateValue))
          leftHandStamina = Math.max(leftHandStamina, strainStamina(prevStamina, d, (offset - prevTime) / rateValue))
        }
      } else {
        for (let handK = handSplit; handK < keys; handK += 1) {
          const [prevBurst, prevStamina, prevTime] = lastNoteInColumn[handK]
          rightHandBurst = Math.max(rightHandBurst, strainBurst(prevBurst, d, (offset - prevTime) / rateValue))
          rightHandStamina = Math.max(rightHandStamina, strainStamina(prevStamina, d, (offset - prevTime) / rateValue))
        }
      }
    }

    for (let k = 0; k < keys; k += 1) {
      if (!isPlayableNoteType(row.data[k])) {
        continue
      }

      if (k < handSplit) {
        lastNoteInColumn[k] = [leftHandBurst, leftHandStamina, offset]
        strains[k] = f32(leftHandBurst * 0.875 + leftHandStamina * 0.125)
      } else {
        lastNoteInColumn[k] = [rightHandBurst, rightHandStamina, offset]
        strains[k] = f32(rightHandBurst * 0.875 + rightHandStamina * 0.125)
      }
    }

    output.push({
      Strains: strains,
      Left: [leftHandBurst, leftHandStamina],
      Right: [rightHandBurst, rightHandStamina],
    })
  }

  return output
}
