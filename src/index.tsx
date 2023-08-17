import { Context, Schema, Logger } from 'koishi'

import Minefield from "./minesweeper";
import { relative, resolve } from 'path';
export const name = 'minesweeper-ending'
const logger = new Logger(name)


class EndingGame {
  minefield: Minefield
  x: number
  y: number
  mineNum: number
  key_pool: string[] //谜底
  constructor(private ctx: Context, private config: EndingGame.Config) {
    let tset = [1,1,1]
    console.log(tset,tset.length)
    ctx.command("残局 [行:number] [列:number] [雷:number]").action(({ session, options }, ...args) => {
      if (this.minefield && this.minefield.isGoingOn()) {
        return "已存在残局"
      }
      if (args[0] && args[1]) {
        this.x = args[0]
        this.y = args[1]
      }
      if (args[2]) {
        this.mineNum = args[2]
      } else {
        this.mineNum = this.getMineNums(this.x, this.y)
      }
      this.minefield = this.initialize(this.x, this.y, this.mineNum)
      return this.renderX(this.minefield, this.x, this.y)
    })

    /**
     * 二. 开始游戏
     * 1.发送雷图
     * 2.接收玩家的指令，将残局的所有雷标记出来的玩家获胜
     */
    ctx.command("破解 [numberString:string]").action(async ({ session, options }, inputString) => {
      if (!this.minefield || !this.minefield.isGoingOn()) {
        return "不存在残局"
      }
      const tmp = []
      for (let i = 0; i < inputString.length; i += 2) {
        let pair = inputString.slice(i, i + 2);
        console.log(pair)
        if (pair.startsWith("0")) {
          pair = this.remove0(pair)
        }
        // 清洗后的 cellId
        if (pair) {
          if (this.minefield?.[pair]?.["mines"] == -1) {
            await session.send("破解失败")
            this.minefield = this.initialize(this.x, this.y, this.mineNum)
            return this.renderX(this.minefield, this.x, this.y)
           
          }
          tmp.push(pair)
        }
      }
      const c = this.key_pool.filter(function(v){ return tmp.indexOf(v) > -1 })
      console.log(c)
      console.log(tmp)
      console.log(this.key_pool)
      if(c.length<this.key_pool.length){
        return `破解失败，你猜对了${c.length}个`
      }else{
        return "破解成功！"
      }
    })

  }

  /**
   * 一.初始化，生成一个小的残局
   * 1.破空(就是打开所有雷数为0的格子)
   * 2.随机打开不为雷的格子
   * @param x 行
   * @param y 列
   * @param z 雷
   */
  initialize(x: number, y: number, z: number): Minefield {
    this.key_pool = []
    const minefield: Minefield = new Minefield(x, y, z)
    const cells = x * y
    const savePool: number[] = []
    // 
    for (var i: number = 0; i < cells; i++) {
      const cellRecent = minefield[String(i)]
      if (cellRecent["mines"] == 0) {
        minefield.openCell(i)
      } else if (cellRecent["mines"] != -1 && !cellRecent["isOpen"]) {
        savePool.push(i)
      }
    }
    console.log(savePool)
    for (var cellId of savePool) {
      console.log(cellId)
      // if (Math.random()> 0.7) {
      //   minefield.openCell(cellId)
      // }
    }
    console.log(minefield)
    for (var i: number = 0; i < cells; i++) {
      const cellRecent = minefield[String(i)]
      // 处于关闭状态 且 不是雷的cell.
      if (!cellRecent["isMine"] && !cellRecent["isOpen"]) {

        // 将 cell id 放到 谜底池中
        this.key_pool.push(String(i))
      }
    }
    return minefield

  }
  /**
   * 渲染雷图
   * @param m Minefield
   * @returns 消息
   */
  renderX(m: Minefield, x: number, y: number) {
    const dm = 94
    const mine_div = []
    for (var i: number = 0; i < (x * y); i++) {
      const ii = m[String(i)]
      var style_str = `position: absolute;left: ${(i % x) * dm}px;top: ${Math.floor(i / x) * dm}px`
      var style_center_text = `position: absolute;font-size: 40px;left: ${(i % x) * dm+45}px;top: ${Math.floor(i / x) * dm}px`
      // mine_div.push(<img src={resolve(__dirname, `theme/type${ii["mines"]}.png`)} style={style_str}></img>)

      if (ii["isOpen"]) {
        // 打开
        if (ii["mines"] == 0) {
          mine_div.push(<img src={resolve(__dirname, "theme/type0.png")} style={style_str}></img>)
        } else {
          mine_div.push(<img src={resolve(__dirname, `theme/type${ii["mines"]}.png`)} style={style_str}></img>)
        }
      }
      else {
        // 未打开<p style="position:relative;left:45px;top:30px;color:red;">{i}</p>
        mine_div.push(<img src={resolve(__dirname, "theme/closed.png")} style={style_str}><p style={style_center_text}>{i}</p></img>)
      }

    }
    const bios = -10
    return <html>
      <div style={{
        width: x * dm + bios + 'px',
        height: y * dm + bios + 'px',
        background: "transparent",
      }}></div>
      {mine_div}
    </html>
  }
  /**
   * 根据雷图的行和列计算出合适的雷数
   * @param x 行
   * @param y 列
   * @returns 雷数
   */
  getMineNums(x: number, y: number): number {
    const cells = x * y
    const mineNums = cells / 0.6
    return Math.floor(mineNums)
  }
  /**
   * 删除数字前面的0
   * 01，0002 返回 1 2 
   * @param s 
   * @returns string
   */
  remove0(s: String) {
    if(s.length==1){
      return "0"
    }
    s = s.slice(1,)
    if (s.startsWith("0")) {
      return this.remove0(s)
    } else {
      return s
    }
  }
}
namespace EndingGame {


  export interface Config { }

  export const Config: Schema<Config> = Schema.object({})
}


export default EndingGame