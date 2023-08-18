# koishi-plugin-minesweeper-ending

[![npm](https://img.shields.io/npm/v/koishi-plugin-minesweeper-ending?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-minesweeper-ending)


## 🎈 介绍

koishi-plugin-minesweeper-ending 是一个基于 Koishi 框架的插件，实现了一个简单无猜竞速扫雷。

## 🚀 特性

- 开始、停止、重新开始扫雷残局
- 获取扫雷最终答案
- 查看扫雷排行榜
- 设置扫雷难度

## 🌠 后续计划

* 🤖 更好的竞技玩法体验
* 🤖 切换扫雷皮肤

## 📦 安装

```
前往 Koishi 插件市场添加该插件即可
```

## ⚙️ 配置

\`MinHintTime: 15000 // 揭晓答案的冷却时间，默认为 15000毫秒\`

\`DifficultyLevel: 0.5 // 残局的难易程度，0-1，0最简单，1最难，默认为 0.5\`

## 🎮 使用

- 请确保你的 koishi 启用了浏览器服务

### 📝 命令

使用以下命令来玩扫雷游戏：

- `ed|残局`：开启一局扫雷残局
- `ed.s|破解`：开始扫雷游戏，需要一次性输入序号打开所有的空格
  - 序号必须是连续的，示例：破解 041201141115060107
- `ed.end|不玩了`：停止扫雷游戏，会清除当前的游戏状态
- `ed.l|揭晓`：获取扫雷所有的答案
- `ed.n|刷新残局`：刷新残局
- `ed.r|雷神殿`：查看扫雷排行榜，会显示前十名玩家的昵称和积分。成功破解积分+1；破解失败积分-1。

## 🙏 致谢

* [Koishi](https://koishi.chat/)：机器人框架
* [@zwolfrost/minesweeper.js](https://github.com/zWolfrost/minesweeper.js)：JS 扫雷引擎
* [minesweeper.online](https://minesweeper.online/): 扫雷皮肤来自于这个网站
* [koishi-plugin-minesweeper](https://github.com/araea/koishi-plugin-minesweeper): 直接抄了一个排行榜和 README

## 📄 License

MIT License © 2023

本插件遵循 MIT 协议。

希望你喜欢这个插件，并享受扫雷游戏的乐趣。😄
