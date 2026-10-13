/* ⚠️ React 这个默认导入**不能删**，哪怕文件里已经没有任何 `React.xxx` 的写法。
   tsconfig 里写的是 jsx:"react-jsx"，但 dev 端实际是按经典运行时编译的（产出 React.createElement），
   删掉之后 `npm run typecheck` 照样过，页面却直接白屏报 "React is not defined" ——
   2026-10-13 删排序那套组件时踩过一次，两条路只有一条能发现问题。 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dietPagoda3d from '../assets/diet-pagoda-3d.png';
import kitchenIllustration from '../assets/realtime-kitchen-generated.png';
import './CockpitAdminView.css';

type PageId = 'production' | 'nutrition' | 'outmeal' | 'behavior';
/* 模块 = 真实页面上的一个面板。key 是面板的稳定标识（原型用它取配置标题），label 是显示名。
   配置与真实面板一一对应，预览才能既 1:1 又跟着配置改。 */
type ModuleDef = { key: string; label: string };
type PageSetting = { id: PageId; name: string; enabled: boolean; modules: ModuleDef[] };
type RemoteKeyId = 'toggle' | 'previous' | 'next';
type RemoteKeys = Record<RemoteKeyId, string>;
type CockpitConfig = {
  name: string;
  code: string;
  description: string;
  enabled: boolean;
  logo: string;
  pageCarouselEnabled: boolean;
  pageCarouselSeconds: number;
  remoteEnabled: boolean;
  remoteKeys: RemoteKeys;
  pages: PageSetting[];
  nutritionCarouselSeconds: number;
  nutritionPagodaImage: string;
  kitchenStreams: Array<{ id: number; name: string; url: string }>;
  /* 明厨亮灶视频流的**播放方式**（2026-10-13 深夜新增，用户要求）：
     · 'grid'     网格平铺 —— 几路画面同屏并列
     · 'carousel' 轮播     —— 同屏只显示一路，按 streamCarouselSeconds 轮换
     只有 1 路画面时这两项都没有意义（就一个画面，铺和轮都是它自己），
     表单里会把整组控件禁用并写明原因。
     ── 为什么单路时"禁用"而不是"隐藏" ──
     这一行本身也是"这页能配什么"的信息。藏起来，用户就以为视频流没有播放方式可设；
     禁用了还留着，他一眼能看见"有这个功能，只是现在用不上"。 */
  streamLayout: 'grid' | 'carousel';
  streamCarouselSeconds: number;
};

/* v3：模块从「字符串数组」升级为「面板 key + 标题」，结构变了，旧草稿直接作废。 */
const STORAGE_DRAFT = 'customer-cockpit-admin-draft-v3';
const STORAGE_PUBLISHED = 'customer-cockpit-admin-published-v3';
const INITIAL_CONFIG: CockpitConfig = {
  name: '智厨驾驶舱',
  code: 'ZCJSC',
  description: '自动生成排产计划测试用智厨驾驶舱',
  enabled: true,
  logo: '',
  pageCarouselEnabled: true,
  pageCarouselSeconds: 20,
  remoteEnabled: false,
  remoteKeys: { toggle: 'Enter', previous: 'ArrowLeft', next: 'ArrowRight' },
  /* 各页模块 = 该页真实面板，顺序与页面上「从上到下、从左到右」一致。
     改 label 预览里的面板标题就跟着变；key 必须与原型里 moduleLabels 的取值一致。 */
  pages: [
    { id: 'production', name: '生产烹饪', enabled: true, modules: [
      { key: 'production-menu', label: '今日菜单' },
      { key: 'production-flow', label: '智厨生产流程' },
      { key: 'production-progress', label: '生产进度' },
      { key: 'production-kitchen', label: '明厨亮灶' },
      { key: 'production-outflow', label: '出餐记录' },
    ] },
    { id: 'nutrition', name: '营养健康', enabled: true, modules: [
      { key: 'nutrition-pagoda', label: '中国居民平衡膳食宝塔（2022）' },
      { key: 'nutrition-analysis', label: '营养分析' },
      { key: 'nutrition-menu', label: '今日菜单' },
    ] },
    { id: 'outmeal', name: '出餐统计', enabled: true, modules: [
      { key: 'outmeal-detail', label: '出餐明细' },
      { key: 'outmeal-donut', label: '出餐情况占比' },
      { key: 'outmeal-deviation', label: '各批次出餐偏差（分钟）' },
    ] },
    /* 行为监控页不配置模块细项，仅在下方展示页面示意图。 */
    { id: 'behavior', name: '行为监控', enabled: true, modules: [] },
  ],
  nutritionCarouselSeconds: 8,
  nutritionPagodaImage: '',
  kitchenStreams: [{ id: 1, name: '后厨主画面', url: '' }],
  /* 默认「网格平铺」而不是「轮播」：轮播是"自动换台"，会让人在没主动开启的情况下
     突然发现画面变了。默认给不动的那个，想轮播的人自己切。 */
  streamLayout: 'grid',
  streamCarouselSeconds: 10,
};

/* 页面的**固定名**。配置界面里凡是「用来看/选哪一页」的文字都用它，不跟页面展示名联动 ——
   页面展示名（page.name，原本由「自定义页面名称」输入框改，2026-10-13 晚间起改为在示意图上直接改）
   只作用到大屏顶部导航；改完名字之后，页签、多选选值这些地方还得认得出是哪一页。
   两个名字的分工：PAGE_LABELS = 配置界面的身份标识；page.name = 大屏上的展示名。 */
const PAGE_LABELS: Record<PageId, string> = {
  production: '生产烹饪', nutrition: '营养健康', outmeal: '出餐统计', behavior: '行为监控',
};

/* 侧栏一级菜单「设备管理」下的页面清单。整块是客户端外壳的模拟（真实系统里这些是设备类页面），
   顺序照用户给的后台截图来；本页在这些页面里是最后一个可用的那个 —— 其余为占位，点了没反应。
   抽成常量只为一件事：把 20 个页面名从 JSX 里挪出来，让侧栏结构（一级菜单 + 子页）一眼看得出。 */
