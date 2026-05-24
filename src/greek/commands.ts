import { Context, h, Session } from 'koishi'
import {
    parseGreekPosition,
    parseGreekSymbol,
    renderGreekImage
} from './renderer'

const promptTimeout = 1000 * 60

export function apply(ctx: Context) {
    ctx.command(
        'greek <symbol:string>',
        '根据 osu!mania 段位生成带希腊字母的图片'
    )
        .option('position', '-p <position:string>')
        .option('size', '-s <size:number>')
        .option('glitch', '-g <glitch:number>')
        .option('rgb', '-r <rgb:number>')
        .option('wave', '-w <wave:number>')
        .option('blocks', '-b <blocks:number>')
        .option('noise', '-n <noise:number>')
        .option('scanline', '--scanline <scanline:number>')
        .option('vignette', '--vignette <vignette:number>')
        .option('ghost', '--ghost <ghost:number>')
        .action(async ({ session, options }, symbolInput) => {
            const symbol = parseGreekSymbol(symbolInput)
            if (!symbol) return session.text('.invalid-symbol')

            const position = parseGreekPosition(options.position)
            if (!position) return session.text('.invalid-position')

            let images = await readImages(session)
            if (images.length === 0) {
                await session.send(session.text('.prompt-image'))
                const prompted = await session.prompt(
                    async (next) => readImages(next),
                    { timeout: promptTimeout }
                )
                if (!prompted) return session.text('.timeout')
                images = prompted
            }

            if (images.length === 0) return session.text('.no-image')

            try {
                const output = await renderGreekImage(images[0], {
                    symbol,
                    position,
                    size: options.size,
                    glitch: options.glitch,
                    rgb: options.rgb,
                    wave: options.wave,
                    blocks: options.blocks,
                    noise: options.noise,
                    scanline: options.scanline,
                    vignette: options.vignette,
                    ghost: options.ghost
                })

                return h.image(output, 'image/png')
            } catch (error) {
                ctx.logger.warn(error)
                return session.text('.failed')
            }
        })
}

async function readImages(session: Session, content = ''): Promise<Buffer[]> {
    const elements = getImageElements(session, content)
    const images: Buffer[] = []

    for (const element of elements) {
        const url = (element.attrs.url ?? element.attrs.src) as string
        if (!url) continue

        if (url.startsWith('data:image') && url.includes('base64')) {
            images.push(Buffer.from(url.split(',')[1], 'base64'))
            continue
        }

        const response = await session.app.http(url, {
            responseType: 'arraybuffer',
            method: 'get',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
            }
        })

        images.push(Buffer.from(response.data))
    }

    return images
}

function getImageElements(session: Session, content = '') {
    return [
        ...h.select(session.elements, 'img'),
        ...h.select(h.parse(content), 'img'),
        ...h.select(
            session.quote?.elements ?? h.parse(session.quote?.content ?? ''),
            'img'
        )
    ]
}
