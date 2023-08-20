import { Schema } from 'koishi';
import fs from "fs";
import { resolve } from "path";

export const MineConfig = Schema.intersect([
    Schema.object({
        MinHintTime: Schema.number().default(15000).description("获取提示的冷却时间"),
        wrongSleep: Schema.number().default(5000).description("猜错后的冷却时间"),
        DifficultyLevel: Schema.percent().role('slider').default(0.5).description("难度等级,0最简单，1最难"),
    }).description("残局玩法设置"),
    Schema.object({
        EntryFee: Schema.number().default(10).description("挑战模式门票费用"),
    }),
    Schema.object({
        theme: Schema.string().default('chocolate').description("扫雷的皮肤"),
        colorForSerialNum: Schema.string().default('gray').description("方块序列号的颜色"),
        FontSizeForSerialNum: Schema.number().default(40).description("方块序列号的字体大小"),
        BackGroundColor: Schema.string().default("white").description("背景颜色"),
    }).description("主题设置"),
    Schema.object({
        width: Schema.number().default(5).description("宽度"),
        height: Schema.number().default(5).description("高度"),
        mines: Schema.number().default(10).description("雷数"),
    }).description("残局地图设置, 应当使方块数小于100, 否则无法进行游戏操作"),
    Schema.object({
        widthC: Schema.number().default(6).description("宽度"),
        heightC: Schema.number().default(6).description("高度"),
        minesC: Schema.number().default(15).description("雷数"),
    }).description("挑战模式地图设置, 应当使方块数小于100, 否则无法进行游戏操作")
])


export interface MineConfig {
    MinHintTime: number
    wrongSleep: number
    DifficultyLevel: number

    EntryFee: number

    theme: string
    colorForSerialNum: string
    FontSizeForSerialNum: number
    BackGroundColor: string


    width: number
    height: number
    mines: number


    widthC: number
    heightC: number
    minesC: number

}
export const mineUsage = fs.readFileSync(resolve(__dirname, '../readme.md'))