# 项目长期记忆（make-project-20260730）

## 原型总览

- 主要交付物：`src/prototypes/` 下的单屏大屏原型。本文件讨论的是
  **`customer-cockpit-requirements-2`**（智慧厨房驾驶舱，1920×1080 + 深色科技蓝，中文 UI）。
  另有 arm-timeline / 排产计划方向（`make-project-20260901`）。
- 本机开发服务：Vite `:51720`。原型地址
  `http://localhost:51720/prototypes/customer-cockpit-requirements-2/?page=<视图>`，
  视图取值 `cockpit | nutrition | overview | behavior | dish | version | requirements | admin`。
- 交付图统一归档到 `outputs/`，命名 `<原型名>-<主题>.png`。
- **设备标识两套写法并存（2026-10-14 起）**：示意图节点上用「设备码-口径」
  （`machineTag()`：CCJ1-600 / CCJ2-800；无口径的烤箱只显示 KX1），
  数据与列表里仍是「类型 + 码」（`device: '炒菜机 CCJ1'`）。口径只存一份（`model` 字段），
  节点文字别写死。**改生产流程 SVG 时只许动文字，不许动设备 rect 的 x/y/width ——
  动线动画 keyPoints 按设备中心手算（见 index.tsx ~274 行注释）。**

## 后台「配置示意图」= iframe 内嵌同一个原型（`?embed=1`）

不是手搓的第二份示意图 —— 手搓的迟早跟真页面走样（上一版线框图就被用户一眼看出来"一点也不像"）。
围绕它有三条**必须一起理解**的约定：

1. **它是静帧**。要同时停三类运动：CSS 动画（`.uk-embed *{animation:none}`）、
   JS 定时器（4 个 effect 里 `if (STATIC_PREVIEW) return undefined`）、
   **SVG SMIL**（`animateMotion` 走的托盘 —— 只有 `svg.pauseAnimations()+setCurrentTime()` 能停，
   它既不是 CSS 动画也不进 `document.getAnimations()`）。
   定格在 `PREVIEW_FREEZE_MS = 49_000`（不是 t=0：t=0 三台设备都是"未开始"、出餐记录是空的）。
2. **标识 vs 展示的分工**（用户否过一次，别改回去）：
   配置界面里凡是"用来看/选哪一页"的文字（值区 chips、页签、示意图标题）一律用**固定名** `PAGE_LABELS`；
   只有**大屏顶部导航**跟 `page.name`（「自定义页面名称」）联动。
3. **图上所见即所得编辑**（2026-10-13 加，默认关）：
   开关在示意图标题行最右端「图上编辑」。可改 4 个导航项 + 驾驶舱名 + 11 处模块标题（受控 `<input>`，
   **绝不用 contentEditable**），以及换**左上角 Logo** 和**膳食宝塔图片**（`ReplaceableImage`，
   只读态不渲染包装层）。图上是"能点的必须等于能改的"：进编辑态后
   `pointer-events` 只留给 `.uk-inline-edit` 和 `.uk-img-edit-btn`，其余全关。
   目标类型见 `PreviewEditTarget`（module / page / brand / logo / pagoda），
   回传走 `cockpit-preview-edit`，退出走 `cockpit-preview-exit`。
4. **改名 / 换图只在图上**（2026-10-13 晚间按用户要求逐块删）：后台的「自定义页面名称」
   「模块名称」「膳食宝塔图片」三块表单**已删**，对应入口只有图上编辑这一条路
   （Logo / 宝塔图角标 + `.uk-img-edit-reset` 恢复默认），页签下面留了一行
   `.uk-admin-edit-hint` 指路牌。删得掉的前提见下：
   - `ADMIN_PAGE_TO_VIEW` 覆盖全部 4 页（每页的页面名都能在大屏导航上改到）；
   - 那块表单里**图上没有对应物的参数必须留**（如「营养分析 轮播间隔」）；
   - 那块表单里**唯一的能力要先搬到图上再删**（「恢复默认」→ 图上 `canReset`），否则是静默少功能。
   别再"顺手恢复"回去，当天 14:47 已误删过一次。
   验收这套东西现在要靠：保存草稿后读 localStorage + 触发一次无关配置变更看名字能否反推回 iframe。
