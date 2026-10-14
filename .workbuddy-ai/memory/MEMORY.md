# 项目长期记忆

## 验证与调试约定（先看这里）

- **视口/溢出必须用 CDP**。`--window-size=1440,900` 得到的 `innerHeight` 实测只有 757，据此判断溢出会得出错误结论；要用 `Emulation.setDeviceMetricsOverride`。
- **必须复用外部常驻 Chrome**。沙箱内 spawn 的 Chrome 会被杀（表现为 `WS 关闭 code=1006`）。先起常驻 headless（`--headless=new --remote-debugging-port=9799 --user-data-dir=/tmp/cc-xxx --hide-scrollbars --remote-allow-origins='*'`），脚本读 `CDP_PORT` 复用。`--remote-allow-origins=*` 必需，否则 Chrome 111+ 拒掉带 Origin 头的 DevTools 连接，且失败是静默的（只打印 `unsettled top-level await`）——务必给 `ws.onclose` 和每个请求加超时。
- 本机 Chrome：`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`。agent-browser 的 Chrome 在 `~/.agent-browser/browsers/chrome-<ver>/Google Chrome for Testing.app/Contents/MacOS/`（**没有** `chrome-mac-arm64` 这一层）。
- **点击要用 `MouseEvent` 派发**，`el.click()` 在部分场景不触发 React 合成事件。**别用 `textContent` 定位含受控 `<input>` 的容器**——值在 `value` 里、`textContent` 是空的，曾据此误判「页面切换失效」。
- 改受控输入：`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v)` + 派发冒泡的 `input` 事件。模拟上传文件：造 `File` → `DataTransfer` → `defineProperty(input,'files',...)` → 派发 `change`。
- **Edit 工具**：同一消息里并行多个 Edit 只有最后一个生效（其余静默丢失），必须串行并复查。
- `grep -n "A\|B"` 在 zsh 下会漏匹配，改用 Grep 工具。
- Read 拒读 >256KB 文件；大 HTML 用 `temp/extract-html-text.py <file>` 抽正文。
- `.spec/spec.html` 会被批注工具实时写入 `data-page-node-id`，编辑前先 Read。
- 两端联动类改动要验四条路径：①操作端自身是否被带跑 ②无 hash 新窗口是否采纳对端 ③URL 显式指定页面时是否被劫持 ④对端变化时本端是否跟随。

## 项目事实

- 原型验收：`node scripts/check-app-ready.mjs /prototypes/<name>`；预览链接 `http://localhost:53817/?projectId=make-project-20260730&p=<name>`。
- 无 eslint，`lint` 恒 SKIPPED，以 typecheck + build 为准。
- 多页面原型用 `src/common/useHashPage.ts`，URL 为 `#page=<id>`。

## 版式陷阱

- **`fr` 行 + 内部 `flex:1` 互相放大**：`fr` 轨道的内在尺寸按 max-content 计入父级 min-content，内部 `flex:1` 会把 min-content 撑爆，把「刚好一屏」的布局顶出视口。`min-height:0` / `minmax(min-content,1fr)` / `align-content:start` 都无效；把弹性行改回 `auto`，或整体用 `align-content:center` 居中，才有效。
- `aspect-ratio` + `min-height` + `width:auto` 会反推宽度并撑破列宽。

## 原型：customer-cockpit-requirements（`cc-` 前缀，已交付）

- 页面：`operations`（默认）/ `behavior` / `control`(iPad) / `cockpit`；`overview`、`process`、`equipment` 已下线（文件保留）。下线时 `HOME_PAGE_ID` 与 `defaultPageId` 必须同步改。
- 运营驾驶舱已压缩为 16:9 单屏（1366×768 溢出 131px，为滚动降级）。大屏与 iPad 控制页经 `components/displaySync.ts` 联动；同浏览器模拟不算跨设备验收。
- 评审报告在 `src/prototypes/customer-cockpit-requirements/.spec/reviews/`（2026-09-29 重跑：业务 67 / UI 65）。未决：首页数据口径不自洽、正文压到 9.5–11.5px、三处对比度硬失败；P2 行为监控 1440×900 溢出 56px、iPad 控制页恒 540×884。细节见报告。

## 原型：customer-cockpit-requirements-2（`uk-` 前缀，当前在做）

- 与上面是两套独立实现，类名前缀 `uk-`。1920×1080 固定画布，`.uk-screen` 用 `transform:scale(min(w/1920,h/1080))` 适配视口。
- 设备编号：**CCJ 炒菜机 / KXJ 烤箱 / JXB 机械臂**。已全面对齐 PRD（演示数据显式标注、不显示虚构百分比/批次/剩余时间）。动线轨道在 y=162；改数值时 SVG 坐标 / `@keyframes uk-move` / `.uk-rail-glow` 三处要一起动。
- 视图：`cockpit`（URL 写 `operations`）/ `nutrition` / `overview` / `behavior` / `admin` 等，见 `readViewFromLocation()`。
- **后台「配置示意图」= 真实页面的 iframe 1:1 内嵌**：用 `?embed=1` 加载真实页面，iframe 内 `innerWidth=1920` 使页面自身 scale 恰好为 1；父页用 `ResizeObserver` 量框宽后 `transform:scale(boxW/1920)`。配置经 postMessage 推送（`cockpit-preview-config` ↔ `cockpit-preview-ready`），页面内各面板标题读 `moduleLabels[key] ?? 默认`。
- 内嵌模式要收掉的原型附属物：`.uk-prototype-directory`、`PrototypeAnnotationViewer`（需求一览）、`#__axhub_annotation_host__`（Axhub 编辑器浮层——它注入在 `<html>` 下、与 body 同级，必须用兄弟选择器 `body.uk-embed ~ #...`）。
- 后台配置存储键 `customer-cockpit-admin-draft-v3` / `-published-v3`；模块由 `string[]` 改为 `{key,label}[]`，与真实面板一一对应（生产 5 / 营养 3 / 出餐 3 / 行为 0）。
