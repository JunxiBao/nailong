# 奶龙消消乐：大肚肚美食派对 (Nailong Match-3 Pixel Edition)

一款基于 TypeScript + Vite + HTML5 Canvas + Web Audio API 打造的复古像素风《开心消消乐》式三消闯关游戏。

## 核心特色

- **高精度 3D-SDF 像素角色与棋子**：包含奶龙、暴暴龙、小七动态像素模型及 6+1 种立体三消棋子、96×96 像素表情图鉴。
- **经典消消乐特效体系**：支持 3 连消除、4 连烈焰条纹、T/L 型肚皮爆炸包、5 连百变彩虹奶龙，以及全部 6 种双特效相邻互换清屏大招。
- **10 大闯关关卡 + 无尽干饭模式**：涵盖收集、单/双层破冰、碎木箱、解锁链，以及第 5、10 关【暴暴龙 Boss 战】，搭配奶龙【2吨大肚肚泰山压顶】主动技与小七 4 大道具。
- **全屏响应式适配**：完美适配桌面端与移动端全屏触控滑动（零上下滚动干扰），内置 8-bit 解压音效合成器。

## 本地运行与测试

```bash
# 安装依赖
npm install

# 启动本地开发服务器
npm run dev

# 运行单元测试
npm test

# 构建生产包 (输出至 dist/)
npm run build
```

## Cloudflare Pages 部署配置

- **Framework preset**: `Vite`
- **Build command**: `npm run build`
- **Build output directory**: `dist`