5. **⚠️ 但「页面设置」那块别跟着删**（2026-10-13 深夜已误删两次、用户要求还原）。
   它装的是**只有这一个入口**的真配置：营养分析轮播间隔（`nutritionCarouselSeconds`）、
   出餐统计默认餐段（`defaultMeal`）、明厨亮灶视频流增删（`kitchenStreams`）。
   已还原为 `{activePage.id !== 'behavior' && <section className="uk-admin-page-behavior">…}`，
   位置在 `.uk-admin-page-detail` 内第一块（所以 CSS 不加上边线）。
   **没有还原**其中的「膳食宝塔图片」—— 它的能力已在图上，还原就是搞出两个入口。

## ⚠️ 这个项目有一条「标注通道」会自己改代码，删东西前先认路

Axhub 客户端能把"在界面上圈一个元素 + 写一句需求"变成一条自动改码任务，指令长这样：

```
- 修改项 1
  - 当前元素标签: section
  - 当前元素文本: 页面设置
  - 元素定位: .uk-admin-page-behavior | <nth-of-type 面包屑>
  → 删除
```

**特征：`当前元素文本` 是界面上的可见文字，所以删一个容器 section = 删掉它下面全部内容。**
2026-10-13 当天，这条通道删掉了：4 块后台表单、整个「页面设置」、Logo 那格（分三次掏空）。
所以：**用户说"谁删了我的 XX"，先查这条通道，不要先怀疑自己的改动。**

### 怎么查（`.spec/acp/` 就是现成的"文件历史"）

- `src/prototypes/<原型>/.spec/acp/threads/<hash>.json`：`repository.messages[0]` 是那条指令原文，
  `messages[1].content.parts[]` 是 agent 每步（`tool-Search` / `tool-Read` / `tool-<命令行>`），
  每步的 `output.formatted_output` 里存着**当时的文件内容或命令输出**。
- `conversations.json` 只是索引（`messages` 里存 `{storage:'thread-file'}` 指针）。
- 那些 `rg -n` / `sed -n` 输出带行号且格式统一（`path:683:内容` 命中行 / `path-684-内容` 上下文行），
  一条正则 `CockpitAdminView\.tsx[:-](\d+)[:-](.*)` 提行号 + 去重，就能拼回**任意时间点的局部原文**。
  脚本：`/tmp/restore_block.py`（扫全部 thread，按命中行数排序取覆盖最全的一份）。
- 遍历所有 thread 的 `messages[0]` 还能得到**当天所有标注操作的清单**（时间 + 元素文本 + 动作）。

## 配套的排障/验证手法（这套项目里最省时间的）

- **无头浏览器**：`chrome-headless-shell`（路径见用户级 MEMORY.md），必须 `--no-sandbox`
  且 Bash 带 `dangerouslyDisableSandbox`；驱动脚本 `/tmp/cdpdrv.py`（自己拉浏览器、用完即杀）。
  注意 `cdpdrv` 的 `ev(expr)` **只收一个参数**，要传值就用 `"""…%s…""" % json.dumps(v)` 拼进去。
- **★★ 判"元素在不在画面上"，`getBoundingClientRect()` 和 `elementFromPoint()` 都不行。**
  一个 `visibility:hidden` 的元素同时满足：rect 有完整尺寸坐标、`elementFromPoint` 返回它自己。
  2026-10-13 就是靠这个骗过了前两遍探针（结论是"块在、没被遮挡"），实际屏幕上什么都没有。
  **唯一可靠判据：`getComputedStyle(el).visibility === 'visible'`（逐子项数 `visKids/kids`）；
  同类的还有 `opacity:0`、字色与底色相同、`clip-path` 全裁。**
  这类 bug 的共同点：**DOM 有、能点到、能读屏，就是画不出来** —— typecheck 和 console 全干净。
- **跨模块的 CSS 状态类最容易误伤**：`uk-has-exception-state`（条件类，正确）和
  `uk-exception-summary-host`（当时无条件，错误）长得极像，扫代码时一眼看不出差别。
  **查法：凡前缀相同的这一族 class，不写在 `${...}` 三元里的全部列为可疑。**
  本次受害的两处：`index.tsx` 的 `.uk-module-kpis.uk-plan-kpis`（出餐数字统计条 5 项）、
  `BehaviorView.tsx` 的 `.uk-mon-stats`（异常数字统计条 6 项）。
  改完要做**机制自检**：手动给元素加上那两个类，子项应立即 `hidden`（证明功能本身没坏）。
