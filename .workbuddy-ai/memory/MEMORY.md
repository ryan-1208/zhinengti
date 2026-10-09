# 项目长期记忆

## 工具与流程约定

### 原型页面验证：Chrome headless（agent-browser 未安装时）

本机未安装 `agent-browser`，但 `/Applications/Google Chrome.app` 可用。用它逐个验证原型 hash 页面：

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --no-sandbox --no-first-run --disable-extensions \
  --hide-scrollbars --user-data-dir=/tmp/cc-$p --virtual-time-budget=6000 \
  --window-size=1440,900 --screenshot=/tmp/shot-$p.png \
  "http://localhost:51720/prototypes/<name>#page=$p" >/dev/null 2>&1 &
```

两个必须注意的点：

1. **Chrome headless 不会自行退出**，`--virtual-time-budget` 只控制渲染时长。直接前台调用会一直挂住（曾挂 7 分钟）。必须后台启动 + `for i in $(seq 1 10); do sleep 1; ... done` 轮询后 `kill -9`。
2. 用 `--dump-dom` 替代 `--screenshot` 可拿到渲染后的 DOM，用于断言页面关键字是否出现（判断有无运行时崩溃），比截图更省 token。

Chrome 退出时会打印 `code_sign_clone ... file-write-unlink` 的沙箱告警，与结果无关，可忽略。

### 精确视口与交互验证：用 CDP，不要用 `--window-size` 反推

`--window-size=1440,900` 得到的 `window.innerHeight` 实测是 **757**，不是 900（差 143px 来自浏览器 UI）。用它判断「页面是否溢出」「导航是否在首屏内」会得出错误结论——曾据此差点误判行为监控页溢出。

要精确视口，用 CDP + `Emulation.setDeviceMetricsOverride`：

```js
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
```

**无需任何依赖**：Node 22 自带全局 `WebSocket` 和 `fetch`。启动 `--headless=new --remote-debugging-port=<port> --user-data-dir=/tmp/xxx`，然后 `fetch('http://127.0.0.1:<port>/json/list')` 取 `webSocketDebuggerUrl`，连上后 `Runtime.evaluate` 即可取值或触发点击。这套方式能验证交互（点按钮、读 `location.hash`、读 `localStorage`），是截图和 `--dump-dom` 做不到的。

**必须加 `--remote-allow-origins=*`**。Chrome 111+ 会拒绝带 `Origin` 头的 DevTools WebSocket 连接；不加这个 flag 时连接被立刻关闭，而 `send()` 的 promise 永不结算，表现为 Node 只打印一句 `Warning: Detected unsettled top-level await at ...`，看不出真实原因。同时要给 `ws.onclose` 和每个请求加超时，否则失败完全是静默的。

**冻结动画后截图**是核对「色块是否对齐轨道 / 动画相位」这类问题的好办法：注入 `*,*::before,*::after{animation-play-state:paused!important}`，元素会停在当前相位，再用 `Page.captureScreenshot` 的 `clip` + `scale:2` 放大局部，配合 `Runtime.evaluate` 读 `getComputedStyle(...).transform` 取到具体位移值作为文字证据。可复用脚本在项目内：`temp/cdp-shot.mjs`，用法 `node temp/cdp-shot.mjs <url> <outPrefix> [clipSelector] [waitMs]`，会打印一行 `METRICS`（视口、SVG 缩放、轨道与料箱几何、动画时长与延迟）并输出整页图 + 局部放大图。

### 测量版式溢出：先量再改，不要通读 CSS 猜

`temp/cdp-measure.mjs` 打印 `docScrollHeight`、`overflowPx` 与每个选择器的 top/bottom/height：

```bash
node temp/cdp-measure.mjs "http://localhost:51720/prototypes/<name>#page=<id>" 1440 900 [selector...]
```

定位「哪一块把页面撑高了」比通读 CSS 快得多。已实测出的典型陷阱：运营驾驶舱的溢出根因不是内容多，而是 `.cc-body` 的 `grid-template-areas` 让 `hero` 跨两行，被右列（进度表 579px + 两张图表 499px）撑到 **1088px**，连带 `.cc-op-zone-card` 被拉到 **990px** 的空高——只改卡片自身高度是没用的，行高由同行的最高单元格决定。

### 读取超大 HTML / 导出文档

Read 工具对超过 **256KB** 的文件直接拒绝（`exceeds maximum allowed size`），逐段 offset 读又很费 token。对体积大但结构简单的 HTML（流程图、导出文档），用 `temp/extract-html-text.py` 一次抽出可见文本：

```bash
/Users/xiaoyang/.workbuddy-ai/binaries/python/versions/3.13.12/bin/python3 temp/extract-html-text.py <file.html>
```

做法：先剥掉 `<script>/<style>`（绘图库与内嵌数据都在里面，是可读性的主要噪声），再把块级标签转成换行、丢弃其余标签、合并相邻短碎片。776KB 的流程图用它能一次输出 184 行全文。

### grep 的 `\|` 交替在 zsh 下不可靠

`grep -n "A\|B" file` 在本机 shell 里**实测会漏匹配**（单模式 grep 正常）。需要交替匹配时改用 Grep 工具，或拆成多次单模式 grep。

### 状态同步类改动的验证清单

改「两端联动」逻辑后，至少验证四条路径：① 控制端操作后自身是否被带跑；② 无 hash 新开窗口是否采纳对端状态；③ URL 显式指定页面时是否被劫持；④ 对端变化时本端是否跟随。只测一条会漏掉回归。

### Edit 工具：同一消息内并行多次 Edit 会丢改动

同一 assistant 消息里放多个 Edit 调用时，实测只有最后一次生效，其余静默丢失（工具仍返回 success）。修改同一文件的多处时，必须**逐条串行**调用并复查文件内容。

### 主规格 spec.html 会被 Make 批注工具实时改写

`.spec/spec.html` 在预览/批注过程中会被写入 `data-page-node-id="..."` 属性。再次编辑前必须先 Read 或 Grep 取当前内容，不能沿用自己上次写入的原文作为 old_string。

## 项目事实

- 原型验收命令：`node scripts/check-app-ready.mjs /prototypes/<name>`；输出里的 `serverUrl` 是给用户的预览链接，默认 `http://localhost:53817/?projectId=make-project-20260730&p=<name>`。
- 本项目无 eslint 配置，`lint` 检查恒为 SKIPPED，以 typecheck + build 为准。
- 多页面原型用 `src/common/useHashPage.ts`，URL 为 `#page=<id>`。

