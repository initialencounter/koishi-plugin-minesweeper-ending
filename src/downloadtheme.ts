import { createWriteStream, existsSync} from 'fs'
import axios from 'axios'
import AdmZip from 'adm-zip'
import { mkdir } from 'fs/promises'
import { Logger, Context } from "koishi"
import { resolve } from "path"
const ctx = new Context()
const logger = new Logger("minesweeper-ending")
const binary = resolve(ctx.baseDir, "data/minesweeper/theme/chocolate/type0.png")
if (!existsSync(binary)) {
    downloadRelease(resolve(ctx.baseDir, "data/minesweeper"))
}
async function downloadRelease(themePath) {
    const filename = `theme.zip`
    const url = "https://gitee.com/initencunter/koishi-plugin-minesweeper-ending/releases/download/v1.1.0/theme.zip"

    logger.info(`正在下载扫雷主题`)
    const [{ data: stream }] = await Promise.all([
        axios.get<NodeJS.ReadableStream>(url, { responseType: 'stream' }),
        await mkdir(themePath, { recursive: true }),
    ])
    return new Promise<void>(async (resolved, reject) => {
        stream.on('end', resolved)
        stream.on('error', reject)
        if (filename.endsWith('.zip')) {
            stream.pipe(createWriteStream(resolve(themePath, filename))).on("finish", () => {
                const adm = new AdmZip(resolve(themePath, filename))
                adm.extractAllTo(themePath, true)
            }).on("error", (err) => {
                logger.info(`下载失败，请手动下载,地址:${url}，目录结构 data\\minesweeper\\theme\\chocolate\\type0.png`)
                reject(err)
            })
        }
    })
}