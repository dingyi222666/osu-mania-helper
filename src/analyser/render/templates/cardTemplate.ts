// Card HTML template - loaded from resources/analyser/card.html at runtime.

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

function getCardTemplatePath(): string {
    const runtimeDir =
        typeof __dirname === 'string'
            ? __dirname
            : path.dirname(fileURLToPath(import.meta.url))
    return path.resolve(runtimeDir, '../resources/analyser/card.html')
}

let _cachedTemplate: string | null = null

export function getCardTemplate(): string {
    if (_cachedTemplate === null) {
        _cachedTemplate = fs.readFileSync(getCardTemplatePath(), 'utf-8')
    }
    return _cachedTemplate
}