- **"一个字段只有定义、没有读取"是它的界面被删了的指纹**：`defaultMeal` 当时只在类型和
  `INITIAL_CONFIG` 里出现、全文件搜不到消费点 —— typecheck 不会报（合法），
  但它精确指向"这里原本有个下拉框"。
- **同源 iframe 可以直接 `contentDocument`**：后台的 `?embed=1` 帧与父页同源，
  所以量几何、点元素、读文本全部能一次 `Runtime.evaluate` 搞定，不用截图猜。
- **判"有没有动"/"有没有变"要用像素或几何，不要用动画列表或文本**：
  SMIL 那次就是"动画数 0 + 文本没变"却还在动（见用户级 MEMORY.md）。
- **后台页面的滚动在内层容器 `.uk-admin-main`，不是 window**（`window.scrollY` 恒为 0）
  → 后台截图整屏截，不要用 `Page.captureScreenshot` 的 `clip`。
- **截对比图前先把 `position:fixed` 的调试浮层（`.uk-prototype-directory`）`display:none`** ——
  它盖在左边 175px，会把每排 KPI 的第一个数字切掉；它是 fixed，藏掉不引起重排。
- **比尺寸要"全在缩放层内"或"全在层外"**：iframe 内部 `getBoundingClientRect()` 已是内部 CSS px，
  别再乘除外层 `transform: scale()`（混着算会得到"像真的一样"的错误数字）。
- 回归脚本：`/tmp/regress5.py`（五视图布局 + console + 编辑态可点数），基线
  `cockpit/nutrition/overview/behavior/dish` 全部 `bodyOverflow=0 err=0 warn=0`。

## 用户偏好（跟这个项目相关的部分）

- 出题方式是**截图圈位置 + 一句话**。要先确认圈的是"原型内的元素"还是"Axhub 客户端外壳"
  （后台左侧那列 20 个页面名就是原型自己模拟的外壳，不在 `.axhub/` 里）。
- 会**两次否掉同一个设计错误**（标识/展示联动那次），所以拿不准是"联动更贴心"还是"固定更清楚"时，
  默认选**固定**，并把"为什么不联动"写进注释。
- 问「A 还是 B」时通常是要权衡，不是要你替他否决；给完代价就按他定的方向做。
- 归档习惯：改完要一张能直接看的对比图（前后同框、带中文标注）。
- **入口要"一眼能找到"**：他曾在白色后台页面上漏看一颗 12px 的白底浅边按钮，回了
  「怎么感觉你啥都没改啊，没变化啊」。给后台加任何入口，默认按"用户会漏看"设计：
  有底、有边、有图标、有开关状态差；验收标准是"截图里一眼能找到"，不是"代码里有"。
  遇到这类反馈，先自证代码**确实生效**（量样式 + `curl` 抓 Vite 产物 grep 新标识符 + 排掉端口串站），
  确认是"看得见"的问题再改样式，别急着重写逻辑。

## 还没回应的待办

- **明厨亮灶视频流现在是"没有大屏消费者"的后台参数**：`kitchenStreams` / 新增的
  `streamLayout` / `streamCarouselSeconds` 在 `index.tsx` 里搜不到，大屏那块没读它。
  要不要让大屏照着渲染（网格平铺 / 轮播 + 间隔），等用户定。
- 静帧里页头「暂停页面 / 当前轮播状态：轮播中」是静止文字，读起来略怪 → 改成「已暂停」还是隐藏。
- 出餐量在真页面约 2 分钟就顶到 `TOTAL_PLAN`（100%），是否为既有数据口径问题单独修。
- 侧栏 20 个子页里只有「智能驾驶舱管理」是真页面，其余点了没反应 → 要不要给"建设中"提示。
- `?page=dish` 有两个面板被裁（`clip=2`，老问题）；线框兜底版 `StaticCockpitPreview` 要不要删。
- 「异常状态参考」模式下 `?page=dish` 没有接入 `exceptionState`（DishStatsModule 不接这个 prop），
  参考页里这一页会照常显示真数据，与其它页行为不一致。
