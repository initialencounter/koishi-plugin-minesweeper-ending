import { Context, Schema, Logger, Dict, Session } from 'koishi'
import Minefield from "./minesweeper";
import { resolve } from 'path';
export const name = 'minesweeper-ending'
const logger = new Logger(name)

export interface MinesweeperRank {
  id: number
  userId: string
  userName: string
  score: number
}
// TypeScript 用户需要进行类型合并
declare module 'koishi' {
  interface Tables {
    minesweeper_ending_rank: MinesweeperRank
  }
}

class EndingGame {
  static using = ['puppeteer']
  minefieldDict: Dict
  mineNum: number
  constructor(private ctx: Context, private config: EndingGame.Config) {

    ctx = ctx.guild()
    // 拓展 Minesweeper 排行榜表
    ctx.model.extend('minesweeper_ending_rank', {
      // 各字段类型
      id: 'unsigned',
      userId: 'string',
      userName: 'string',
      score: 'integer',
    }, {
      // 使用自增的主键值
      autoInc: true,
    })
    this.minefieldDict = {}
    ctx.command("ed [行:number] [列:number] [雷:number]", "开启一个 minesweeper-ending").alias('残局', "minesweeper-ending").action(({ session }, ...args) => {
      const m: Minefield = this.minefieldDict[session.channelId]
      if (m?.isGoingOn()) {
        session.send(this.renderX(m))
        return "已存在残局"
      }
      let x: number
      let y: number
      let z: number
      if (args[0] && args[1]) {
        if (args[0] * args[1] > 99) {
          return "图太大了, 格子数应当小于100"
        }
        if (args[0] * args[1] < 9) {
          return "图太小了, bv数应当大于9"
        }
        x = args[0]
        y = args[1]
      }
      if (x && y && args[2]) {
        if (x * y < args[2]) {
          return "雷比格子多"
        }
        z = args[2]
      } else {
        if (x && y && !args[2]) {
          z = this.getMineNums(x, y)
        }
      }
      return this.renew(session as Session, x, y, z)
    })
    ctx.command("ed.end", "结束 minesweeper-ending").alias('不玩了').action(({ session }) => {
      this.minefieldDict[session.guildId] = null
      return "游戏结束"
    })
    ctx.command("ed.n", "刷新 minesweeper-ending").alias("刷新残局").action(({ session }) => {
      const m: Minefield = this.minefieldDict[session.channelId]
      if (!m) {
        return "不存在残局"
      }
      return this.renew(session as Session, m.width, m.height, m.mines)
    })
    ctx.command("ed.l", "查看 minesweeper-ending 的答案").alias("揭晓").action(({ session }) => {
      let m = this.minefieldDict[session.channelId]
      return this.getHint(m, session as Session)
    })
    ctx.command('ed.r', '查看最强扫雷榜单').alias("雷神殿")
      .action(async ({ }) => {
        // 获取游戏信息
        const rankInfo: MinesweeperRank[] = await ctx.model.get('minesweeper_ending_rank', {})
        // 根据score属性进行降序排序
        rankInfo.sort((a, b) => b.score - a.score)
        // 只保留前十名玩家，并生成排行榜的纯文本
        const table: string = generateRankTable(rankInfo.slice(0, 10))
        return table

        // 定义一个函数来生成排行榜的纯文本
        function generateRankTable(rankInfo: MinesweeperRank[]): string {
          // 定义排行榜的模板字符串
          const template = `
雷神殿：
 排名  昵称   积分  
--------------------
${rankInfo.map((player, index) => ` ${String(index + 1).padStart(2, ' ')}   ${player.userName.padEnd(6, ' ')} ${player.score.toString().padEnd(4, ' ')}`).join('\n')}
`
          return template
        }
      })

    /**
     * 二. 开始游戏
     * 1.发送雷图
     * 2.接收玩家的指令，将残局的所有雷标记出来的玩家获胜
     */
    ctx.command("ed.s [numberString:string]", "破解 minesweeper-ending").alias("破解").action(async ({ session, options }, inputString) => {
      const m: Minefield = this.minefieldDict[session.channelId]
      if (!m?.isGoingOn()) {
        return "不存在残局"
      }
      const tmp = []
      for (let i = 0; i < inputString.length; i += 2) {
        let pair = inputString.slice(i, i + 2);
        if (pair.startsWith("0")) {
          pair = this.remove0(pair)
        }
        // 清洗后的 cellId
        if (pair) {
          tmp.push(pair)
        }
      }
      const c = m["keyPool"].filter(function (v) { return tmp.indexOf(v) > -1 })
      logger.info(`谜底：${m["keyPool"]}`)
      logger.info(`输入：${tmp}`)
      logger.info(`交集: ${c}`)
      if (c.length < m["keyPool"].length) {
        await this.updateRank(ctx, session.userId, session.username, -1)
        return `破解失败，你猜对了${c.length}个,扣除 1 点积分喵~`
      } else {
        this.minefieldDict[session.channelId] = null
        await this.updateRank(ctx, session.userId, session.username, 1)
        return "破解成功！恭喜你喵~ 获得 1 点积分喵~"
      }
    })

  }

