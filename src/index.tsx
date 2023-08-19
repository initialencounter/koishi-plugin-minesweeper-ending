import { Context, Schema, Logger, Dict, Session, h } from 'koishi'
import { } from '@koishijs/plugin-adapter-onebot'
import Minefield from "./minesweeper";
import { resolve } from 'path';
export const name = 'minesweeper-ending'
const logger = new Logger(name)

export interface MinesweeperRank {
  id: number
  userId: string
  userName: string
  score: number
  isFlag: boolean
  LastChallenge: number
  ChallengeScore: number
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
  theme: string
  constructor(private ctx: Context, private config: EndingGame.Config) {
    this.theme = this.config.theme
    ctx = ctx.guild()
    // 拓展 Minesweeper 排行榜表
    ctx.model.extend('minesweeper_ending_rank', {
      // 各字段类型
      id: 'unsigned',
      userId: 'string',
      userName: 'string',
      score: 'integer(10)',
      isFlag: 'boolean',
      LastChallenge: 'integer(16)',
      ChallengeScore: "integer(10)"
    }, {
      // 使用自增的主键值
      autoInc: true,
    })
    this.minefieldDict = {}
    ctx.command("fight")
      .alias("挑战模式")
      .action(async ({ session }) => {
        let last = await ctx.model.get('minesweeper_ending_rank', { userId: session.userId })
        const now = new Date().getDate()
        if (last.length === 0) {
          await ctx.model.create('minesweeper_ending_rank', { userId: session.userId, userName: session.username, LastChallenge: now })
        } else {
          if (last[0]?.LastChallenge) {
            if (last[0]?.LastChallenge === now) {
              return "今天已经挑战过了，明天再来吧"
            } else {
              await ctx.model.set('minesweeper_ending_rank', { userId: session.userId }, { LastChallenge: now })
            }
          } else {
            await ctx.model.set('minesweeper_ending_rank', { userId: session.userId }, { LastChallenge: now })
          }
        }
        session.send(h.at(session.userId) + "请准备! 3s 后开始挑战, 输入取消可以放弃挑战")
        await this.sleep(3000)
        const nowStamp = Date.now()
        let m = new Minefield(this.config.widthC, this.config.heightC, this.config.minesC)
        m = this.makePool(m)
        session.send(this.renderX(m, session.userId))
        const cell = await session.prompt(86400000)
        if (!cell) {
          return "挑战失败"
        }
        if (isNaN(Number(cell))) {
          session.send(h.at(session.userId) + "输入不合法，你还有一次机会")
          const cell = await session.prompt(86400000)
          if (isNaN(Number(cell))) {
            return "挑战失败"
          }
        }
        m = await this.findNoGuess(m, cell)
        m = this.makePool(m)
        m["goingOn"] = true
        while (m["goingOn"] == true) {
          m = this.makePool(m)
          session.send(this.renderX(m, session.userId))
          var input = await session.prompt(86400000)
          if (!input) {
            return h.at(session.userId) + "输入超时, 挑战失败"
          }
          if (input.includes("放弃") || input.includes("取消")) {
            m["goingOn"] = false
          } else {
            let s = input
            if (s.startsWith('f')) {
              s = s.slice(1,)
              if (isNaN(Number(s))) {
                session.send("输入序号不合法")
              } else {
                m = this.challengeFl(m, s, session as Session)
              }
            } else if (s.startsWith('s')) {
              s = s.slice(1,)
              if (isNaN(Number(s))) {
                session.send("输入序号不合法")
              } else {
                m = this.challengeNf(m, s, session as Session)
              }
            } else {
              if (isNaN(Number(s))) {
                session.send("输入序号不合法")
              } else {
                const flag = await ctx.model.get('minesweeper_ending_rank', { userId: session.userId })
                if (flag?.[0]?.isFlag) {
                  m = this.challengeFl(m, s, session as Session)
                } else {
                  m = this.challengeNf(m, s, session as Session)
                }
              }
            }
          }
          m = this.makePool(m)
          if (m["keyPool"].length === 0 || m["dgPool"] === 0) {
            break
          }
        }
        if (m["goingOn"]) {
          const completeTime = Date.now()
          const dt: number = completeTime - nowStamp
          await this.updateChallengeRank(ctx, session.userId, session.username, dt)
          return `挑战完成，用时${dt / 1000000}秒`
        } else {
          return "挑战失败"
        }



      })
    ctx.command('flag', '开启或关闭标记模式,仅对自己生效').alias('切换标记模式')
      .action(async ({ session }) => {
        const target = await ctx.model.get('minesweeper_ending_rank', { userId: session.userId }, ["isFlag"])
        if (target.length > 0) {
          await ctx.model.set('minesweeper_ending_rank', { userId: session.userId }, { isFlag: target[0]?.isFlag ? false : true })
          return `已切换为 ${target[0]?.isFlag ? "nf" : "fl"} 模式`
        } else {
          await ctx.database.create('minesweeper_ending_rank', { userId: session.userId, userName: session.username, isFlag: true })
          return '已为您设置为 nf 模式'
        }
      })
    ctx.command("ed [行:number] [列:number] [雷:number]", "开启残局，默认是4*4*6")
      .alias('残局', "minesweeper-ending")
      .option("force", "-f")
      .action(async ({ session, options }, ...args) => {
        const m: Minefield = this.minefieldDict[session.channelId]
        if (options.force) {
          logger.info("强制重开")
        } else if (m?.isGoingOn()) {
          session.send(this.renderX(m, session.userId))
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
    ctx.command("ed.end", "结束 ed").alias('不玩了').action(({ session }) => {
      this.minefieldDict[session.guildId] = null
      return "游戏结束"
    })
    ctx.command("ed.n", "刷新 ed").alias("刷新残局", "重开").action(({ session }) => {
      const m: Minefield = this.minefieldDict[session.channelId]
      if (!m) {
        return "不存在残局"
      }
      return this.renew(session as Session, m.width, m.height, m.mines)
    })
    ctx.command("ed.l", "查看地雷").alias("揭晓").action(({ session }) => {
      let m = this.minefieldDict[session.channelId]
      return this.getHint(m, session as Session)
    })


    /**
     * 二. 开始游戏
     * 1.发送雷图
     * 2.接收玩家的指令，将残局的所有雷标记出来的玩家获胜
     */
    ctx.command("ed.s [numberString:string]", "打开格子").alias("破解", "开", "打开", "破", "open").action(async ({ session, options }, inputString) => {
      let m: Minefield = this.minefieldDict[session.channelId]
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
      const wrong = tmp.filter(function (v) { return m["keyPool"].indexOf(v) == -1 })
      logger.info(`谜底：${m["keyPool"]}`)
      logger.info(`输入：${tmp}`)
      logger.info(`交集: ${c}`)
      logger.info(`开错的：${wrong}`)
      // 打开正确的方块
      for (var s of c) {
        m.openCell(s)
      }
      // 更新 雷 和 空
      m = this.makePool(m)
      const map = this.renderX(m, session.userId)
      await session.send(map)
      // 猜错了
      if (wrong.length > 0) {
        await this.ban(5, session as Session)
        await this.updateRank(ctx, session.userId, session.username, -5)
        return `捣乱的叉出去！${tmp.filter((v) => { return c.indexOf(v) > -1 })}`
      }
      if (m["keyPool"]?.length > 0) {
        // 开不全
        const score = Math.fround(c.length / 2)
        await this.updateRank(ctx, session.userId, session.username, score)
        return `你猜对了${c.length}个,获得 ${score} 点积分喵~`
      } else {
        // 开全了
        this.minefieldDict[session.channelId] = null
        await this.updateRank(ctx, session.userId, session.username, tmp.length)
        return `破解成功！恭喜你喵~ 获得 ${tmp.length * 2} 点积分喵~`
      }
    })
    ctx.command("ed.f [numberString:string]", "标记地雷").alias("标记", "标").action(async ({ session, options }, inputString) => {
      let m: Minefield = this.minefieldDict[session.channelId]
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
      const c = m["dgPool"].filter(function (v) { return tmp.indexOf(v) > -1 })
      const wrong = tmp.filter(function (v) { return m["dgPool"].indexOf(v) == -1 })
      logger.info(`正确的雷：${m["dgPool"]}`)
      logger.info(`输入：${tmp}`)
      logger.info(`交集: ${c}`)
      logger.info(`标错的：${wrong}`)

      // 标出正确的雷
      for (var s of c) {
        m[s]["isFlagged"] = true
      }

      // 更新 雷 和 空
      m = this.makePool(m)
      const map = this.renderX(m, session.userId)
      await session.send(map)

      // 猜错了
      if (wrong.length > 0) {
        await this.ban(5, session as Session)
        await this.updateRank(ctx, session.userId, session.username, -5)
        return `捣乱的叉出去！${tmp.filter((v) => { return c.indexOf(v) > -1 })}`
      }

      // 标不全
      if (m["dgPool"]?.length > 0) {
        const score = Math.fround(c.length / 2)
        await this.updateRank(ctx, session.userId, session.username, score)
        return `你猜对了${c.length}个,获得 ${score} 点积分喵~`
      } else {
        this.minefieldDict[session.channelId] = null
        await this.updateRank(ctx, session.userId, session.username, m["dgPool"].length)
        return `破解成功！恭喜你喵~ 获得 ${tmp.length * 2} 点积分喵~`
      }
    })
    ctx.middleware(async (session, next) => {
      if (!this.minefieldDict[session.channelId]?.isGoingOn()) {
        return next()
      }
      let s = session.content
      if (s.startsWith('f')) {
        s = s.slice(1,)
        if (isNaN(Number(s))) {
          return next()
        }

        return session.execute(`ed.f ${s}`)
      } else if (s.startsWith('s')) {
        s = s.slice(1,)
        if (isNaN(Number(s))) {
          return next()
        }
        return session.execute(`ed.s ${s}`)
      } else {
        if (isNaN(Number(s))) {
          return next()
        }
        const flag = await ctx.model.get('minesweeper_ending_rank', { userId: session.userId })
        if (flag?.[0]?.isFlag) {
          return session.execute(`ed.f ${s}`)
        } else {
          return session.execute(`ed.s ${s}`)
        }
      }

    })

    ctx.command('ed.r', '查看最强扫雷榜单').alias("雷神殿", "雷神榜", "排行榜", "排名")
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

    ctx.command('ed.cr', '查看挑战榜').alias("挑战榜")
      .action(async ({ }) => {
        // 获取游戏信息
        const rankInfo: MinesweeperRank[] = await ctx.model.get('minesweeper_ending_rank', {})
        // 根据score属性进行降序排序
        const tmp = []
        for (var i of rankInfo) {
          if (i.ChallengeScore != 0) {
            tmp.push(i)
          }
        }
        tmp.sort((a, b) => a.ChallengeScore - b.ChallengeScore)
        const table: string = generateRankTable(tmp)
        return table

        // 定义一个函数来生成排行榜的纯文本
        function generateRankTable(rankInfo: MinesweeperRank[]): string {
          // 定义排行榜的模板字符串
          const template = `
挑战榜：
排名  昵称   用时  
--------------------
${rankInfo.map((player, index) => ` ${String(index + 1).padStart(2, ' ')}   ${player.userName.padEnd(6, ' ')} ${player.ChallengeScore.toString().padEnd(4, ' ')}`).join('\n')}
`
          return template
        }
      })

  }


  /**
   * 无猜暴力求解
   * @param m 
   * @param cell 
   * @returns 
   */
  findNoGuess(m: Minefield, cell: string) {
    // 直到找到无猜
    while (!m.isSolvableFrom(cell)) {
      m = new Minefield(m.width, m.height, m.mines)
    }
    m.openCell(cell)
    // 游戏已结束
    if (!m.isGoingOn()) {
      return this.findNoGuess(m, cell)
    }
    return m
  }

  /**
   * 禁言模块
   * @param dt 
   * @param session 
   */
  async ban(dt: number, session: Session) {
    try {
      if (session.platform !== 'onebot') {
        logger.info("该平台不支持禁言")
      } else {
        await session?.onebot.setGroupBan(session.guildId, session.userId, dt)
      }
    } catch (e) {
      logger.info(`禁言用户 ${session.userId} 失败`)
    }

  }


  /**
   * 数据库操作，抄自[koishi-plugin-minesweeper](https://github.com/araea/koishi-plugin-minesweeper)
   * @param ctx 
   * @param userId 
   * @param userName 
   * @param score 
   */
  async updateRank(ctx: Context, userId: string, userName: string, score: number) {
    const rankInfo = await ctx.model.get('minesweeper_ending_rank', { userId: userId })
    if (rankInfo.length === 0) {
      await ctx.model.create('minesweeper_ending_rank', { userId: userId, userName: userName, score: score })
    } else {
      await ctx.model.set('minesweeper_ending_rank', { userId: userId }, { userName: userName, score: rankInfo[0].score + score })
    }
  }


  /**
   * 设置挑战模式分数
   * @param ctx 
   * @param userId 
   * @param userName 
   * @param score 
   */
  async updateChallengeRank(ctx: Context, userId: string, userName: string, score: number) {
    const rankInfo = await ctx.model.get('minesweeper_ending_rank', { userId: userId })
    if (rankInfo.length === 0) {
      await ctx.model.create('minesweeper_ending_rank', { userId: userId, userName: userName, ChallengeScore: score })
    } else {
      await ctx.model.set('minesweeper_ending_rank', { userId: userId }, { userName: userName, ChallengeScore: rankInfo[0].ChallengeScore + score })
    }
  }


  /**
   * 提示模块
   * @param m 
   * @param session 
   * @returns 
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
    return this.renderX(m, session.userId)
  }


  /**
   * 
   * @param m 挑战模式 FL
   * @param inputString 
   * @param session 
   * @returns 
   */
  challengeFl(m: Minefield, inputString: string, session: Session) {
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
    const c = m["dgPool"].filter(function (v) { return tmp.indexOf(v) > -1 })
    const wrong = tmp.filter(function (v) { return m["dgPool"].indexOf(v) == -1 })
    logger.info(`正确的雷：${m["dgPool"]}`)
    logger.info(`输入：${tmp}`)
    logger.info(`交集: ${c}`)
    logger.info(`标错的：${wrong}`)

    if (wrong.length > 0) {
      m["goingOn"] = false
    }
    // 标出正确的雷
    for (var s of c) {
      m[s]["isFlagged"] = true
    }
    return m
  }


  /**
   * 挑战模式 NF
   * @param m 
   * @param inputString 
   * @param session 
   * @returns 
   */
  challengeNf(m: Minefield, inputString: string, session: Session) {
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
    const wrong = tmp.filter(function (v) { return m["keyPool"].indexOf(v) == -1 })
    logger.info(`谜底：${m["keyPool"]}`)
    logger.info(`输入：${tmp}`)
    logger.info(`交集: ${c}`)
    logger.info(`开错的：${wrong}`)

    if (wrong.length > 0) {
      m["goingOn"] = false
    }

    // 打开正确的方块
    for (var s of c) {
      m.openCell(s)
    }
    return m
  }


  /**
   * 睡眠函数
   * @param ms 等待时间
   * @returns 
   */
  sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
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
    let m = new Minefield(x, y, z)
    m = this.findNoGuess(m, "0")
    const cells = x * y

    // 破空
    for (var j: number = 0; j < cells; j++) {
      const s = String(j)
      const cellRecent = m[s]
      if (cellRecent["mines"] == 0) {
        m.openCell(s)
      }
    }
    // 更新 雷 和 空
    m = this.makePool(m)

    this.makeEnding(m)
    return m
  }


  /**
   * 更新 雷 和 空的池子
   * @param m Minefield
   * @returns Minefield
   */
  makePool(m: Minefield) {
    m["keyPool"] = []
    m["dgPool"] = []
    for (var i: number = 0; i < m["cells"]; i++) {
      const s = String(i)
      const cellRecent = m[s]
      if (cellRecent["isMine"]) {
        if (!cellRecent["isFlagged"]) {
          m["dgPool"].push(s)
        }
      } else {
        if (!cellRecent["isOpen"]) {
          m["keyPool"].push(s)
        }
      }

    }
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
    return m
  }


  /**
   * 渲染雷图
   * @param m Minefield
   * @returns 消息
   */
  renderX(m: Minefield, userId: string) {
    let x: number = m.width
    let y: number = m.height
    const dm = 94
    const biox = 15
    const bioy = 70
    const bios = 0
    const mine_div = []
    const head_css = `position: absolute;left: 10px;top: 10px;font-size: 40px`
    mine_div.push(<div style={head_css}>雷数:{m["mines"]}___剩余BV:{m["keyPool"].length} </div>)
    for (var i: number = 0; i < (x * y); i++) {
      const ii = m[String(i)]
      var style_str = `position: absolute;left: ${(i % x) * dm + biox}px;top: ${Math.floor(i / x) * dm + bioy}px`
      var style_center_text = `position: absolute;font-size: ${this.config.FontSizeForSerialNum}px;color: ${this.config.colorForSerialNum};left: ${(i % x) * dm + 28 + biox}px;top: ${Math.floor(i / x) * dm - 18 + bioy}px`
      if (ii["isOpen"]) {
        // 打开
        mine_div.push(<img src={resolve(this.ctx.baseDir, `data/minesweeper/theme/${this.theme}/type${ii["mines"]}.png`)} style={style_str}></img>)
      }
      else if (ii["isFlagged"]) {
        mine_div.push(<img src={resolve(this.ctx.baseDir, `data/minesweeper/theme/${this.theme}/flag.png`)} style={style_str}></img>)
      }
      else {
        // 未打开<p style="position:relative;left:45px;top:30px;color:red;">{i}</p>
        mine_div.push(<img src={resolve(this.ctx.baseDir, `data/minesweeper/theme/${this.theme}/closed.png`)} style={style_str}><p style={style_center_text}>{i < 10 ? "0" + i : i}</p></img>)
      }

    }
    return <><>{h.at(userId)}</><html>
      <div style={{
        width: x * dm + bios + biox + 'px',
        height: y * dm + bios + bioy + 'px',
        background: this.config.BackGroundColor,
      }}></div>
      {mine_div}
    </html>
    </>
  }


  /**
   * 重置游戏
   * @param session 
   * @param x 
   * @param y 
   * @param z 
   * @returns 
   */
  renew(session: Session, x: number = 4, y: number = 4, z: number = 6) {
    let m: Minefield = this.initialize(x, y, z)
    this.minefieldDict[session.channelId] = m
    return this.renderX(m, session.userId)
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

  export const usage = `
## 🎈 介绍

koishi-plugin-minesweeper-ending 是一个基于 Koishi 框架的插件，实现了一个简单扫雷残局。

### 规则

- 残局模式
1. 玩家在群里发送 \`残局\`将开启游戏
2. 使用 \`打开\` 或 \`标记\` 命令，打开BV或标记雷
3. 玩家需要将所有非雷方块打开或者将所有雷标记出来方终结比赛，终结比赛的玩家获得双倍积分
4. 胜利玩家将获得 \`剩余BV*1\` 积分奖励，未能一次性开出所有BV或标记出所有雷的玩家将扣除1积分
5. 标错或开错将受到禁言惩罚, 扣5积分
6. 答不全的玩家获得一半的积分

- 挑战模式
1. 输入 \`fight\` 开启挑战， 玩家每天只能挑战一次
2. 输入 \`挑战榜\` 查看挑战模式排行榜

## 🌠 后续计划

* 🤖 更好的竞技玩法体验
* 🤖 切换扫雷皮肤

## ⚙️ 配置

- 玩法配置
\`MinHintTime: 15000 // 揭晓答案的冷却时间，默认为 15000毫秒\`

\`DifficultyLevel: 0.5 // 残局的难易程度，0-1，0最简单，1最难，默认为 0.5\`

- 主题配置
  - 皮肤 theme: string
    - 插件自带了两种皮肤chcolate皮肤 和 wom皮肤
    - 玩家可以自定义皮肤 在koishi根目录的/data/minesweeper/theme 目录下添加自定义的皮肤，图片要求： 94*94，目录结构保持一致即可
  - 字体颜色 colorForSerialNum: grey
  - 字体大小 FontSizeForSerialNum: 40，(单位px)
  - 背景颜色 BackGroundColor: white

## 🎮 使用

- 请确保你的 koishi 启用了浏览器服务

### 📝 命令

使用以下命令来玩扫雷游戏：

- \`ed|残局\`：开启一局扫雷残局
  - 可选参数 行数 列数 雷数
  - 选项 -f: 强制开启，会把覆盖已存在的残局
- \`ed.s|破解\`：开始扫雷游戏，需要一次性输入序号打开所有的空格
  - 序号必须是连续的，示例：破解 041201141115060107
  - 快捷指令，可以使用 s0412, 该指令等价于 破解 0412
- \`ed.f|标记\`: 输入雷的序号，将所有雷标记出来同样可以获得胜利
  - 快捷指令，可以使用 f0412 , 该指令等价于 标记 0412
- \`flag\`: 开启或关闭标记模式，可以使用 0412 代替 f0412 或 s0412, 取决于当前是否开启标记模式
- \`ed.end|不玩了\`：停止扫雷游戏，会清除当前的游戏状态
- \`ed.l|揭晓\`：获取扫雷所有的答案
- \`ed.n|刷新残局\`：刷新残局
- \`ed.r|雷神殿\`：查看扫雷排行榜，会显示前十名玩家的昵称和积分。成功破解积分+1；破解失败积分-1。

- \`fight\`: 开启挑战
- \`挑战榜\`: 查看挑战模式排行榜

`
  export interface Config {
    MinHintTime: number
    DifficultyLevel: number
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
  export const Config: Schema = Schema.intersect([
    Schema.object({
      MinHintTime: Schema.number().default(15000).description("获取提示的冷却时间"),
      DifficultyLevel: Schema.percent().role('slider').default(0.5).description("难度等级,0最简单，1最难"),
    }).description("玩法设置"),
    Schema.object({
      theme: Schema.string().default('chocolate').description("扫雷的皮肤"),
      colorForSerialNum: Schema.string().default('gray').description("方块序列号的颜色"),
      FontSizeForSerialNum: Schema.number().default(40).description("方块序列号的字体大小"),
      BackGroundColor: Schema.string().default("white").description("背景颜色"),
    }).description("主题设置"),
    Schema.object({
      width: Schema.number().default(4).description("宽度"),
      heigth: Schema.number().default(4).description("高度"),
      mines: Schema.number().default(6).description("雷数"),
    }).description("残局地图设置, 应当使方块数小于100, 否则无法进行游戏操作"),
    Schema.object({
      widthC: Schema.number().default(6).description("宽度"),
      heigthC: Schema.number().default(6).description("高度"),
      minesC: Schema.number().default(15).description("雷数"),
    }).description("挑战模式地图设置, 应当使方块数小于100, 否则无法进行游戏操作")
  ]) 
}


export default EndingGame