## 原型：customer-cockpit-requirements（客户驾驶舱需求）

- 视觉沿用深蓝 + 青色大屏风格，未引用 `src/themes/` 下的 DESIGN.md；新增页面统一用 `cc-` 前缀类名，与原「食堂驾驶舱」的 `dt-` 类名隔离。
- 页面（2026-09-23 起）：`operations`（默认，运营驾驶舱）/ `behavior` / `control`（iPad 控制页）/ `cockpit`（原有生产驾驶舱，逻辑零改动）。
- **暂时下线**（页面文件保留在 `pages/` 下，取消注释即可恢复）：`overview` 厨房总览、`process` 无人烹饪流程、`equipment` 核心设备与能力。下线时 `HOME_PAGE_ID` 与 `defaultPageId` 必须同步改为 `operations`，否则首页指向不存在的页。
- 大屏与 iPad 控制页通过 `components/displaySync.ts` 的 localStorage + 自定义事件联动；同浏览器模拟不构成跨设备联动验收。
- 同步语义（`index.tsx` 的 effect）：`control`/`cockpit` 自身不参与跟随；`lastSyncedPageId` 用 `null` 表示未同步过以支持首次采纳；`urlPageSpecified` 保证 URL 显式指定页面时不被控制端改写。**改动这段前先看 `rules/` 无相关约束，但要重跑上面那四条验证路径。**
- 数据口径：演示数据必须显式标注；客户／项目名称用「待确认」占位；缺失值用「—」不填零；相对时间由时间戳计算。
- **运营驾驶舱已压缩为 16:9 单屏**（2026-09-29，用户选择「压缩到单屏」）：实测 1440×900 / 1920×1080 / 2560×1440 溢出均为 0；1366×768 溢出 131px，为滚动降级。改动只在 `style.css` 的 `.cc-cockpit-screen` 段，`index.tsx` 未动，行为监控与 iPad 控制页无回归。底部导航已 `position:sticky` 吸底。
- 评审报告在 `.spec/reviews/`：`prototype-review.md`（业务，2026-09-29 重跑 score **67**，2 P1 + 3 P2）、`ui-review.md`（UI，2026-09-29 重跑 score **65**，3 P1 + 2 P2）。上一版（68 / 66）归档在 `temp/reviews-archive-2026-09-29/`。
- **已知未决（2026-09-29 评审，均未动手修，多数需口径/范围决策）**：
  - P1 运营驾驶舱（默认首页）数据口径不自洽——顶部条 12/2/2 与表格 8 行矛盾、出成率 92% vs 柱状图 61%、趋势图折线与圆点用两套坐标（点不在线上）。`OperationsDashboard.tsx`，非本轮改动引入，是此前评审的覆盖盲区。
  - P1 运营驾驶舱正文压到 9.5–11.5px（1920×1080 下 44% 文本 <12px），是单屏压缩「缩字号换高度」的代价；评审建议改走「削模块」。
  - P1 三处对比度硬失败：`.cc-op-zone-image span` 1.85:1、激活页签 2.34–4.21:1、`.cc-op-progress-banner .unfinished` 3.30:1。
  - P1 ≤1250px 内容消失：`.cc-op-station-row em` 在 1180/1024 下 `clientWidth=0`；`.cc-brand h1` 与 `.cc-project` 重叠 15px（从声明的 `min-width:1180px` 起就发生）。
  - P2 行为监控在 1440×900 仍溢出 56px（只有 1920×1080 是 0），与运营驾驶舱单屏口径不一致。
  - P2 iPad 控制页 `.cc-control-frame` 恒 540×884，1180×820 溢出 104px；`style.css:181` 的 `place-items:center` 使 `:182` 的 `max-width:100%` 失效。
