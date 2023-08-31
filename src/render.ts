import { resolve } from "path";
const fs = require('fs');


const theme = "wom"
const themePath = resolve(__dirname,"../../../data/minesweeper/theme/",theme)
// const closedPng = fs.readFileSync(resolve(themePath,"closed.png"))
const flagPng = fs.readFileSync(resolve(themePath,"flag.png"))
// const type0Png = fs.readFileSync(resolve(themePath,"type0.png"))
const type1Png = fs.readFileSync(resolve(themePath,"type1.png"))
// const type2Png = fs.readFileSync(resolve(themePath,"type2.png"))
// const type3Png = fs.readFileSync(resolve(themePath,"type3.png"))
// const type4Png = fs.readFileSync(resolve(themePath,"type4.png"))
// const type5Png = fs.readFileSync(resolve(themePath,"type5.png"))
// const type6Png = fs.readFileSync(resolve(themePath,"type6.png"))
// const type7Png = fs.readFileSync(resolve(themePath,"type7.png"))
// const type8Png = fs.readFileSync(resolve(themePath,"type8.png"))


// // 读取图片文件的二进制数据
// const image1Data = fs.readFileSync('path/to/image1.png');
// const image2Data = fs.readFileSync('path/to/image2.png');

// // 将二进制数据转换为Uint8Array
const image1Array = new Uint8Array(flagPng);
const image2Array = new Uint8Array(type1Png);

// 创建一个新的Uint8Array来存储拼接后的图像数据
const combinedImageArray = new Uint8Array(image1Array.length + image2Array.length);
combinedImageArray.set(image1Array,0);
combinedImageArray.set(image2Array, image1Array.length);

// 将拼接后的图像数据写入新的图片文件
fs.writeFileSync('combined.png', Buffer.from(combinedImageArray));

console.log('拼接完成！');
async function mergeImages(image1Path, image2Path, x, y) {
    // 读取第一张图片
    const image1 = await Jimp.read(image1Path);
    // 读取第二张图片
    const image2 = await Jimp.read(image2Path);
    // 将第二张图片合并到第一张图片上
    image1.composite(image2, x, y);
    // 返回合并后的图片
    return image1;
  }