  async updateRank(ctx: Context, userId: string, userName: string, score: number) {
    const rankInfo = await ctx.model.get('minesweeper_ending_rank', { userId: userId })
    if (rankInfo.length === 0) {
      await ctx.model.create('minesweeper_ending_rank', { userId: userId, userName: userName, score: score })
    } else {
      await ctx.model.set('minesweeper_ending_rank', { userId: userId }, { userName: userName, score: rankInfo[0].score + score })
    }
  }
  /**
   * 提示模块
   */
  getHint(m: Minefield, session: Session) {
    if (!m.isGoingOn()) return "不存在残局"
    const now = Date.now()
    if (now - m.start_time < this.config.MinHintTime) {
      return `${(this.config.MinHintTime + m.start_time - now) / 1000}秒后才能揭晓`
    }
    for (var i of m["keyPool"]) {
      m.openCell(i)
    }
    return this.renderX(m)
  }

  /**
   * 一.初始化，生成一个小的残局
   * 1.破空(就是打开所有雷数为0的格子)
   * 2.随机打开不为雷的格子
   * @param x 行
   * @param y 列
   * @param z 雷
   */
  initialize(x: number = 4, y: number = 4, z: number = 6): Minefield {
    this.mineNum = z
    const m = new Minefield(x, y, z)
    const cells = x * y
    m["keyPool"] = []
    m["dgPool"] = []
    // 破空
    for (var j: number = 0; j < cells; j++) {
      const s = String(j)
      const cellRecent = m[s]
      if (cellRecent["mines"] == 0) {
        m.openCell(s)
      }
    }
    // 分离BV 和 雷
    for (var i: number = 0; i < cells; i++) {
      const s = String(i)
      const cellRecent = m[s]
      if (cellRecent["isMine"]) {
        m["dgPool"].push(s)
      }
      if (!cellRecent["isMine"] && !cellRecent["isOpen"]) {
        m["keyPool"].push(s)
      }
    }
    this.makeEnding(m)
    return m
  }
  /**
   * random openCell
   */
  makeEnding(m: Minefield) {
    let openCount = 0
    let flagCount = 0
    const keyLength = m["keyPool"].length
    const dangerLength = m["dgPool"].length
    while (openCount < ((1 - this.config.DifficultyLevel) * keyLength)) {
      const randomNum = Math.floor(Math.random() * m["keyPool"].length)
      const cell = m["keyPool"][randomNum]
      m["keyPool"].splice(randomNum, 1)
      m.openCell(cell)
      openCount++
    }
    while (flagCount < (this.config.DifficultyLevel * dangerLength * 0.6)) {
      const randomNumD = Math.floor(Math.random() * m["dgPool"].length)
      const cell = m["dgPool"][randomNumD]
      m["dgPool"].splice(randomNumD, 1)
      m[cell]["isFlagged"] = true
      flagCount++
    }
  }
  /**
   * 渲染雷图
   * @param m Minefield
   * @returns 消息
   */
  renderX(m: Minefield) {
    let x: number = m.width
    let y: number = m.height
    const dm = 94
    const biox = 15
    const bioy = 70
    const bios = 0
    const mine_div = []
    const head_css = `position: absolute;left: 10px;top: 10px;font-size: 40px`
    mine_div.push(<div style={head_css}>雷数:{this.mineNum}___剩余BV:{m["keyPool"].length} </div>)
    for (var i: number = 0; i < (x * y); i++) {
      const ii = m[String(i)]
      var style_str = `position: absolute;left: ${(i % x) * dm + biox}px;top: ${Math.floor(i / x) * dm + bioy}px`
      var style_center_text = `position: absolute;font-size: 40px;left: ${(i % x) * dm + 45 + biox}px;top: ${Math.floor(i / x) * dm + bioy}px`
      if (ii["isOpen"]) {
        // 打开
        if (ii["mines"] == 0) {
          mine_div.push(<img src={resolve(__dirname, "theme/type0.png")} style={style_str}></img>)
        } else {
          mine_div.push(<img src={resolve(__dirname, `theme/type${ii["mines"]}.png`)} style={style_str}></img>)
        }
      }
      else if (ii["isFlagged"]) {
        mine_div.push(<img src={resolve(__dirname, "theme/flag.png")} style={style_str}></img>)
      }
      else {
        // 未打开<p style="position:relative;left:45px;top:30px;color:red;">{i}</p>
        mine_div.push(<img src={resolve(__dirname, "theme/closed.png")} style={style_str}><p style={style_center_text}>{i < 10 ? "0" + i : i}</p></img>)
      }

    }
    return <html>
      <div style={{
        width: x * dm + bios + biox + 'px',
        height: y * dm + bios + bioy + 'px',
        background: "transparent",
      }}></div>
      {mine_div}
    </html>
  }
  /**
   * 重置游戏
   */
  renew(session: Session, x: number = 4, y: number = 4, z: number = 6) {
    const m: Minefield = this.initialize(x, y, z)
    this.minefieldDict[session.channelId] = m
    return this.renderX(m)
  }
  /**
   * 根据雷图的行和列计算出合适的雷数
   * @param x 行
   * @param y 列
   * @returns 雷数
   */
  getMineNums(x: number, y: number): number {
    const cells = x * y
    const mineNums = cells * 0.40
    return Math.floor(mineNums)
  }
  /**
   * 删除数字前面的0
   * 01，0002 返回 1 2 
   * @param s 
   * @returns string
   */
  remove0(s: String) {
    if (s.length == 1) {
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

  export const usage =`
## 🌠 后续计划

* 🤖 更好的竞技玩法体验
* 🤖 切换扫雷皮肤

 ## ⚙️ 配置
\`MinHintTime: 15000 // 揭晓答案的冷却时间，默认为 15000毫秒\`

\`DifficultyLevel: 0.5 // 残局的难易程度，0-1，0最简单，1最难，默认为 0.5\`

## 🎮 使用

- 请确保你的 koishi 启用了浏览器服务

### 📝 命令

使用以下命令来玩扫雷游戏：

- \`ed|残局\`：开启一局扫雷残局
- \`ed.s|破解\`：开始扫雷游戏，需要一次性输入序号打开所有的空格
  - 序号必须是连续的，示例：破解 041201141115060107
- \`ed.end|不玩了\`：停止扫雷游戏，会清除当前的游戏状态
- \`ed.l|揭晓\`：获取扫雷所有的答案
- \`ed.n|刷新残局\`：刷新残局
- \`ed.r|雷神殿\`：查看扫雷排行榜，会显示前十名玩家的昵称和积分。成功破解积分+1；破解失败积分-1。
`
  export interface Config {
    MinHintTime: number
    DifficultyLevel: number
  }

  export const Config: Schema<Config> = Schema.object({
    MinHintTime: Schema.number().default(15000).description("获取提示的冷却时间"),
    DifficultyLevel: Schema.percent().role('slider').default(0.5).description("难度等级,0最简单，1最难")
  })
}


export default EndingGame