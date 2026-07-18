# ROOM/50 — Hackathon Task Board

> 目标：把 ROOM/50 从"提示词生成器"升级为**闭环 harness**——网站发合同，codex 建模，几何 validator 验收，evidence 红绿说话。
> 三条 workstream 按目录隔离，互不碰文件，仅通过两份接口文件对齐。

## 接口契约（开工前 30 分钟三人一起定死，之后不再改）

1. **`agent/scene-brief.schema.json`** — codex 产出的场景描述格式：每个物体 `{id, semanticTag, position[x,z], rotation, bbox[w,d,h]}` + 房间 shell + 座位标记。Builder 写它，validator 读它，**这是全项目唯一的数据总线**。
2. **`validator/report-format.md`** — validation-report.json 的字段：每条检查 `{checkId, status: pass|fail, measured, required, violationGeometry[]}`。validator 写它，网站和 overlay 读它。

接口一定，三人即可完全并行。

---

## 🟦 Ivan — 网站 & 合同层（只动 `index.html` / `app.js` / `llms.txt` / `AGENTS.md` / `agent/*`）

- [ ] **P1 定 schema**：起草 `agent/scene-brief.schema.json`（对齐上面接口 1），发群里定稿
- [ ] **contract 升级 v1.1**：`scene-contract.json` 的 definitionOfDone 加两条——"validation-report.json 全 pass" + "evidence overlay 由 validator 数据生成（非 agent 自报）"
- [ ] **Prompt generator 更新**：生成的 prompt 明确指示 codex 循环协议：build → `npm run validate` → 读 report → 修 → 直到全绿
- [ ] **网站结果区**：页面加一块 validation 面板（读 report JSON 渲染红绿清单），部署 Netlify
- [ ] **发现层**：llms.txt / .well-known/agent.json 补上 validator 与 report 的入口；AGENT.md 与 AGENTS.md 合并留一份

## 🟩 Chloe — Validator 核心（只动 `validator/*`，新目录）

- [ ] **P0 几何检查器**（读 scene-brief.json，纯计算无渲染）：
  - `routeWidth`：entrance→order→pickup→accessible-seat→WC 连续路线，对家具 bbox 做通道扫描，最窄处 ≥1.2m，输出瓶颈坐标
  - `turningZones`：entrance/counter/WC 三处 Ø1.5m 圆无碰撞
  - `counterHeight`：矮段 ≤0.76m；`kneeClearance`：无障碍桌净空 ≥0.7m
  - `seatCount`：14–18（优先级低于 clearance，fail 时标 warning 而非 error）
  - `boundary`：所有物体在 10×5m shell 内、无互相穿模
- [ ] **CLI**：`npm run validate -- path/to/scene-brief.json` → 输出 `validation-report.json`（对齐接口 2）+ 终端红绿摘要
- [ ] **fixtures**：`validator/fixtures/` 放两份手写 brief——`fail.json`（B3 桌把路线挤到 1.05m）和 `pass.json`，单测跑通。这两份也是 demo 剧本的道具
- [ ] （有余力）violationGeometry 里给 overlay 用的线段/圆数据

## 🟨 Gogo — 好看层 & Demo（只动 `kit/*` / `demo/*`，新目录）

- [ ] **P2 style kit**：`kit/style-presets.js` — 材质（木地板/亚麻/陶土布艺程序纹理）、灯光 rig（暖阳 + 补光 + 夜晚模式）、两套配色 preset；参考 interior-demo.html 的配方
- [ ] **`kit/starter-scene.js`**：读 scene-brief.json 自动摆家具 + 套 style preset 的渲染器——codex 只需产 brief，好看由 kit 保证下限；含 Perspective/Top/Accessibility 三视图切换
- [ ] **overlay 渲染**：读 validation-report 的 violationGeometry，画红/绿路线与回转圈（evidence view）
- [ ] **P3 demo 剧本**：`demo/script.md` — 上传参考图 → 生成 prompt → codex 建模 → validator 报 1.05m fail → codex 挪桌牺牲一个座位（seats 优先级低于 clearance 的取舍瞬间 = 灵魂镜头）→ 全绿 → Netlify 真 URL 收尾
- [ ] **兜底**：全流程录屏一版；预烤 fail→pass 的两份 brief 渲染截图

---

## 时间线（build 10:30–16:30，午休 13:00–14:00）

| 时刻 | 里程碑 |
|---|---|
| 10:30–11:00 | 三人定死两份接口文件（schema + report format） |
| 12:30 | Gogo: fixtures 上 validator 跑通；Chloe: starter-scene 渲出第一帧；Ivan: prompt + 面板骨架 |
| 14:00 | **集成点 1**：codex 真跑一轮 build→validate 循环 |
| 15:30 | **功能冻结**，只做 demo 彩排 + 录兜底 |
| 16:30 | Demos |

## 一句话 pitch

> The website hands the agent a contract. When the agent delivers, **geometry decides — not the agent's word.**
> CI tests logic. ROOM/50 validates space.
