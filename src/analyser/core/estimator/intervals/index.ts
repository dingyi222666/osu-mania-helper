// Ported from https://github.com/LeoBlackMT/osumania_map_analyser

import type { DanIndex } from '../types'
import { rc4KReform } from './4k-rc-reform'
import { ln4K } from './4k-ln'
import { rc6K } from './6k-rc'
import { ln6K } from './6k-ln'
import { rc7K } from './7k-rc'
import { ln7K } from './7k-ln'

export const DAN_INDEX: DanIndex = {
  4: {
    RC: { default: rc4KReform },
    LN: { default: ln4K },
  },
  6: {
    RC: { default: rc6K },
    LN: { default: ln6K },
  },
  7: {
    RC: { default: rc7K },
    LN: { default: ln7K },
  },
}