const ADMIN_SIDEBAR_ITEMS = [
  '入口管理', '出品管理', '层架任务屏管理', '烤箱管理', '临时位管理', '层架车摆盘位',
  '炒菜机管理', '中转位管理', '调度流程', '摄像头', '称重加料屏管理', '层架车摆盘屏管理',
  '漂烫桶管理', '锅铲管理', '倒菜位管理', '锅刷管理', '水枪管理', '后厨备餐屏管理',
  '智能驾驶舱管理', '语音交互管理',
];
const REMOTE_LABELS: Array<{ id: RemoteKeyId; label: string; hint: string }> = [
  { id: 'toggle', label: '播放 / 暂停轮播', hint: '切换页面自动轮播状态' },
  { id: 'previous', label: '上一页面', hint: '循环切换到上一个启用页面' },
  { id: 'next', label: '下一页面', hint: '循环切换到下一个启用页面' },
];

function readConfig(key: string): CockpitConfig | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<CockpitConfig>;
    const oldDefaultKeys = saved.remoteKeys?.toggle === 'F13' && saved.remoteKeys?.previous === 'F14' && saved.remoteKeys?.next === 'F15';
    return {
      ...INITIAL_CONFIG,
      ...saved,
      remoteKeys: oldDefaultKeys ? INITIAL_CONFIG.remoteKeys : { ...INITIAL_CONFIG.remoteKeys, ...saved.remoteKeys },
    };
  } catch {
    return null;
  }
}

/* 这里原本有 Chevron / DragHandle / OrderButtons 三个小组件：行尾一个 6 点把手做整行拖动排序，
   外加两个「1px + clip-path」视觉隐藏的 ↑↓ 按钮当键盘回退（2026-10-13 上午的「方案 A」）。
   当天下午需求改成「页面用页签切换、不用加排序」，排序入口本身就不存在了，于是整组一并删掉。
   不是误删：页签是一排真按钮，Tab / 回车天然就是键盘通路，删掉反而少一套要维护的补丁。 */

/* 下拉箭头 + 勾选标记。两个都用 SVG 画而不是 ✓ ⌄ ▾ 这些字符 —— 字符的字形粗细、
   垂直居中会随字体变（改版前 ↑↓ 就是栽在这里），14px 的小控件上这点差异很显眼。 */
function Caret({ open }: { open: boolean }) {
  return <svg className={`uk-admin-caret${open ? ' is-open' : ''}`} width="10" height="6" viewBox="0 0 10 6" aria-hidden="true" focusable="false">
    <path d="M1 1 5 5 9 1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
function CheckMark() {
  return <svg width="9" height="7" viewBox="0 0 10 8" aria-hidden="true" focusable="false">
    <path d="M1 4 3.6 6.6 9 1.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
/* 「图上编辑」的图标。同样用 SVG 而不是 ✎ / ✏ 这类字符 —— 理由与上面 Caret 一样，
   而且这里的图标要承担"这是一枚可点的控件"的信号：第一版只写了一行 12px 的字、
   白底浅边框贴在白页面上，用户直接扫过去了，反馈是「啥都没改」。
   小图标 + 有底色的按钮，是这次能一眼看见的关键（不是把字写大写粗就够）。 */
function PencilIcon() {
  return <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path d="M1 11l.6-2.9L8.1.6a1 1 0 0 1 1.4 0l1.9 1.9a1 1 0 0 1 0 1.4L4.9 10.4 1 11z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M7.4 1.6 10.4 4.6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>;
}
function ExitIcon() {
  return <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path d="M2.2 6.2 4.8 8.8 9.8 3.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

/* 静态线框版与 iframe 版吃**同一份**配置，所以字段取并集：
   iframe 侧只读 pages 里的 id / name / enabled（多出来的 modules 会被忽略），
   静态侧要完整的 pages 与 nutritionPagodaImage。合成一份的好处是两者能一键互切。 */
type PreviewConfig = {
  name: string;
  logo: string;
  pages: PageSetting[];
  moduleLabels: Record<string, string>;
  nutritionPagodaImage: string;
};

/* 图上编辑的**目标**：说的是「改的是页面上哪一处」，不是「改数组里第几项」。
   模块 key 在四页里全局唯一（production-* / outmeal-* / nutrition-*），带 key 就够定位，
   所以不必再带 pageId —— 写回时扫一遍 pages 就能找到它属于哪一页，
   也就不会出现「在 A 页的图上改、却因为传错 pageId 写到了 B 页」这种错。
   index.tsx（iframe 侧）import 的就是这个类型，两边的契约只有这一份定义。
   logo / pagoda 两个是**图片**：value 是 data URL，不是文字。 */
export type PreviewEditTarget =
  | { kind: 'module'; key: string }
  | { kind: 'page'; id: string }
  | { kind: 'brand' }
  | { kind: 'logo' }
  | { kind: 'pagoda' };

/* 「配置示意图」= 把**真实页面**塞进一个固定 1920×1080 的 iframe，再整体缩放到框宽。
   为什么不再手搓一份示意图：手搓的迟早会跟真页面走样。上一版线框图每个面板只有
   「标题 + 三条灰条」，而真页面是菜品卡、流程图、进度图 —— 用户一眼就看出「一点也不像」。
   iframe 里跑的就是同一个页面，天然 1:1，而且不会随页面改版失效。
   页面侧配合：带 ?embed=1 时不渲染原型目录、不自动轮播，并接收父窗口 postMessage 的配置。 */
const PREVIEW_W = 1920;
const PREVIEW_H = 1080;
/* 后台页 id → 原型 ViewId：后台叫 production / outmeal，原型叫 cockpit / overview。
   必须与 index.tsx 的 ADMIN_PAGE_TO_VIEW 保持一致，否则 iframe 会打开错误的页面。 */
const ADMIN_PAGE_VIEW: Record<PageId, string> = {
  production: 'cockpit',
  nutrition: 'nutrition',
  outmeal: 'overview',
  behavior: 'behavior',
};

/* editMode / onEdit / onExit 是「图上编辑」这条链路：
   editMode 下行，让 iframe 里的标题变成可输入的；
   onEdit 收上行写回（iframe → 草稿），onExit 收「在里面按了 Esc」。
   注意 Esc 必须走消息传上来：输入框在 iframe 里，那里的 keydown 不会冒泡到本窗口，
   本窗口自己挂的 Esc 监听取不到。 */
function LivePreviewFrame({ pageId, config, editMode, onEdit, onExit }: {
  pageId: PageId;
  config: PreviewConfig;
  editMode: boolean;
  onEdit: (target: PreviewEditTarget, value: string) => void;
  onExit: () => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  /* 框宽用 ResizeObserver 实时量：窗口缩放、断点折行时缩放比要跟着重算，
     框高也由同一个数按 16:9 反算 —— 两者不同源就会在框底留黑边或者切掉内容。 */
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    setBoxWidth(box.clientWidth);
    const observer = new ResizeObserver((entries) => setBoxWidth(entries[0]?.contentRect.width ?? 0));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  const push = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({ type: 'cockpit-preview-config', config, editMode }, '*');
  }, [config, editMode]);
  /* 配置一变就推一次：改名、换图、停用页面都要立刻反映到示意图上。
     editMode 变了也走这里 —— 开关一按就要在下一帧生效，不能再等一次无关的配置变化。 */
  useEffect(() => { push(); }, [push]);
  /* 再补一道 ready 握手。父页可能在 iframe 还没挂上监听时就发了第一条，那条会丢，
     所以 iframe 挂好后主动回一条 ready，父页收到再补推一次。两道都留着才不漏。 */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === 'cockpit-preview-ready') push();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [push]);
  /* 反向通道：图上编辑的写回。**必须校验 event.source** —— 页面上同时挂着好几个 iframe
     （原型目录、标注工具），不认来源的话，任何一个 iframe 发一条同格式的消息都会被当成
     「用户在示意图上改了字」，草稿就被改了，而且看不出是谁改的。 */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: string; target?: PreviewEditTarget; value?: string } | null;
      if (data?.type === 'cockpit-preview-exit') { onExit(); return; }
      if (data?.type !== 'cockpit-preview-edit' || !data.target || typeof data.value !== 'string') return;
      onEdit(data.target, data.value);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onEdit, onExit]);
  /* 取 window.location.pathname 而不是写死路径：后台本身就跑在这个原型页面里，
     这样无论从 localhost:51720 还是从 Make 外壳进来，iframe 都能指向同一个原型。 */
  const src = `${window.location.pathname}?page=${ADMIN_PAGE_VIEW[pageId]}&embed=1`;
  return <div className={`uk-admin-live-frame${editMode ? ' is-edit' : ''}`} ref={boxRef} style={{ height: boxWidth ? Math.round(boxWidth * PREVIEW_H / PREVIEW_W) : undefined }}>
    {/* tabIndex 编辑态才给 0：非编辑态这张图是纯影像，不该进 Tab 顺序；
        进了编辑态，键盘用户得能 Tab 进 iframe、再在几个标题之间走。 */}
    <iframe ref={frameRef} title="配置示意图" src={src} width={PREVIEW_W} height={PREVIEW_H} tabIndex={editMode ? 0 : -1} onLoad={push} style={{ transform: `scale(${boxWidth ? boxWidth / PREVIEW_W : 0})` }} />
  </div>;
}