- 评审方法论：`rules/review-common-guide.md` 要求「未参与实现的子代理独立审查」，且领域指南各定义**两个互不干扰的视角**（原型=业务基线/原型证据；UI=设计/证据）。重跑时拆 4 个子代理并行、各自完成前不暴露结论，主代理核实证据+剔误报后合并。实测证明这能捞到此前单视角漏掉的问题（如首页数据口径）。

### 版式陷阱：`fr` 行 + 内部 `flex:1` 会互相放大（运营驾驶舱实测）

想让面板随视口长高，用了 `grid-template-rows:auto auto 1.32fr 1fr auto`——结果 1440×900 从「刚好放下」变成溢出 43px。根因不是内容变多：面板内部的 `flex:1`（如 `.cc-op-zone-grid`）会把该网格的 **max-content** 撑大，而 `fr` 轨道在内在尺寸计算里按 **max-content** 计入父级 min-content，于是 `.cc-body` 的 min-content 被抬到 701px，超过可用的 658px，`.cc-screen` 被顶到 943px。

试过且**无效**的补救：`min-height:0`、`minmax(min-content,1fr)`、`align-content:start`、去掉 `flex:1` 的 `min-height:0`。有效的是把弹性行改回 `auto`（实验：仅行 3 改回 auto，min-content 立刻从 701 回落到 662）。

**结论：这类「按内容高度排版、刚好占满一屏」的驾驶舱布局，不要用 `fr` 行去填高视口，改用 `align-content:center` 把整块内容居中。**

### 视口实测必须走 CDP，且必须复用外部 Chrome

