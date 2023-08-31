import { resolve } from "path";
import fs from 'fs';
import { PNG } from 'pngjs';

const theme = "wom"
const themePath = resolve(__dirname, "../../../data/minesweeper/theme/", theme)

async function readImageAsArray(imagePath:string) {
    const imageStream = fs.createReadStream(imagePath);
    const png = imageStream.pipe(new PNG());
    
    await new Promise((resolve, reject) => {
        png.on('parsed', resolve).on('error', reject);
    });

    const width = png.width;
    const height = png.height;
    const pixels = new Array(height);
    
    for (let y = 0; y < height; y++) {
        pixels[y] = new Array(width);
        for (let x = 0; x < width; x++) {
            const idx = (width * y + x) << 2;
            const r = png.data[idx];
            const g = png.data[idx + 1];
            const b = png.data[idx + 2];
            const a = png.data[idx + 3];
            pixels[y][x] = [r, g, b, a];
        }
    }
    return pixels;
}
const imageTypes = ['closed', 'flag', 'type0', 'type1', 'type2', 'type3', 'type4', 'type5', 'type6', 'type7', 'type8'];

async function loadImages(themePath) {
    const imagePromises = imageTypes.map(type => readImageAsArray(resolve(themePath, `${type}.png`)));
    return await Promise.all(imagePromises);
}

async function writeArrayToImage(pixels, width, height, imagePath) {
    // 创建一个新的PNG对象
    const png = new PNG({ width, height });
    // 将像素数据写入PNG对象
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // 获取像素索引
            const idx = (width * y + x) << 2;
            // 获取像素的RGBA值
            const [r, g, b, a] = pixels[y][x];
            // 将像素数据写入PNG对象
            png.data[idx] = r;
            png.data[idx + 1] = g;
            png.data[idx + 2] = b;
            png.data[idx + 3] = a;
        }
    }
    // 将PNG对象写入文件
    png.pack().pipe(fs.createWriteStream(imagePath));
}
function concatX(...arrayx: number[][][][]) {
    const temp: number[][][] = []
    for (let i = 0; i < 94; i++) {
        const temp2: number[][] = []
        const subArrays = arrayx.map(subArray => subArray[i]);
        for (const subArray of subArrays) {
            for (const item of subArray) {
                temp2.push(item);
            }
        }
        temp.push(temp2)
    }
    return temp
}

async function main() {
    const [closedPng, flagPng, type0Png, type1Png, type2Png, type3Png, type4Png, type5Png, type6Png, type7Png, type8Png] = await loadImages(themePath);
    const img = concatX(closedPng, flagPng, type0Png, type1Png, type2Png, type3Png, type4Png, type5Png, type6Png, type7Png, type8Png)
    await writeArrayToImage(img, img[0].length, img.length, "test.png")
}