/* ── 以下是线框版静态示意图，当前**没在用**，留作兜底 ────────────────────
   用途：万一某些环境下同源 iframe 嵌不进来（比如外壳又套了一层 iframe 且策略不同），
   把下面渲染处那行换成 <StaticCockpitPreview pageId={activePage.id} config={previewConfig} /> 即可，
   两者的配置对象是同一份，切过去不用改任何数据。
   代价是它和真页面长得不像，只能看个大概版式 —— 所以只当兜底，不当默认。 */

function StaticModulePreview({ pageId, module, index, config }: { pageId: PageId; module: ModuleDef; index: number; config: PreviewConfig }) {
  if (pageId === 'nutrition' && module.key === 'nutrition-pagoda') {
    return <div className="uk-admin-static-pagoda"><img src={config.nutritionPagodaImage || dietPagoda3d} alt="膳食宝塔示意" /></div>;
  }
  if (pageId === 'production' && module.key === 'production-kitchen') {
    return <div className="uk-admin-static-kitchen"><img src={kitchenIllustration} alt="后厨设备示意" /><span>设备运行示意</span></div>;
  }
  if (pageId === 'nutrition' && module.key === 'nutrition-analysis') {
    return <div className="uk-admin-static-nutrition-chart"><i /><span>能量　蛋白质　脂肪</span></div>;
  }
  if (pageId === 'outmeal') {
    return <div className="uk-admin-static-bars">{[62, 84, 48, 73, 92].map((width, itemIndex) => <i key={itemIndex} style={{ width: `${width}%` }} />)}</div>;
  }
  return <div className="uk-admin-static-lines">
    <span>{pageId === 'production' ? `今日生产任务 ${index + 8} 项` : '实时数据示意'}</span>
    <i /><i /><i />
  </div>;
}

function StaticCockpitPreview({ pageId, config }: { pageId: PageId; config: PreviewConfig }) {
  const visiblePages = config.pages.filter((page) => page.enabled);
  const currentPage = config.pages.find((page) => page.id === pageId);

  return <div className="uk-admin-static-preview">
    <header className="uk-admin-static-header">
      <div className="uk-admin-static-brand">{config.logo ? <img src={config.logo} alt="" /> : <b>智</b>}<strong>{config.name || '智厨驾驶舱'}</strong></div>
      {/* 这里用 page.name（自定义名）是**对的**，别按上面那条「配置界面用固定名」的规则改：
          这排 span 画的是**大屏顶部导航**本身（线框版），不是配置界面里的选页控件。 */}
      <nav>{visiblePages.map((page) => <span className={page.id === pageId ? 'is-active' : ''} key={page.id}>{page.name}</span>)}</nav>
      <small>09:41</small>
    </header>
    {pageId === 'behavior' ? <div className="uk-admin-static-behavior">
      <div><b>行为监控示意图</b><span>实时监控画面</span></div>
      <div className="uk-admin-static-camera"><i /><span>监控画面</span></div>
      <div className="uk-admin-static-status"><i />设备在线　<i />监控正常</div>
    </div> : <div className={`uk-admin-static-modules is-${pageId}`}>
      {currentPage?.modules.map((module, index) => <section className={`uk-admin-static-module is-${module.key}`} key={module.key}>
        <h3>{module.label}</h3>
        <StaticModulePreview pageId={pageId} module={module} index={index} config={config} />
      </section>)}
    </div>}
  </div>;
}