- 取溢出必须用 `Emulation.setDeviceMetricsOverride`：`--window-size=1440,900` 得到的 `innerHeight` 只有 757px，会得出完全错误的结论。
- **沙箱内 spawn 出来的 Chrome 会被杀**，表现为 `Error: WS 关闭(code=1006)，请求 #1 未完成`。做法：先在沙箱外起一个常驻 headless Chrome（`--headless=new --remote-debugging-port=9799 --user-data-dir=/tmp/cc-master --hide-scrollbars --remote-allow-origins='*'`），脚本里读 `CDP_PORT` 复用；`--remote-allow-origins=*` 是必需的，否则 Chrome 111+ 会拒掉带 Origin 头的 DevTools 连接。
- 解析脚本输出时不要用 `json.loads(整个 stdout)`：沙箱提示行会混进来。用 `json.JSONDecoder().raw_decode(raw[raw.index('{'):])`。
- zsh 不做无引号变量展开的单词切分：`for WH in "1440 900"; do set -- $WH` 里 `$1` 会是整个 `"1440 900"`，导致 `Number("1440 900")=NaN`、CDP 报 `int32 value expected`。用显式参数或 `${=WH}`。

## 原型：customer-cockpit-requirements-2（客户驾驶舱需求 2）

存在**第二个**客户驾驶舱原型 `src/prototypes/customer-cockpit-requirements-2/`（注意 `-2` 后缀），与上面的 `customer-cockpit-requirements` 是两套独立实现，类名前缀为 `uk-`（上面那个是 `cc-`）。

- 它的「产线实时动线」SVG（`index.tsx:157-229`）画的是投料区 / 烹饪区 / 出餐区三段动线。设备编号规律：**CCJ = 炒菜机、KXJ = 烤箱、JXB = 机械臂**。
- 设备与状态数据在 `index.tsx:30-37`（`MACHINES`：炒菜机 CCJ1–4 + 烤箱 KXJ1–2）。**2026-09-23 已全面对齐 PRD**：`Machine` 类型由 `{id,dish,left,progress,color}` 改为 `{id,dish,state,color}`，`state` 取 `'烹饪中' | '待出餐'`；剩余时间、进度百分比、台数、自动累加计数与扫描线动画全部移除（PRD:189 禁虚构百分比/批次/剩余时间，PRD:131 不默认增加直播，AC08 演示数据不显式标注即不可用）。出餐量改为静态快照 `SERVED = 3182`。
- 现在 `演示` 出现 24 次、`实时` 仅 2 次；`.uk-mode.is-demo`、`.uk-tag-demo`、`.uk-camera-tag.is-demo`、`.uk-mon-tag.is-demo` 承载演示标识。若要交付客户，先跑一遍 PRD:32/111/129/131/189 这几条硬规则的对照。

- 「产线实时动线」的动画几何（2026-09-23 修）：轨道在 **y=162**，即炒菜机（96–148）与烤箱（176–224）之间净空带的中线——炒菜机高度为此由 60 收到 **52**、标签 y 122；在途料箱 **2 个**、统一 `y=151` 高 22（中心 162）；投料区待取料箱 `y=142`；机械臂中心 162（rect y 132、circle cy 124）。`.uk-box-move` 用 30s 走完 `translateX 120 → 740`，延迟 `i * -15s`（负延迟），对应面板节拍「15 秒/趟」。**改这些数值时三处必须一起动**（SVG 坐标 / `@keyframes uk-move` / `.uk-rail-glow` 速度），否则又会出现料箱压设备或动画速度与节拍数字不符。
- **PRD 合规状态（2026-09-23 全面对齐，已修复）**：此前的四处冲突已闭环——补上演示标识（`.uk-mode.is-demo` 等）、标题去「实时」（改「流程演示」「画面示意」「出餐记录」）、删除虚构的剩余时间/完成百分比、设备数量改「待确认」。产线节拍「15 秒/趟」保留为流程说明并标注。若后续再改这个变体，重跑 PRD:32（未接入不显示为实时）/111（数量未知不显示数量）/129+AC08（演示数据显式标注）/131（不默认增加直播）/189（不显示虚构百分比、批次、剩余时间）五条对照。
