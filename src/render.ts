import { resolve } from "path";
import fs from 'fs';
import { PNG } from 'pngjs';
import Minefield from "./minesweeper";
const theme = "wom"




const imgArr = {}
export async function setTheme(themeName=theme) {
    const themePath = resolve(__dirname, "../../../data/minesweeper/theme/", themeName)
    const imageTypes = ['closed', 'flag', 'type0', 'type1', 'type2', 'type3', 'type4', 'type5', 'type6', 'type7', 'type8'];
    for(var type of imageTypes){
        imgArr[type]= await readImageAsArray(resolve(themePath, `${type}.png`))
    }
}



async function addText(arr:[],num:number){
    //todo
}
async function readImageAsArray(imagePath: string) {
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
     // 创建一个 Uint8Array 来保存 PNG 数据
     const pngBuffer = new Uint8Array(PNG.sync.write(png));

     // 转换 Uint8Array 到 ArrayBuffer
     const arrayBuffer = pngBuffer.buffer;
 
     return arrayBuffer;
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


export async function renderX(m: Minefield) {
    let x: number = m.width
    let img = []
    let tmp = []
    for(var i=0; i<m.cells;i++){
        const ii = m[String(i)]
        if(i%x==0&&i!=0){
            img = img.concat(concatX(...tmp))
            await writeArrayToImage(img, img[0].length, img.length, `${i}test.png`)
            tmp = []
        }
        if (ii["isOpen"]) {
            // 打开
            tmp.push(imgArr[`type${ii["mines"]}`])
          }
          else if (ii["isFlagged"]) {
            tmp.push(imgArr['flag'])
          }
          else {
            tmp.push(imgArr['closed'])
          }
    }
    img = img.concat(concatX(...tmp))
    await writeArrayToImage(img, img[0].length, img.length, `${i}test.png`)
    tmp = []
    const res = await writeArrayToImage(img, img[0].length, img.length, "test.png")
    return res
}