export function CockpitAdminView({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [draft, setDraft] = useState<CockpitConfig>(() => readConfig(STORAGE_DRAFT) ?? INITIAL_CONFIG);
  const [activePageId, setActivePageId] = useState<PageId>('production');
  const [listeningKeyId, setListeningKeyId] = useState<RemoteKeyId | null>(null);
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  /* 「图上编辑」开关。关着的时候示意图就是一张静态图（pointer-events:none 那张），
     开着的时候才松手 —— 两种状态的差别只在这一个布尔值上，所以它必须只有一个来源。 */
  const [previewEdit, setPreviewEdit] = useState(false);
  /* 侧栏一级菜单「设备管理」的展开状态。默认展开：进来就该看到当前页在哪一级下面。 */
  const [deviceMenuOpen, setDeviceMenuOpen] = useState(true);
  const sidebarNavRef = useRef<HTMLElement | null>(null);
  const activeSidebarRef = useRef<HTMLButtonElement | null>(null);
  /* 当前页在 20 个子页里排第 19，侧栏可视高度装不下 —— 不滚一下，打开后台看到的是
     「侧栏里一个高亮项都没有」（高亮项在可视区下面），看着像没选中任何页面。
     直接把它滚到侧栏中间：比 scrollIntoView({block:'nearest'}) 可控 ——
     那个按"最近边缘"对齐，实测只滚了一小段就把选中项留在可视区外。 */
  useEffect(() => {
    const nav = sidebarNavRef.current;
    const active = activeSidebarRef.current;
    if (!deviceMenuOpen || !nav || !active) return;
    nav.scrollTop = Math.max(0, active.offsetTop - (nav.clientHeight - active.offsetHeight) / 2);
  }, [deviceMenuOpen]);
  const [toast, setToast] = useState('');
  const enabledPages = useMemo(() => draft.pages.filter((page) => page.enabled), [draft.pages]);
  /* 静态示意图直接读取当前草稿；配置变化时 React 自动刷新预览。 */
  const previewConfig = useMemo<PreviewConfig>(() => ({
    name: draft.name,
    logo: draft.logo,
    pages: draft.pages,
    /* 模块名拍平成 key → 标题的字典推给 iframe：页面侧按 key 取，
       所以图上面板标题改一个字，这个字典跟着变、预览里别的面板不受影响。
       （改名的入口现在**只**在图上的「图上编辑」里，见下方 applyPreviewEdit。） */
    moduleLabels: draft.pages.reduce<Record<string, string>>((labels, page) => {
      page.modules.forEach((module) => { labels[module.key] = module.label; });
      return labels;
    }, {}),
    nutritionPagodaImage: draft.nutritionPagodaImage,
  }), [draft]);
  /* 图上编辑的写回：把 iframe 传来的「改哪一处 + 新值」落到 draft 上。
     走 setDraft 的函数式更新而不是读当前 draft 再拼：打字是连续的，
     两次输入落在同一帧里会读到同一个旧值，后一条把前一条挤掉 —— 症状是"打得快就丢字"。 */
  const applyPreviewEdit = useCallback((target: PreviewEditTarget, value: string) => {
    setDraft((current) => {
      if (target.kind === 'brand') return { ...current, name: value };
      /* 两张图直接存在配置顶层（logo / nutritionPagodaImage），value 是 data URL 字符串，
         与文字同一条通道 —— 不为图片再开一条消息类型，两端都少一处要维护的分支。 */
      if (target.kind === 'logo') return { ...current, logo: value };
      if (target.kind === 'pagoda') return { ...current, nutritionPagodaImage: value };
      if (target.kind === 'page') {
        return { ...current, pages: current.pages.map((page) => page.id === target.id ? { ...page, name: value } : page) };
      }
      /* 模块改名：按 key 扫全表定位。**不是**按 activePage 定位 ——
         改的那一处可能不在当前页签上（比如刚切完页签、示意图还没换过去）。 */
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          modules: page.modules.map((module) => module.key === target.key ? { ...module, label: value } : module),
        })),
      };
    });
  }, []);
  /* 单独包一层 useCallback 而不是在 JSX 里写 () => setPreviewEdit(false)：
     那个写法每次渲染都是新函数，会让 iframe 侧的消息订阅每渲染一次就重订一次，
     而打字是连续渲染的 —— 没必要每敲一个字就解绑再绑一次监听。 */
  const exitPreviewEdit = useCallback(() => setPreviewEdit(false), []);
  /* 先在**启用页**里找，找不到才退回第一个启用页。页签只列启用页，
     所以 activePageId 若短暂指向一个刚被取消勾选的页面，这里也能立刻落到一个「有页签」的页上 ——
     不这么写就会出现某一帧「4 个页签全不高亮」。 */
  const activePage = enabledPages.find((page) => page.id === activePageId) ?? enabledPages[0] ?? draft.pages[0];
  /* 这里原本还有一段 pagodaModuleLabel / pagodaImageLabel：把「{模块名}图片」算出来给表单那块
     「膳食宝塔图片」当标签用（好处是模块在图上一改名，标签跟着变）。
     2026-10-13 晚间那块表单删掉、入口搬到示意图上，这两个派生变量就没有消费者了，一并删掉。
     图上那颗按钮的文案是写死的「宝塔图片」—— 它是个 12px 的控件标签，不是展示数据，
     跟着模块名走反而会把按钮撑得很长（模块全名有 15 个字）。 */

  useEffect(() => {
    if (!enabledPages.some((page) => page.id === activePageId)) {
      setActivePageId(enabledPages[0]?.id ?? draft.pages[0].id);
    }
  }, [activePageId, draft.pages, enabledPages]);

  useEffect(() => {
    if (!listeningKeyId) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape') {
        setListeningKeyId(null);
        return;
      }
      const duplicate = Object.entries(draft.remoteKeys).some(([id, code]) => id !== listeningKeyId && code === event.code);
      if (duplicate) {
        setToast('该按键已分配给其他功能');
        window.setTimeout(() => setToast(''), 2200);
        return;
      }
      setDraft((current) => ({ ...current, remoteKeys: { ...current.remoteKeys, [listeningKeyId]: event.code } }));
      setListeningKeyId(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [draft.remoteKeys, listeningKeyId]);

  /* 下拉多选的「点外面收起 / Esc 收起」。
     用 pointerdown 的**捕获阶段**而不是 click：click 要等按下再抬起，
     而面板里那些切换按钮靠 click 生效 —— 用 click 判断「点外面」会跟它们抢同一拍。
     判断「在不在面板里」用 closest 而不是坐标：
     触发器、菜单、菜单里的行都挂在 .uk-admin-page-picker 下面，一次判断全覆盖。 */
  useEffect(() => {
    if (!pagePickerOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest('.uk-admin-page-picker')) setPagePickerOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPagePickerOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [pagePickerOpen]);

  /* 图上编辑时按 Esc 退出（在示意图里按的那次走 iframe 消息，见 LivePreviewFrame）。
     两个前置判断都是为了不和本页已存在的两个 Esc 抢：监听遥控按键那个会 preventDefault，
     下拉多选那个开着时 Esc 归它收 —— 不判就会出现「按一下 Esc 关了两样东西」。 */
  useEffect(() => {
    if (!previewEdit) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || pagePickerOpen) return;
      if (event.key === 'Escape') setPreviewEdit(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pagePickerOpen, previewEdit]);

  const updateDraft = (patch: Partial<CockpitConfig>) => setDraft((current) => ({ ...current, ...patch }));
  const updatePage = (id: PageId, patch: Partial<PageSetting>) => setDraft((current) => ({
    ...current,
    pages: current.pages.map((page) => page.id === id ? { ...page, ...patch } : page),
  }));
  /* 「显示页面」多选（在基本信息里）。勾上就顺带把这一页选中，省得再去下方页签点一次；
     取消勾选不用在这里处理 —— 上面那个 useEffect 会把 activePageId 弹回第一个启用页。
     （2026-10-13 下午按需求删掉排序：movePage / movePageTo / 拖动落位 / 缝隙判定整套都去掉了。
       页面顺序即 INITIAL_CONFIG 里的定义顺序，大屏导航与页签读的是同一份，不存在第二个顺序来源。） */
  const setPageEnabled = (id: PageId, next: boolean) => {
    updatePage(id, { enabled: next });
    if (next) setActivePageId(id);
  };
  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  };
  const saveDraft = () => {
    localStorage.setItem(STORAGE_DRAFT, JSON.stringify(draft));
    flash('草稿已保存（当前浏览器）');
  };
  const publish = () => {
    if (!draft.name.trim() || !draft.code.trim()) {
      flash('请填写驾驶舱名称和编号');
      return;
    }
    localStorage.setItem(STORAGE_DRAFT, JSON.stringify(draft));
    localStorage.setItem(STORAGE_PUBLISHED, JSON.stringify(draft));
    flash('配置已发布（原型演示）');
  };
  const restorePublished = () => {
    const published = readConfig(STORAGE_PUBLISHED);
    if (!published) {
      flash('暂无已发布配置');
      return;
    }
    setDraft(published);
    flash('已恢复最近发布配置');
  };
  const readImage = (file: File | undefined, onRead: (url: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' && onRead(reader.result);
    reader.readAsDataURL(file);
  };
  const addStream = () => updateDraft({
    kitchenStreams: [...draft.kitchenStreams, { id: Date.now(), name: `后厨画面 ${draft.kitchenStreams.length + 1}`, url: '' }],
  });
  const setStream = (id: number, patch: Partial<{ name: string; url: string }>) => updateDraft({
    kitchenStreams: draft.kitchenStreams.map((stream) => stream.id === id ? { ...stream, ...patch } : stream),
  });
  /* 只有 1 路画面时，播放方式与轮播间隔都没有可配的余地 —— 就一个画面，铺和轮都是它自己。
     表单据此禁用整组控件并写明原因。这个判定只在这里算一次，别在 JSX 各处再算一遍：
     两处各写一遍，以后改"几路算单路"就会只改到一半。 */
  const singleStream = draft.kitchenStreams.length <= 1;

  return <div className="uk-admin-shell">
    <aside className="uk-admin-sidebar">
      <div className="uk-admin-brand"></div>
      <nav aria-label="后台导航" ref={sidebarNavRef}>
        {/* 一级菜单「设备管理」（2026-10-13 用户补充）。它下面这 20 个页面都是它的子页 ——
            与面包屑「首页 / 设备管理 / 智能驾驶舱管理」是同一套层级。
            加这一层之前，这串页面是平铺的一级菜单，看上去「智能驾驶舱管理」和
            「入口管理」同级，跟面包屑说的是两回事。
            展开/收起只是本页的局部 UI 状态：不进配置对象，也不随「保存草稿」写进 localStorage。 */}
        <button
          type="button"
          className="is-group"
          aria-expanded={deviceMenuOpen}
          onClick={() => setDeviceMenuOpen((open) => !open)}
        >设备管理<Caret open={deviceMenuOpen} /></button>
        {deviceMenuOpen && ADMIN_SIDEBAR_ITEMS.map((item) =>
          <button
            key={item}
            type="button"
            className={`is-child${item === '智能驾驶舱管理' ? ' is-active' : ''}`}
            ref={item === '智能驾驶舱管理' ? activeSidebarRef : undefined}
          >{item}</button>)}
      </nav>
    </aside>

    <main className="uk-admin-main">
      <header className="uk-admin-topbar">
        <button className="uk-admin-back" type="button" aria-label="返回" onClick={() => onNavigate('cockpit')}>‹</button>
        <div className="uk-admin-breadcrumb"><span>首页</span><i>/</i><span>设备管理</span><i>/</i><b>智能驾驶舱管理</b></div>
        <div className="uk-admin-canteen">当前食堂：排产测试用 - 自动生成排产计划测试用</div>
        <button className="uk-admin-switch" type="button">切换食堂⌄</button><span className="uk-admin-user">希阳</span>
      </header>

      <div className="uk-admin-editor-page">
        <div className="uk-admin-page-title"><div><span>设备管理</span><i>/</i><b>智能驾驶舱管理</b><i>/</i><span>编辑配置</span></div><button type="button" onClick={() => onNavigate('cockpit')}>返回列表</button></div>
        <section className="uk-admin-editor-card">
          <div className="uk-admin-editor-card-head"><h1>编辑智厨驾驶舱</h1><span>配置页面、展示模块与大屏内容</span></div>
          <div className="uk-admin-editor-content">
            <section className="uk-admin-config-section">
              <h2>基本信息</h2>
              <div className="uk-admin-form">
                <label className="uk-admin-field is-required"><span>智厨驾驶舱名称：</span><input value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} /></label>
                <label className="uk-admin-field is-required"><span>智厨驾驶舱编号：</span><input value={draft.code} onChange={(event) => updateDraft({ code: event.target.value })} /></label>
                <label className="uk-admin-field is-required"><span>智厨驾驶舱描述：</span><input value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} /></label>
                <label className="uk-admin-field"><span>屏幕版本：</span><select defaultValue="单门店标准版"><option>单门店标准版</option><option>集团版</option></select></label>
                {/* 「驾驶舱品牌 Logo」这一格已删（2026-10-13 晚间，配合排版收敛）：
                    它当时只剩一个没有任何标签的空 div —— 标签文字和「上传 Logo」按钮已被移除、
                    readImage helper 也一并删了（Logo 的入口统一到图上：开「图上编辑」点左上角
                    那颗圆形角标就能换）。空 div 在三列网格里占着第 2 行中间那一格，
                    排出来就是一个空洞，后面所有字段都被顶得错位 —— 收掉它，网格自然左对齐补齐。
                    注意 draft.logo 这个数据**没动**：previewConfig.logo 照旧推给示意图，
                    applyPreviewEdit 里 kind:'logo' 那条写回也照旧。 */}
                <label className="uk-admin-field is-required"><span>是否启用：</span><span className="uk-admin-inline-control"><button className={`uk-admin-switch-toggle ${draft.enabled ? 'is-on' : ''}`} type="button" aria-label="是否启用" aria-pressed={draft.enabled} onClick={() => updateDraft({ enabled: !draft.enabled })}><i /></button><b>{draft.enabled ? '启用' : '停用'}</b></span></label>
                <label className="uk-admin-field"><span>页面自动轮播：</span><span className="uk-admin-inline-control"><button className={`uk-admin-switch-toggle ${draft.pageCarouselEnabled ? 'is-on' : ''}`} type="button" aria-label="页面自动轮播" aria-pressed={draft.pageCarouselEnabled} onClick={() => updateDraft({ pageCarouselEnabled: !draft.pageCarouselEnabled })}><i /></button><b>{draft.pageCarouselEnabled ? '开启' : '关闭'}</b></span></label>
                {draft.pageCarouselEnabled && <label className="uk-admin-field"><span>页面轮播间隔：</span><span className="uk-admin-number"><input type="number" min="5" max="360" value={draft.pageCarouselSeconds} onChange={(event) => updateDraft({ pageCarouselSeconds: Number(event.target.value) })} /><b>秒</b></span></label>}
                <label className="uk-admin-field"><span>启用逻辑遥控器：</span><span className="uk-admin-inline-control"><button className={`uk-admin-switch-toggle ${draft.remoteEnabled ? 'is-on' : ''}`} type="button" aria-label="启用逻辑遥控器" aria-pressed={draft.remoteEnabled} onClick={() => updateDraft({ remoteEnabled: !draft.remoteEnabled })}><i /></button><b>{draft.remoteEnabled ? '启用' : '关闭'}</b></span></label>
                {/* 「显示页面」= 哪些页面出现在大屏顶部导航里，也就是原来的「页面启用开关」。
                    改版前它散在「页面配置」左栏的页面列表里（开关 + 名称框 + 排序把手三合一）。
                    今天按需求挪进「基本信息」，并且**做成和其它字段同排的一行**：
                    左边 150px 标签右对齐、右边控件 —— 直接复用 .uk-admin-field，
                    于是字号/字色/标签列宽/上间距全部自动和上面那些字段一致，不用手抄一遍。
                    （第一版做成上下结构：小标题压在一行标签上面，和上面字段的排法对不上，用户当场指出。）
                    占满 3 列（is-full）：4 个标签并排要约 400px，塞进 1/3 格（约 358px）会折行折得很难看。 */}
                <div className="uk-admin-field is-full">
                  <span>显示页面：</span>
                  <div className="uk-admin-field-control">
                    {/* 下拉多选。三个部件的分工：
                       · 值区（.uk-admin-page-picker-value）只放**已选**的页面，每个带一个可点的 ✕；
                       · 箭头按钮负责展开／收起，也是键盘用户的入口（aria-expanded 挂在它身上）；
                       · 菜单列出全部 4 页，选中项打勾，点一行只切换自己、**不关面板** ——
                         多选的价值就在这，选完点外面或按 Esc 收起。
                       值区用 div 而不是 button：里面每个 ✕ 都必须是真按钮，
                       而 button 套 button 是非法嵌套，浏览器会把内层拆出去。
                       标签用 PAGE_LABELS 固定名，**不跟页面展示名（page.name）联动**（2026-10-13 用户确认）：
                       这里和大屏导航是两个用途——这里是「选哪一页」的标识，改完名字还得认得出来；
                       改了名就跟着变的话，四个标签会一起变样，反而找不到要选的那一页。 */}
                    <div className={`uk-admin-page-picker${pagePickerOpen ? ' is-open' : ''}`}>
                      <div className="uk-admin-page-picker-value" onClick={() => setPagePickerOpen((open) => !open)}>
                        {enabledPages.length === 0
                          ? <em className="uk-admin-page-picker-empty">请选择页面</em>
                          : enabledPages.map((page) => {
                            const label = PAGE_LABELS[page.id];
                            return <span className="uk-admin-page-picker-chip" key={page.id}>
                              {label}
                              {/* 叉号移出是这个控件的常用操作，放在值区里可以不开面板就删掉。 */}
                              <button
                                type="button"
                                aria-label={`移出导航：${label}`}
                                title={`移出导航：${label}`}
                                onClick={(event) => { event.stopPropagation(); setPageEnabled(page.id, false); }}
                              >✕</button>
                            </span>;
                          })}
                      </div>
                      <button
                        type="button"
                        className="uk-admin-page-picker-caret"
                        aria-expanded={pagePickerOpen}
                        aria-controls="uk-admin-page-picker-menu"
                        aria-label={pagePickerOpen ? '收起页面列表' : '展开页面列表'}
                        onClick={() => setPagePickerOpen((open) => !open)}
                      ><Caret open={pagePickerOpen} /></button>
                      {pagePickerOpen && <div className="uk-admin-page-picker-menu" id="uk-admin-page-picker-menu" role="group" aria-label="显示页面">
                        {draft.pages.map((page) => {
                          const label = PAGE_LABELS[page.id];
                          return <button
                            key={page.id}
                            type="button"
                            className={page.enabled ? 'is-selected' : undefined}
                            aria-pressed={page.enabled}
                            onClick={() => setPageEnabled(page.id, !page.enabled)}
                          >
                            <i className="uk-admin-page-picker-tick" aria-hidden="true">{page.enabled ? <CheckMark /> : null}</i>
                            {label}
                          </button>;
                        })}
                      </div>}
                    </div>
                    {/* 说明挂在控件右侧、整行仍是「标签 — 控件」的左右结构；
                        窄屏由 .uk-admin-field-control 的 flex-wrap 把它折到控件下面。 */}
                    <small>点击展开，可多选</small>
                  </div>
                </div>
              </div>
              {draft.remoteEnabled && <div className="uk-admin-remote-config">
                <div className="uk-admin-subhead"><b>逻辑按键映射</b></div>
                <div className="uk-admin-remote-grid">{REMOTE_LABELS.map(({ id, label, hint }) => <div className="uk-admin-remote-row" key={id}>
                  <div><b>{label}</b><small>{hint}</small></div><code>{draft.remoteKeys[id] || '未设置'}</code>
                </div>)}</div>
                <p>默认映射：Enter 控制播放 / 暂停，ArrowLeft 切换上一页面，ArrowRight 切换下一页面；</p>
              </div>}
            </section>

            <section className="uk-admin-config-section">
              <h2>页面配置</h2>
              {/* 上下结构（2026-10-13 下午按需求改）。改版前是「左选右改」两栏：
                  左栏 260px 里挤着开关 + 名称框 + 排序把手三件事。
                  现在开关搬到「基本信息 · 显示页面」、名称搬到下方详情，左栏只剩「选哪一页」，
                  就不该继续常占 260px 横向空间 —— 收成一排页签。
                  页签只列**启用**的页面：停用的页不出现在大屏上，没有可配的内容；
                  在「显示页面」里取消勾选，页签立刻少一个，选中项由上面的 useEffect 弹回第一个启用页。
                  ── 关于无障碍 ──
                  这里用「一排真按钮 + aria-current」而不是 role="tablist"：
                  后者按 APG 要配套方向键漫游焦点（roving tabindex），我们不做那套，
                  就不该挂上它会承诺的语义。Tab 能逐个走、回车能切，功能上一点不缺。 */}
              {enabledPages.length === 0 ? <div className="uk-admin-empty-state">请至少启用一个页面</div> : <>
                {/* 页签文字同样用固定名，理由见上方「显示页面」——页签是"选哪一页"的入口，
                    和值区必须是同一套字，否则改名后两处对不上、更像两个东西。 */}
                <div className="uk-admin-config-tabs" aria-label="页面配置">
                  {enabledPages.map((page) => <button
                    key={page.id}
                    type="button"
                    aria-current={page.id === activePage.id ? 'true' : undefined}
                    className={page.id === activePage.id ? 'is-active' : ''}
                    onClick={() => setActivePageId(page.id)}
                  >{PAGE_LABELS[page.id]}</button>)}
                </div>
                {/* 指路牌。删掉「自定义页面名称 / 模块名称」之后，这个界面上再没有任何
                    改名的线索 —— 一个想改名的用户会在这里找不到入口，而"入口看不见"
                    正是上一轮「怎么感觉你啥都没改啊」的真实成因。所以删表单的同时补这一句，
                    位置贴着页签：他找的入口原本就在这块。 */}
                <p className="uk-admin-edit-hint">
                  页面名称、模块名称、Logo、膳食宝塔图片都改为在示意图上直接修改：点下方「配置示意图」右上角的
                  <b>「图上编辑」</b>，再点图上的标题或图片角标即可改；按 Esc 退出。
                </p>
                <div className="uk-admin-page-detail">
                {/* ── 这三块表单已删（2026-10-13 晚间，用户逐次圈出来要求）──
                    ① 「自定义页面名称」 ② 「模块名称」（这两块写 page.name / module.label）
                    ③ 「膳食宝塔图片」（写 nutritionPagodaImage）
                    它们的编辑入口都搬到了下方「配置示意图」：开「图上编辑」后，直接点大屏顶部导航的
                    页面名、面板标题、宝塔图右下角的「宝塔图片」角标就能改，
                    写回的还是同一份草稿，数据层与预览链路一个字没动。
                    删之前确认过两件事，别再当"顺手清理"复删或复建：
                    · 4 个页面（生产烹饪/营养健康/出餐统计/行为监控）都在 ADMIN_PAGE_TO_VIEW 里，
                      也就是每页的页面名都能在大屏导航上改到、模块名都能在对应面板标题上改到 ——
                      不存在"删掉唯一入口"的情况。停用的页面不出现在导航上，也就没有展示名可改。
                    · 宝塔那块里唯一的「恢复默认」按钮已经**先搬到图上**了
                      （ReplaceableImage 的 canReset），确认它在图上能用之后才删的表单。
                    ①② 在当天 14:47 被外部改动整段删过一次，当时**还没有**图上编辑，
                    删完「改模块名 → 示意图标题跟着变」就没有入口了（且不报任何错）——
                    典型的静默少功能。现在入口在图上，所以这次是"真的不要了"。
                    顶上那条提示（下方 .uk-admin-edit-hint）是给"找不到改名入口"的人留的指路牌 ——
                    入口看不见就等于不存在，这条刚踩过；以后这里再删东西，
                    务必先确认"被删的能力在别处有没有等价入口"，并把它写进这条注释。 */}
                {/* ── 「页面设置」这一整块被误删过两次，这里是还原版（2026-10-13 深夜）──
                    ① 15:40 被一条标注指令「页面设置 → 删除」删过一次（当时没删干净或后来被补回）；
                    ② 19:35 又被同样一条标注指令整段删掉，用户发现后要求恢复。
                    被删掉的是**两块真配置**，全都只有这一个入口，删了就真没地方设了：
                    · 营养健康 → 营养分析轮播间隔（nutritionCarouselSeconds）
                    · 生产烹饪 → 明厨亮灶视频流增删（kitchenStreams / addStream / setStream）
                    注意数据层（类型字段、INITIAL_CONFIG 初值、addStream/setStream）**一直没被删**，
                    所以症状是"值还在、就是没有地方改"—— 这正是最难自查的一类丢失：
                    TypeScript 不会报错（字段有人定义、没人读，合法），界面也不报错，只是少几行。
                    ⚠️ 还原时**故意没有**恢复其中的「膳食宝塔图片」那一块：
                    那块的能力（含「恢复默认」）已经按用户要求搬到示意图上了（见下方 ReplaceableImage 的
                    canReset），恢复它等于把同一件事搞出两个入口。
                    「默认餐段」曾在此处配置，现按用户要求从出餐统计页面设置中移除。 */}
                {activePage.id !== 'behavior' && <section className="uk-admin-page-behavior"><div className="uk-admin-subhead"><b>页面设置</b></div>
                    {activePage.id === 'nutrition' && <>
                      {/* 宝塔图片那块（.uk-admin-pagoda-setting）**不要**在这里复建：能力已在图上。
                          只保留轮播间隔 —— 它在图上没有任何对应物，是纯后台参数。 */}
                      <label className="uk-admin-setting-inline"><span>{activePage.modules.find((module) => module.key === 'nutrition-analysis')?.label || '营养分析'} 轮播间隔</span><span className="uk-admin-number"><input type="number" min="3" max="120" value={draft.nutritionCarouselSeconds} onChange={(event) => updateDraft({ nutritionCarouselSeconds: Number(event.target.value) })} /><b>秒</b></span></label>
                    </>}
                    {activePage.id === 'production' && <div className="uk-admin-stream-config"><div className="uk-admin-stream-head"><b>{activePage.modules.find((module) => module.key === 'production-kitchen')?.label || '明厨亮灶'}视频流</b><button type="button" onClick={addStream}>＋ 添加视频流</button></div>
                      {/* ── 播放方式（2026-10-13 深夜新增，用户要求）──
                          多画面时可切「网格平铺 / 轮播」；选轮播才出现「轮播间隔」；
                          只有 1 路画面时整组禁用，并在旁边写明为什么（singleStream 的判定在上方算）。
                          两个刻意的设计取舍：
                          · 用两个按钮（aria-pressed）而不是一个来回切的开关 —— 选项共两个、
                            且要能一眼看出"现在选的是哪个"，分段按钮比开关更不容易看错。
                          · 轮播间隔**只在选轮播时出现**，不是"出现但灰着"：它是轮播的从属参数，
                            选平铺时它没有意义，灰着只会让人去猜"为什么点不动"。
                            这和单路禁用不一样 —— 那是"暂时用不上"，这是"当前根本无关"。 */}
                      <div className="uk-admin-stream-mode">
                        <span className="uk-admin-stream-mode-label">播放方式</span>
                        <div className="uk-admin-seg" role="group" aria-label="视频流播放方式">
                          {([['grid', '网格平铺'], ['carousel', '轮播']] as const).map(([value, label]) => <button
                            key={value}
                            type="button"
                            disabled={singleStream}
                            className={draft.streamLayout === value ? 'is-active' : ''}
                            aria-pressed={draft.streamLayout === value}
                            onClick={() => updateDraft({ streamLayout: value })}
                          >{label}</button>)}
                        </div>
                        {draft.streamLayout === 'carousel' && <span className="uk-admin-stream-interval">
                          <span>轮播间隔</span>
                          <span className="uk-admin-number">
                            <input
                              type="number" min="3" max="120" disabled={singleStream}
                              aria-label="视频流轮播间隔（秒）"
                              value={draft.streamCarouselSeconds}
                              onChange={(event) => updateDraft({ streamCarouselSeconds: Number(event.target.value) })}
                            /><b>秒</b>
                          </span>
                        </span>}
                        {singleStream && <small className="uk-admin-stream-mode-hint">当前只有 1 路画面，无需设置</small>}
                      </div>
                      {draft.kitchenStreams.map((stream) => <div className="uk-admin-stream-row" key={stream.id}><input aria-label="视频流名称" placeholder="画面名称" value={stream.name} onChange={(event) => setStream(stream.id, { name: event.target.value })} /><input aria-label="视频流地址" placeholder="请输入视频流地址（如 RTSP）" value={stream.url} onChange={(event) => setStream(stream.id, { url: event.target.value })} /><button type="button" aria-label="删除视频流" disabled={draft.kitchenStreams.length <= 1} onClick={() => updateDraft({ kitchenStreams: draft.kitchenStreams.filter((item) => item.id !== stream.id) })}>删除</button></div>)}
                    </div>}
                  </section>}
                </div>
                {/* 「配置示意图」放在详情下方独自一行。它原来写的是 grid-column:1/-1「跨两栏」——
                    那是为上一版左右两栏布局服务的；现在整块已经是一条竖直流，
                    跨栏属性既没作用也会误导，改成只留上分隔线 + 上间距。
                    subhead 保留页面名：它离页签隔着「页面设置」一整块 + 一行指路牌，
                    只写「配置示意图」看不出在预览哪一页。
                    这个页面名同样用**固定名**（2026-10-13 用户确认，与「显示页面」「页签」同一条规则）：
                    它和下面那行「驾驶舱名 / 页面名」都是"现在预览的是哪一页"的标识，不是大屏上的展示名。
                    大屏展示名只看 iframe 里的顶部导航 —— 那才是页面上改名后生效的地方。 */}
                <section className="uk-admin-preview-block">
                  <div className="uk-admin-subhead">
                    <b>{PAGE_LABELS[activePage.id]} · 配置示意图</b>
                    {/* 「图上编辑」开关放在示意图自己的标题行里，而不是另起一块：
                        它作用的对象就是这个框，放一起才不用先想「这个开关管的是哪儿」。
                        按钮做成了**有底色 + 图标**的样子（第一版是白底浅边框 12px 小字，
                        用户扫过去没看见，反馈"啥都没改"）—— 入口能不能被看见，是这版的重点。 */}
                    <button
                      type="button"
                      className={`uk-admin-image-edit${previewEdit ? ' is-on' : ''}`}
                      aria-pressed={previewEdit}
                      onClick={() => setPreviewEdit((on) => !on)}
                    >
                      {previewEdit ? <ExitIcon /> : <PencilIcon />}
                      {previewEdit ? '退出图上编辑' : '图上编辑'}
                    </button>
                  </div>
                  {previewEdit && <p className="uk-admin-edit-hint">
                    直接点示意图上的标题改字：面板标题、顶部导航的页面名、左上角驾驶舱名称；
                    点 Logo 右下角的圆形角标可以换 Logo，营养健康页的宝塔图同理。
                    改的就是同一份草稿，预览里立刻生效；按 Esc 退出。
                  </p>}
                  <div className="uk-admin-image-config">
                    {/* 前半个是驾驶舱名（基本信息里那个输入框），跟页面展示名无关，照旧走 draft.name；
                        后半个是页面名，用固定名 —— 理由同上。
                        两个名字都只在图上改：驾驶舱名点左上角那行字，页面名点顶部导航那一项。 */}
                    <div className="uk-admin-image-head"><span>{draft.name || '智厨驾驶舱'} / {PAGE_LABELS[activePage.id]}</span></div>
                    <LivePreviewFrame pageId={activePage.id} config={previewConfig} editMode={previewEdit} onEdit={applyPreviewEdit} onExit={exitPreviewEdit} />
                  </div>
                </section>
              </>}
            </section>
          </div>
          <footer className="uk-admin-editor-foot"><button type="button" onClick={saveDraft}>保存草稿</button><button className="is-primary" type="button" onClick={publish}>发布配置</button></footer>
        </section>
      </div>
    </main>
    {toast && <div className="uk-admin-toast" role="status">{toast}</div>}
  </div>;
}
