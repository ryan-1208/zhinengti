/**
 * @name 客户驾驶舱需求 2
 *
 * 数据口径：本页全部为**静态结构演示数据**，未接入任何真实系统。
 * 按 PRD 对齐：
 * - PRD:129 / AC08：演示数据显式标注；无数据源时不显示「实时连接」「设备运行中」等无依据状态。
 * - PRD:189：不显示虚构的任务百分比、当前批次或剩余时间；说明性动画标注为「流程演示」。
 * - PRD:32：未接入数据不显示为实时数据。
 * - PRD:111：数量未知时不显示数量。
 * 今日出餐量采用“演示动态”递增，用于展示实际 / 计划 / 完成率的联动；
 * 增量与料箱到达出口的时刻绑定，现场接入后由真实出餐事件替换。
 *
 * 页内切换：顶部提供「驾驶舱 / 行为监控」两个视图（本页演示讲解用，
 * 与 PRD 中由 iPad 切页的五页体系并行，不替代该体系）。
 * 智厨生产驾驶舱通过 page=overview 进入；旧的 process / equipment 链接会兼容回落到这个合并页。
 * 行为监控视图的数据口径见 ./components/BehaviorView.tsx。
 */
import React, { useEffect, useState } from 'react';
import { BehaviorView } from './components/BehaviorView';
import './style.css';
import kitchenImage from './assets/realtime-kitchen.png';

type MealSegment = '早餐' | '午餐' | '晚餐' | '宵夜' | '其他';
type Dish = { segment: MealSegment; name: string; done: number; total: number; onTimeDone: number; color: string; feedKg?: number };
type Machine = { id: string; dish: string; state: string; color: string };
type OutItem = { port: string; dish: string; qty: string; color: string };
type WorkOrderStatus = '未开始' | '待称重' | '称重中' | '待加料' | '加料中' | '称重加料完成' | '待摆盆' | '摆盆中' | '摆盆完成' | '待烹饪' | '预热中' | '烹饪中' | '烹饪完成' | '开始出餐' | '出餐完成' | '取餐中' | '取餐完成' | '已作废';
const LINE_CYCLE_MS = 14_000;

/** feedKg = 称重加料区实测投料量（kg）。演示口径，非客户现场数据。
    自检：合计 82.0 kg ÷ 26 盆 ≈ 3.2 kg/盆，与盆量级吻合。 */
const DISHES: Dish[] = [
  { segment: '早餐', name: '紫菜蛋汤', done: 2, total: 2, onTimeDone: 2, color: '#e0a629', feedKg: 9.8 },
  { segment: '早餐', name: '蒜蓉娃娃菜', done: 2, total: 3, onTimeDone: 2, color: '#079f96', feedKg: 5.2 },
  { segment: '早餐', name: '清炒莲藕片', done: 3, total: 3, onTimeDone: 3, color: '#e85d75', feedKg: 8.7 },
  { segment: '午餐', name: '青椒肉丝', done: 4, total: 4, onTimeDone: 4, color: '#3b8be0', feedKg: 13.2 },
  { segment: '午餐', name: '番茄炒蛋', done: 4, total: 4, onTimeDone: 4, color: '#42a885', feedKg: 12.8 },
  { segment: '午餐', name: '土豆烧牛肉', done: 3, total: 4, onTimeDone: 2, color: '#9367d8', feedKg: 9.6 },
  { segment: '午餐', name: '干锅花菜', done: 3, total: 4, onTimeDone: 3, color: '#f09a4b', feedKg: 8.4 },
  { segment: '晚餐', name: '小炒黄牛肉', done: 2, total: 3, onTimeDone: 2, color: '#6f8fe8', feedKg: 6.4 },
  { segment: '晚餐', name: '韭菜绿豆芽', done: 2, total: 3, onTimeDone: 1, color: '#d879b0', feedKg: 4.8 },
  { segment: '晚餐', name: '蚝油牛柳', done: 1, total: 3, onTimeDone: 1, color: '#56a66f', feedKg: 3.1 },
];

/** 已称重菜品与累计投料量。由数组推导而非写死，避免与明细行对不上。 */
const WEIGHED = DISHES.filter((dish) => dish.feedKg != null);
const FEED_TOTAL_KG = WEIGHED.reduce((sum, dish) => sum + (dish.feedKg ?? 0), 0);

/** 每盆约 140 份。内部进度仍以份计，界面按此比例向上取整为整盆。 */
const PORTIONS_PER_TRAY = 140;
const portionsToTrays = (portions: number) => Math.max(0, Math.ceil(portions / PORTIONS_PER_TRAY));
const formatTrays = (portions: number) => portionsToTrays(portions).toLocaleString('zh-CN');
const formatTrayTotal = (trays: number, portions: number) => formatTrays(trays * PORTIONS_PER_TRAY + portions);
/** 今日计划总份数（演示口径：26 盆 × 140 份 = 3640 份） */
const TOTAL_PLAN = DISHES.reduce((sum, dish) => sum + dish.done * PORTIONS_PER_TRAY, 0);
/** 今日出餐初始值（演示口径，随后按动线到达出口的批次递增） */
const SERVED = 3182;
const DEMO_TEMPORARY_ADD_ORDERS = 0;

/** 近 7 天出餐趋势（演示口径）。v = 当日出餐份数，最后一天以当前今日出餐量更新。
    柱高不手写，由 v 按峰值归一化推导——否则「柱子高矮」和「柱顶数字」很容易自相矛盾。
    自检：今日 3182 vs 去年同期 ↑12.4% → 去年同期应为 3182 / 1.124 ≈ 2831，量级吻合。 */
const SPARK_TREND = [
  { label: '09-17', v: 2386 },
  { label: '09-18', v: 2584 },
  { label: '09-19', v: 2287 },
  { label: '09-20', v: 2783 },
  { label: '09-21', v: 2650 },
  { label: '09-22', v: 2915 },
  { label: '09-23', v: SERVED },
];

/** 最高一根柱占图表带的比例。上限 70% 是给柱顶的数值标签让位：
    图表带 48px → 标签 11px + 间距 2px ≈ 13px，33.6px 柱高 + 13px 正好贴顶不溢出。 */
const SPARK_MAX_H = 70;
const MACHINES: Machine[] = [
  { id: '炒菜机 CCJ1', dish: '青椒肉丝', state: '烹饪中', color: '#3b8be0' },
  { id: '炒菜机 CCJ2', dish: '番茄炒蛋', state: '烹饪中', color: '#42a885' },
  { id: '炒菜机 CCJ3', dish: '土豆烧牛肉', state: '待出餐', color: '#9367d8' },
  { id: '炒菜机 CCJ4', dish: '干锅花菜', state: '烹饪中', color: '#f09a4b' },
  { id: '烤箱 KX1', dish: '蒜蓉娃娃菜', state: '待出餐', color: '#079f96' },
  { id: '烤箱 KX2', dish: '清炒莲藕片', state: '烹饪中', color: '#e85d75' },
];

const OUTFLOW: OutItem[] = [
  { port: '出口 1', dish: '清炒莲藕片', qty: `${formatTrayTotal(3, 75)} 盆`, color: '#e85d75' },
  { port: '出口 2', dish: '土豆烧牛肉', qty: `${formatTrayTotal(2, 50)} 盆`, color: '#9367d8' },
  { port: '出口 1', dish: '番茄炒蛋', qty: `${formatTrayTotal(3, 75)} 盆`, color: '#42a885' },
  { port: '出口 2', dish: '青椒肉丝', qty: `${formatTrayTotal(2, 50)} 盆`, color: '#3b8be0' },
  { port: '出口 1', dish: '紫菜蛋汤', qty: `${formatTrayTotal(2, 50)} 盆`, color: '#e0a629' },
  { port: '出口 2', dish: '干锅花菜', qty: `${formatTrayTotal(1, 25)} 盆`, color: '#f09a4b' },
];

const MEAL_ORDER: MealSegment[] = ['早餐', '午餐', '晚餐', '宵夜', '其他'];
const DISH_GROUPS = MEAL_ORDER.map((segment) => ({ segment, dishes: DISHES.filter((dish) => dish.segment === segment) })).filter((group) => group.dishes.length > 0);
const WORK_ORDER_STATUS_OPTIONS = ['全部', '未开始', '待称重', '称重中', '待加料', '加料中', '称重加料完成', '待摆盆', '摆盆中', '摆盆完成', '待烹饪', '预热中', '烹饪中', '烹饪完成', '开始出餐', '出餐完成', '取餐中', '取餐完成', '已作废'] as const;
const WORK_ORDER_SEGMENT_OPTIONS = ['全部', '早餐', '午餐', '晚餐', '宵夜', '其他'] as const;
const WORK_ORDER_MODE_OPTIONS = ['全部', '临时加菜', '计划烹饪'] as const;
type WorkOrderStatusFilter = typeof WORK_ORDER_STATUS_OPTIONS[number];
type WorkOrderSegmentFilter = typeof WORK_ORDER_SEGMENT_OPTIONS[number];
type WorkOrderModeFilter = typeof WORK_ORDER_MODE_OPTIONS[number];
const WORK_ORDER_STATUS_GROUPS: Array<{ label: string; options: WorkOrderStatus[] }> = [
  { label: '称重前', options: ['未开始'] },
  { label: '开始称重', options: ['待称重', '称重中', '待加料', '加料中', '称重加料完成'] },
  { label: '开始摆盆', options: ['待摆盆', '摆盆中', '摆盆完成'] },
  { label: '开始烹饪', options: ['待烹饪', '预热中', '烹饪中', '烹饪完成'] },
  { label: '烹饪结束后', options: ['开始出餐', '出餐完成', '取餐中', '取餐完成'] },
  { label: '工单作废', options: ['已作废'] },
];
const STATIC_WORKFLOW_STAGES = [
  { label: '称重前', value: 5, note: '未开始', color: '#70b5ff' },
  { label: '开始称重', value: 8, note: '待称重 / 称重中 / 待加料 / 加料中 / 称重加料完成', color: '#ff9700' },
  { label: '开始摆盆', value: 6, note: '待摆盆 / 摆盆中 / 摆盆完成', color: '#b58aff' },
  { label: '开始烹饪', value: 9, note: '待烹饪 / 预热中 / 烹饪中 / 烹饪完成', color: '#25e0ee' },
  { label: '烹饪结束后', value: 5, note: '开始出餐 / 出餐完成 / 取餐中 / 取餐完成', color: '#4ff0ad' },
] as const;
const STATIC_WORKFLOW_TOTAL = STATIC_WORKFLOW_STAGES.reduce((sum, item) => sum + item.value, 0);
const STATIC_VOID_ORDERS = 0;

/** 产线动线演示：主线到摆盆区后分流到具体设备，再汇入指定出口。
    演示批次只负责表达“路线如何走”，接入现场数据后由设备与出口 ID 替换。 */
const DEVICE_ROUTE_PATHS = [
  'M350 240 C382 240 402 178 429 162',
  'M350 240 C414 240 462 198 503 162',
  'M350 240 C468 240 548 196 577 162',
  'M350 240 C520 240 604 194 651 162',
  'M350 240 C410 240 450 274 476 318',
  'M350 240 C468 240 558 274 604 318',
] as const;

const ACTIVE_ROUTE_PATHS = [
  // 各路线移动段按路径长度分配时间，避免同一周期内出现忽快忽慢；设备停留统一约 2.5 秒。
  { id: 'route-ccj1-out1', dish: '青椒肉丝', port: '出口 1', increment: 75, path: 'M125 240 H350 C382 240 402 178 429 162 C520 102 680 102 760 118 V162 H850', delay: '-3s', trayStart: 0.096, trayEnd: 0.226, pauseStart: 0.342, pauseEnd: 0.522, keyPoints: '0;0.417;0.417;1', keyTimes: '0;0.342;0.522;1' },
  { id: 'route-ccj4-out1', dish: '干锅花菜', port: '出口 1', increment: 75, path: 'M125 240 H350 C520 240 604 194 651 162 C700 132 730 118 760 118 V162 H850', delay: '-7s', trayStart: 0.098, trayEnd: 0.232, pauseStart: 0.558, pauseEnd: 0.738, keyPoints: '0;0.681;0.681;1', keyTimes: '0;0.558;0.738;1' },
  { id: 'route-ccj3-out2', dish: '土豆烧牛肉', port: '出口 2', increment: 50, path: 'M125 240 H350 C468 240 548 196 577 162 C640 170 700 246 760 318 H850', delay: '-11s', trayStart: 0.097, trayEnd: 0.229, pauseStart: 0.479, pauseEnd: 0.659, keyPoints: '0;0.584;0.584;1', keyTimes: '0;0.479;0.659;1' },
].map((route) => ({
  ...route,
  color: DISHES.find((dish) => dish.name === route.dish)?.color ?? '#10e4f2',
}));

/* 原「平均出餐时长」常量已移除。它是写死的演示值、没有任何计算逻辑，
   也不在 PRD 的运营驾驶舱指标清单里（PRD:194）。移除理由与「日后要放回需先定什么」
   记在 style.css 的 .uk-kpi 注释处。 */

type ViewId = 'cockpit' | 'behavior' | 'overview' | 'process' | 'equipment';

function readViewFromLocation(): ViewId {
  if (typeof window === 'undefined') return 'cockpit';
  const page = new URLSearchParams(window.location.search).get('page');
  if (page === 'behavior') return 'behavior';
  if (page === 'overview' || page === 'process' || page === 'equipment') return 'overview';
  return 'cockpit';
}

function normalizeViewId(id: string): ViewId {
  if (id === 'behavior') return 'behavior';
  if (id === 'overview' || id === 'process' || id === 'equipment') return 'overview';
  return 'cockpit';
}

const TOP_NAV_ITEMS: Array<{ id: ViewId; label: string }> = [
  { id: 'cockpit', label: '总览' },
  { id: 'overview', label: '计划与进度' },
  { id: 'behavior', label: '行为监控' },
];

function PageTopNav({ current, onNavigate }: { current: ViewId; onNavigate: (id: string) => void }) {
  return (
    <nav className="uk-switch uk-page-nav" aria-label="智厨页面切换">
      {TOP_NAV_ITEMS.map((item) => (
        <button
          type="button"
          key={item.id}
          className={current === item.id ? 'active' : ''}
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function TopHeader({ current, clock, onNavigate }: { current: ViewId; clock: string; onNavigate: (id: string) => void }) {
  return (
    <header className="uk-top">
      <div className="uk-brand">
        <div className="uk-logo">智</div>
        <div>
          <h1>智慧厨房驾驶舱</h1>
          <p className="uk-brand-subtitle">后厨管理 · 设备协同</p>
        </div>
      </div>
      <PageTopNav current={current} onNavigate={onNavigate} />
      <div className="uk-meta">
        <span className="uk-clock">{clock}</span>
      </div>
    </header>
  );
}

type CockpitModuleProps = {
  current: ViewId;
  clock: string;
  onNavigate: (id: string) => void;
  children: React.ReactNode;
};

function CockpitModuleShell({ current, clock, onNavigate, children }: CockpitModuleProps) {
  return (
    <div className="uk-module-page">
      <TopHeader current={current} clock={clock} onNavigate={onNavigate} />
      {children}
    </div>
  );
}

function ModuleKpi({ label, value, note, tone = '' }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className={`uk-module-kpi ${tone}`.trim()}>
      <span>{label}</span>
      <b>{value}</b>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

type MultiSelectGroup = { label?: string; options: readonly string[] };

function MultiSelectFilter({ label, selected, groups, onChange }: { label: string; selected: readonly string[]; groups: readonly MultiSelectGroup[]; onChange: (values: string[]) => void }) {
  const isAllSelected = selected.includes('全部');
  const summary = isAllSelected ? '全部' : selected.length === 1 ? selected[0] : `${selected.length} 项已选`;
  const toggle = (value: string) => {
    if (value === '全部') {
      onChange(['全部']);
      return;
    }
    if (isAllSelected) {
      onChange([value]);
      return;
    }
    const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    onChange(next.length ? next : ['全部']);
  };
  return (
    <div className="uk-multi-filter">
      <span>{label}</span>
      <details>
        <summary>{summary}<b>⌄</b></summary>
        <div className="uk-multi-filter-menu">
          <label><input type="checkbox" checked={isAllSelected} onChange={() => toggle('全部')} />全部</label>
          {groups.map((group) => (
            <fieldset key={group.label ?? group.options.join('-')}>
              {group.label && <legend>{group.label}</legend>}
              {group.options.map((option) => <label key={option}><input type="checkbox" checked={!isAllSelected && selected.includes(option)} onChange={() => toggle(option)} />{option}</label>)}
            </fieldset>
          ))}
        </div>
      </details>
    </div>
  );
}

type ModuleSharedData = {
  servedNow: number;
  totalPlan: number;
  serveRate: number;
  dishes: Dish[];
  machines: Machine[];
  trend: Array<{ label: string; v: number }>;
  outflow: OutItem[];
  dishState: (dish: Dish) => string;
  workOrderStatus: (dish: Dish) => WorkOrderStatus;
};

/* ============ 计划完成率趋势：区间切换 + 日期切换 ============ */

const TREND_RANGES = [
  { id: 'today', label: '今日', note: '按小时' },
  { id: 'week', label: '近 7 日', note: '按日' },
  { id: 'month', label: '近一个月', note: '按日' },
  { id: 'year', label: '近一年', note: '按月' },
] as const;
type TrendRangeId = (typeof TREND_RANGES)[number]['id'];

type TrendPoint = { label: string; value: number };

/* 趋势图坐标系（viewBox 单位）。三个 Y 常量必须一起改。
   ⚠️ viewBox 的**宽高比**必须贴近容器宽高比，否则 SVG 会等比缩放留白
   （容器 718×215 → 比例 3.34，所以这里用 720×215）。 */
const TREND_VB_W = 720;
const TREND_VB_H = 215;
const TREND_X_L = 70;      // 首点 x（左侧留给刻度值）
const TREND_X_R = 670;     // 末点 x
const TREND_Y_TOP = 32;    // 轴顶（最高刻度）
const TREND_Y_BOT = 170;   // 轴底（最低刻度）
const TREND_Y_LABEL = 200; // 日期标签基线

const pad2 = (n: number) => String(n).padStart(2, '0');
const toISODate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const shiftDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** 32 位字符串哈希（FNV-1a）→ 0~1 的稳定伪随机数 */
function hashUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** 演示完成率 = **平滑基线** + **小幅抖动**。
    基线按「序号」用两条正弦缓慢漂移（周期 9.2 / 23.7），让相邻日期彼此接近；
    抖动来自哈希噪声（±3.5）。

    三个「为什么」：
    ① **基线要以当日真实完成率为中心**（center），不能写死一个数。
       写死 82 而当日实际是 78.8 时，历史均值会比末点高 6~8 个点，
       看上去就成了「今天突然变差」—— 而这是我们编出来的，不是真的。
       center 也做上下限保护：筛选筛选到没有工单时 completionRate 会是 0，
       不保护的话整条历史会被压到地板值上变成一条平线。
    ② 不能只用纯哈希噪声 —— 相邻两天毫无关联，画出来是尖锯齿，
       不像真实的完成率（现实里好日子连着好、差日子连着差）。
    ③ 不能用 Math.random() —— 同一日期必须每次算出同一个值，否则重渲染、切区间、刷新就变，
       截图汇报两张图对不上，还会出现「同一日期昨天 82%、今天 71%」（AC05 / AC13）。

    ordinal 的单位随区间而变：日 = 天序号；小时 = 天序号×24 + 时；月 = 年×12 + 月。
    这样同一天的各小时、同一月的各天都会落在相近的基线上，只有抖动在变。 */
function demoRate(seed: string, ordinal: number, center: number): number {
  const base = Math.min(90, Math.max(74, center));
  const baseline = base + Math.sin(ordinal / 9.2) * 4.5 + Math.sin(ordinal / 23.7) * 2.5;
  const value = baseline + (hashUnit(seed) - 0.5) * 7;
  return Math.round(Math.min(96, Math.max(66, value)) * 10) / 10;
}

const dayOrdinalOf = (d: Date) => Math.round(d.getTime() / 86_400_000);

/* ---- 单个「桶」的完成率：趋势图与 KPI 卡片**共用同一套算法** ----
   为什么要把这两行抽出来：KPI 卡片加了区间之后，同一屏上会出现
   「卡片写近 7 日 81.5%、趋势图脚注写近 7 日均值 81.5%」这种**必须逐字相同**的数字。
   两处各写一份 demoRate 调用，早晚会因为只改了一处而错开一位小数，
   到时候查起来极难 —— 所以「某一天的完成率」「某个月的完成率」只从这里出。 */
function dayBucketRate(d: Date, todayISO: string, todayRate: number): number {
  const iso = toISODate(d);
  return iso === todayISO ? todayRate : demoRate(iso, dayOrdinalOf(d), todayRate);
}

function monthBucketRate(d: Date, todayISO: string, todayRate: number): number {
  const key = `M${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  return key === `M${todayISO.slice(0, 7)}` ? todayRate : demoRate(key, d.getFullYear() * 12 + d.getMonth(), todayRate);
}

/** 「及时完成率」的演示序列。
    不能直接套 demoRate —— 它的基线夹在 74~90，而及时完成率常态在 92% 上下，
    套进去会被 90 顶格压平，看去像「历史上一次都没及时过」。
    做法与 demoRate 完全一致（确定性哈希 + 平滑基线，中心挂当日真实值），
    只是换了量纲、周期和上下限 —— 别为了省一个函数把它硬塞进 demoRate。 */
function demoOnTimeRate(seed: string, ordinal: number, center: number): number {
  const base = Math.min(96, Math.max(84, center));
  const baseline = base + Math.sin(ordinal / 11.3) * 2.4 + Math.sin(ordinal / 29.1) * 1.5;
  const value = baseline + (hashUnit(seed) - 0.5) * 3.6;
  return Math.round(Math.min(99, Math.max(76, value)) * 10) / 10;
}

/** 按区间与锚定日期生成趋势序列。
    锚定日期 = 窗口的**结束日**；选「今日」表示看该日的分时曲线。
    锚定到当天时，最后一点用页面真实完成率（与顶部 KPI 同源），其余点走演示值 ——
    否则同屏会出现「KPI 说 78.8%、趋势图末尾说 82%」这种对不上账的情况。 */
function buildTrendSeries(
  range: TrendRangeId,
  anchorISO: string,
  todayISO: string,
  todayRate: number,
  nowHour: number,
): TrendPoint[] {
  const isToday = anchorISO === todayISO;
  const anchor = new Date(`${anchorISO}T00:00:00`);
  const points: TrendPoint[] = [];

  if (range === 'today') {
    // 当天只画到**当前小时**为止：显示 24:00 等于编造尚未发生的数据（PRD:189 的精神）
    const lastHour = isToday ? Math.max(7, nowHour) : 20;
    const dayOrdinal = dayOrdinalOf(anchor);
    for (let h = 6; h <= lastHour; h += 1) {
      points.push({
        label: `${pad2(h)}:00`,
        value: isToday && h === lastHour ? todayRate : demoRate(`${anchorISO}T${pad2(h)}`, dayOrdinal * 24 + h, todayRate),
      });
    }
    return points;
  }

  if (range === 'week' || range === 'month') {
    const days = range === 'week' ? 7 : 30;
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = shiftDays(anchor, -i);
      // 走 dayBucketRate：KPI 卡片算区间总量时用的是同一个函数，两边不会错开
      points.push({ label: toISODate(d).slice(5), value: dayBucketRate(d, todayISO, todayRate) });
    }
    return points;
  }

  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    points.push({ label: `${d.getMonth() + 1}月`, value: monthBucketRate(d, todayISO, todayRate) });
  }
  return points;
}

/* ============ KPI 卡片行：区间切换 ============ */

type KpiRangeTotals = {
  planned: number;
  completed: number;
  onTime: number;
  completionRate: number;
  timelyRate: number;
  bucketCount: number;
  unit: string;
};

/** 把「每天的率」聚合成区间总量。口径三条，都是为了让卡片和趋势图对得上账：
    ① **计划量 = 当日筛选后的计划工单量 × 天数** —— 不给历史编造每日计划波动。
       多一个凭空的数字，就多一个客户会问「这数怎么来的、算法是什么」的问题。
    ② **完成率直接取各桶率的算术均值** —— 与趋势图脚注那个「均值」是同一个数，
       逐字相同。若改成 Σ完成/Σ计划，四舍五入会差出 0.2 个点，同屏两个值又要解释。
    ③ **完成量由该均值反推**（而不是先算每天的完成量再求和）——
       这样「完成量 ÷ 计划量」也同时成立，卡片自己的注解不会打自己的脸。 */
function aggregateKpiRange(planneds: number[], rates: number[], timelyRates: number[], unit: string): KpiRangeTotals {
  const mean = (xs: number[]) => xs.reduce((sum, v) => sum + v, 0) / (xs.length || 1);
  const planned = Math.round(planneds.reduce((sum, v) => sum + v, 0));
  const completionRate = Math.round(mean(rates) * 10) / 10;
  const timelyRate = Math.round(mean(timelyRates) * 10) / 10;
  const completed = Math.round((planned * completionRate) / 100);
  const onTime = Math.round((completed * timelyRate) / 100);
  return { planned, completed, onTime, completionRate, timelyRate, bucketCount: rates.length, unit };
}

/** KPI 卡片的区间总量。
    - 区间与锚定日期的定义与趋势图**完全一致**（锚定日 = 窗口结束日）。
    - 但两处是**各自独立的控件**：卡片默认「今日」、趋势图默认「近 7 日」，
      因为卡片的默认视角就是今天这一班，切区间是「回头看看」而不是默认视角。 */
function buildKpiRangeTotals(
  range: TrendRangeId,
  anchorISO: string,
  todayISO: string,
  base: { planned: number; completed: number; onTime: number },
): KpiRangeTotals {
  const anchor = new Date(`${anchorISO}T00:00:00`);
  const empty: KpiRangeTotals = { planned: 0, completed: 0, onTime: 0, completionRate: 0, timelyRate: 0, bucketCount: 0, unit: '天' };
  /* 当日筛选后没有工单（例如只勾了「宵夜」，而宵夜本来就没有菜品）→
     整个区间也不该凭空生出数字。不加这道闸，卡片会显示 0、而趋势图仍画着 80% 一条线。 */
  if (!base.planned) return empty;

  const completionCenter = Math.round((base.completed / base.planned) * 1000) / 10;
  const timelyCenter = base.completed ? Math.round((base.onTime / base.completed) * 1000) / 10 : 0;
  const dailyPlan = base.planned;

  if (range === 'today') {
    if (anchorISO === todayISO) {
      return {
        planned: base.planned,
        completed: base.completed,
        onTime: base.onTime,
        completionRate: completionCenter,
        timelyRate: timelyCenter,
        bucketCount: 1,
        unit: '天',
      };
    }
    /* 历史某一天：取该日当天值的**全天口径**（不按小时切，KPI 是日总量）。
       这里刻意用 `${iso}T20` 这个 seed 与序号 20 时 —— 与趋势图选「今日」看历史某天时
       分时曲线的**末点**同一个值，保证那时卡片和折线末尾对得上。 */
    const rate = demoRate(`${anchorISO}T20`, dayOrdinalOf(anchor) * 24 + 20, completionCenter);
    const timely = demoOnTimeRate(`${anchorISO}T20-ontime`, dayOrdinalOf(anchor) * 24 + 20, timelyCenter);
    return aggregateKpiRange([dailyPlan], [rate], [timely], '天');
  }

  if (range === 'week' || range === 'month') {
    const bucketCount = range === 'week' ? 7 : 30;
    const planneds: number[] = [];
    const rates: number[] = [];
    const timelyRates: number[] = [];
    for (let i = bucketCount - 1; i >= 0; i -= 1) {
      const d = shiftDays(anchor, -i);
      const iso = toISODate(d);
      planneds.push(dailyPlan);
      // 与趋势图逐点同源（dayBucketRate），所以卡片的「完成率」= 趋势图脚注的「均值」
      rates.push(dayBucketRate(d, todayISO, completionCenter));
      timelyRates.push(iso === todayISO ? timelyCenter : demoOnTimeRate(`${iso}-ontime`, dayOrdinalOf(d), timelyCenter));
    }
    return aggregateKpiRange(planneds, rates, timelyRates, '天');
  }

  /* 近一年：按**月**聚合（与趋势图的月度视图同粒度）。
     月度计划量 = 当月天数 × 日计划量 —— 别的月份该有多少工单我们并不知道，
     但「天数×日均」至少是个能当面解释清楚的算法。 */
  const planneds: number[] = [];
  const rates: number[] = [];
  const timelyRates: number[] = [];
  const currentMonthKey = `M${todayISO.slice(0, 7)}`;
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const key = `M${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    planneds.push(dailyPlan * daysInMonth);
    rates.push(monthBucketRate(d, todayISO, completionCenter));
    timelyRates.push(key === currentMonthKey ? timelyCenter : demoOnTimeRate(`${key}-ontime`, d.getFullYear() * 12 + d.getMonth(), timelyCenter));
  }
  return aggregateKpiRange(planneds, rates, timelyRates, '个月');
}

function ProductionOverviewModule({ data, clock, onNavigate }: { data: ModuleSharedData; clock: string; onNavigate: (id: string) => void }) {
  const [statusFilters, setStatusFilters] = useState<WorkOrderStatusFilter[]>(['全部']);
  const [segmentFilters, setSegmentFilters] = useState<WorkOrderSegmentFilter[]>(['全部']);
  const [modeFilters, setModeFilters] = useState<WorkOrderModeFilter[]>(['全部']);
  const statusFilterIsAll = statusFilters.includes('全部');
  const segmentFilterIsAll = segmentFilters.includes('全部');
  const modeFilterIsAll = modeFilters.includes('全部');
  const modeHasDemoRows = modeFilterIsAll || modeFilters.includes('计划烹饪');
  const filteredDishes = data.dishes.filter((dish) => {
    const matchesSegment = segmentFilterIsAll || segmentFilters.includes(dish.segment);
    const matchesStatus = statusFilterIsAll || statusFilters.includes(data.workOrderStatus(dish));
    return matchesSegment && matchesStatus && modeHasDemoRows;
  });
  const mealSegments = segmentFilterIsAll ? MEAL_ORDER : MEAL_ORDER.filter((segment) => segmentFilters.includes(segment));
  const mealPlan = mealSegments.map((segment) => {
    const dishes = filteredDishes.filter((dish) => dish.segment === segment);
    const planned = dishes.reduce((sum, dish) => sum + dish.total, 0);
    const completed = dishes.reduce((sum, dish) => sum + dish.done, 0);
    return { segment, dishes: dishes.length, planned, completed, pending: Math.max(0, planned - completed) };
  });
  const totalPlanned = mealPlan.reduce((sum, meal) => sum + meal.planned, 0);
  const totalCompleted = mealPlan.reduce((sum, meal) => sum + meal.completed, 0);
  const totalPending = Math.max(0, totalPlanned - totalCompleted);
  const maxPlanned = Math.max(...mealPlan.map((meal) => meal.planned), 1);
  const completionRate = totalPlanned ? (totalCompleted / totalPlanned) * 100 : 0;
  const hasVisibleWorkOrders = filteredDishes.length > 0;
  const onTimeCompleted = filteredDishes.reduce((sum, dish) => sum + dish.onTimeDone, 0);
  /* 原「及时完成率」「计划烹饪数量」两个单值常量已并入下面的 kpiTotals：
     卡片区间化之后，它们都要跟着窗口变，单独留一份「今日」口径的常量只会悄悄跑偏。
     口径等价性：modeFilters 只剩「临时加菜」时 filteredDishes 为空 → totalPlanned 为 0，
     kpiTotals 同样走 0 分支，所以「计划烹饪数量」= kpiTotals.planned 与原逻辑一致。 */
  const temporaryAddCount = modeFilters.includes('临时加菜') ? DEMO_TEMPORARY_ADD_ORDERS : 0;
  // ---- 计划完成率趋势：区间 / 日期切换 ----
  const todayISO = toISODate(new Date());
  const [trendRange, setTrendRange] = useState<TrendRangeId>('week');
  const [trendAnchor, setTrendAnchor] = useState(todayISO);
  const trendSeries = buildTrendSeries(trendRange, trendAnchor, todayISO, Math.round(completionRate * 10) / 10, new Date().getHours());
  const trendCount = trendSeries.length;
  const trendValues = trendSeries.map((point) => point.value);
  const trendAvg = trendValues.reduce((sum, v) => sum + v, 0) / trendCount;

  /* 纵轴范围由数据推出来，不写死 60~100：换到「今日」「近一年」后数据区间会变，
     写死的轴要么把点顶出画面，要么把波动压平。取整到 10 的倍数 + 上下各留 3 个点余量；
     跨度不足 20 时撑到 20，避免几个点的正常抖动被放大成悬崖。 */
  let axisMin = Math.max(0, Math.floor((Math.min(...trendValues) - 3) / 10) * 10);
  let axisMax = Math.min(100, Math.ceil((Math.max(...trendValues) + 3) / 10) * 10);
  if (axisMax - axisMin < 20) {
    axisMin = Math.max(0, axisMax - 20);
    axisMax = Math.min(100, axisMin + 20);
  }
  const axisSpan = Math.max(10, axisMax - axisMin);
  const axisTicks: number[] = [];
  for (let v = axisMax; v >= axisMin; v -= 10) axisTicks.push(v);
  /* 刻度线与折线共用 yOf()：两套各算各的，迟早出现「线画在一处、刻度标在另一处」 */
  const yOf = (v: number) => TREND_Y_BOT - ((v - axisMin) / axisSpan) * (TREND_Y_BOT - TREND_Y_TOP);
  /* 点的个数随区间变（今日 9~15、近 7 日 7、近一月 30、近一年 12），
     所以 x 必须按个数均匀铺开，不能再来回写死步长。 */
  const xOf = (i: number) => (trendCount <= 1 ? (TREND_X_L + TREND_X_R) / 2 : TREND_X_L + (i * (TREND_X_R - TREND_X_L)) / (trendCount - 1));
  const trendPoints = trendSeries.map((point, i) => `${xOf(i).toFixed(1)},${yOf(point.value).toFixed(1)}`).join(' ');
  /* 点多时抽稀标签，否则日期会叠成一团；末点始终显示。
     数值标签只在点少时给——30 个点全标数字必然糊成一片，此时纵向刻度已能表达量级。 */
  const labelStep = Math.max(1, Math.ceil(trendCount / 7));
  const showTick = (i: number) => i % labelStep === 0 || i === trendCount - 1;
  const showValues = trendCount <= 16;
  const trendMeta = TREND_RANGES.find((item) => item.id === trendRange) ?? TREND_RANGES[1];

  // ---- KPI 卡片行：区间 / 日期切换（默认「今日」）----
  //      与趋势图共用同一组区间定义，但**状态各自独立**：
  //      趋势图默认「近 7 日」（看走势），卡片默认「今日」（看今天这一班）。
  //      两处各自标注自己的口径，所以同屏出现不同的窗口不算矛盾；
  //      若日后想让一处切换带动两处，把这个 state 提到壳层传下去即可。
  const [kpiRange, setKpiRange] = useState<TrendRangeId>('today');
  const [kpiAnchor, setKpiAnchor] = useState(todayISO);
  const kpiRangeMeta = TREND_RANGES.find((item) => item.id === kpiRange) ?? TREND_RANGES[0];
  const kpiTotals = buildKpiRangeTotals(kpiRange, kpiAnchor, todayISO, {
    planned: totalPlanned,
    completed: totalCompleted,
    onTime: onTimeCompleted,
  });
  /* 卡片上的「计划工单」要带窗口前缀，否则切到近 7 日后标题还写着「今日」。
     锚定日不是今天时不能叫「今日」（那个词会撒谎），退回中性的「当日」。 */
  const kpiScopeLabel = kpiRange === 'today'
    ? (kpiAnchor === todayISO ? '今日' : '当日')
    : kpiRangeMeta.label;
  const kpiPending = Math.max(0, kpiTotals.planned - kpiTotals.completed);

  return (
    <CockpitModuleShell current="overview" clock={clock} onNavigate={onNavigate}>
      {/* KPI 卡片行的区间控件。选项与「计划完成率趋势」一致，但**默认「今日」**：
          卡片的默认视角就是今天这一班，切区间是「回头看看」，不是默认视角。
          控件复用趋势图那套 .uk-range-switch / .uk-date-switch ——
          同一屏上两个同类控件必须长得一样，否则读者会以为是两种东西。
          卡片文案不重复写区间：标题已经写成「近 7 日计划工单」，说明行只用来说算法。 */}
      <div className="uk-kpi-toolbar">
        <span className="uk-kpi-toolbar-label">统计区间</span>
        <div className="uk-range-switch" role="group" aria-label="卡片统计区间">
          {TREND_RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={kpiRange === item.id ? 'active' : ''}
              onClick={() => setKpiRange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {/* 日期 = 窗口**结束日**（与趋势图同一套语义）；max = 今天，不让选未来 */}
        <label className="uk-date-switch">
          <span>日期</span>
          <input type="date" value={kpiAnchor} max={todayISO} onChange={(event) => setKpiAnchor(event.target.value || todayISO)} />
        </label>
      </div>

      <div className="uk-module-kpis">
        <ModuleKpi label={`${kpiScopeLabel}计划工单`} value={`${kpiTotals.planned}`} />
        <ModuleKpi label="已完成工单" value={`${kpiTotals.completed}`} tone="green" />
        <ModuleKpi label="待完成工单" value={`${kpiPending}`} tone="amber" />
        {/* 完成率与趋势图脚注的「均值」是同一个数（都出自 aggregateKpiRange 的算术均值），
            切到近 7 日时两处会显示完全相同的 81.5% —— 这是刻意的，别改成两套算法 */}
        <ModuleKpi label="完成率" value={`${kpiTotals.completionRate.toFixed(1)}%`} note="已完成 / 计划" tone="green" />
        <ModuleKpi label="及时完成率" value={`${kpiTotals.timelyRate.toFixed(1)}%`} note="按时完成 / 已完成" tone="cyan" />
        <ModuleKpi label="计划烹饪数量" value={`${kpiTotals.planned}`} tone="blue" />
        <ModuleKpi label="临时加菜数量" value={`${temporaryAddCount}`} tone="amber" />
      </div>

      <div className="uk-module-grid uk-module-grid-main uk-overview-main">
        <section className="uk-module-panel uk-plan-chart-panel"><div className="uk-module-panel-head"><div><h2>餐段计划 / 完成对比</h2><p>按餐段看计划工单与已完成工单</p></div></div>
          {/* 筛选条从页面级（KPI 与图表之间那条独立带）搬进本面板内部：
              它只筛工单维度，影响的是这一屏的全部图表，放在图表旁比单独占一条带更贴近对象。 */}
          <div className="uk-workorder-filters" aria-label="工单筛选">
        <MultiSelectFilter label="状态" selected={statusFilters} groups={WORK_ORDER_STATUS_GROUPS} onChange={(values) => setStatusFilters(values as WorkOrderStatusFilter[])} />
        <MultiSelectFilter label="餐段" selected={segmentFilters} groups={[{ options: WORK_ORDER_SEGMENT_OPTIONS.slice(1) }]} onChange={(values) => setSegmentFilters(values as WorkOrderSegmentFilter[])} />
        <MultiSelectFilter label="模式" selected={modeFilters} groups={[{ options: WORK_ORDER_MODE_OPTIONS.slice(1) }]} onChange={(values) => setModeFilters(values as WorkOrderModeFilter[])} />
          </div>
        <div className="uk-chart-legend"><span><i className="planned" />计划工单</span><span><i className="completed" />已完成工单</span></div>{hasVisibleWorkOrders ? <div className="uk-plan-chart">{mealPlan.map((item) => <div className="uk-plan-chart-group" key={item.segment}><div className="uk-plan-bars"><i className="uk-plan-bar planned" style={{ '--bar-height': `${(item.planned / maxPlanned) * 100}%` } as React.CSSProperties}><b>{item.planned}</b></i><i className="uk-plan-bar completed" style={{ '--bar-height': `${(item.completed / maxPlanned) * 100}%` } as React.CSSProperties}><b>{item.completed}</b></i></div><strong>{item.segment}</strong><span>{item.planned === 0 ? '暂无工单' : item.pending > 0 ? `待完成 ${item.pending}` : '已完成'}</span></div>)}</div> : <div className="uk-filter-empty">暂无工单</div>}<div className="uk-chart-footnote"><span>合计 {totalPlanned} 计划工单</span><strong>已完成 {totalCompleted}</strong></div></section>
        {/* 「近 7 日计划完成率趋势」原挂在「待完成工单分布」面板的下半部分，
            把那个面板撑到 546px；而柱状图面板独占一整行（1852px），
            5 个分组里每组只用到 78px / 336px —— 宵夜、其他还是空分组。
            拆出来并排后：柱状图宽度减半、不再稀疏散开，趋势图也把宽度吃满
            （原先 SVG 声明 540×140 而容器 885×140，等比例缩放后只画了 61% 宽，
             两侧 39% 是空的 —— 这次把 viewBox 与容器比例对齐修掉了）。 */}
        <section className="uk-module-panel uk-trend-panel">
          <div className="uk-module-panel-head">
            <div>
              <h2>计划完成率趋势</h2>
              <p>{trendMeta.note}统计的计划工单完成率</p>
            </div>
          </div>

          <div className="uk-trend-toolbar">
            <div className="uk-range-switch" role="group" aria-label="统计区间">
              {TREND_RANGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={trendRange === item.id ? 'active' : ''}
                  onClick={() => setTrendRange(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="uk-date-switch">
              <span>日期</span>
              {/* max = 今天：不让选未来日期（未来没有「已完成」这回事）。
                  日期是窗口**结束日**，往前推 区间长度 得到起点。 */}
              <input type="date" value={trendAnchor} max={todayISO} onChange={(event) => setTrendAnchor(event.target.value || todayISO)} />
            </label>
          </div>

          <div className="uk-rate-trend">
            {/* 筛选把工单筛空时不能照画 —— completionRate 会是 0，而 demoRate 的基线
                下限是 74，折线反而会画出一条 80% 上下的曲线，和左边卡片上的一排 0 直接打架。
                这是把 KPI 卡片也做成「可切区间」之后暴露出来的（读者开始把两者的数字对读）。 */}
            {hasVisibleWorkOrders ? (
            <svg viewBox={`0 0 ${TREND_VB_W} ${TREND_VB_H}`} role="img" aria-label={`${trendMeta.label}计划完成率趋势`}>
              {/* 刻度线、刻度值、折线共用上面同一套 yOf() 映射 */}
              {axisTicks.map((v) => (
                <g key={v}>
                  <path className="uk-rate-trend-grid" d={`M44 ${yOf(v).toFixed(1)}H700`} />
                  <text className="uk-rate-trend-axis" x="32" y={yOf(v).toFixed(1)} textAnchor="end" dominantBaseline="middle">{v}%</text>
                </g>
              ))}
              <polyline className="uk-rate-trend-line" points={trendPoints} />
              {trendSeries.map((point, i) => {
                const x = xOf(i);
                const y = yOf(point.value);
                return (
                  <g key={`${point.label}-${i}`}>
                    <circle className="uk-rate-trend-dot" cx={x.toFixed(1)} cy={y.toFixed(1)} r={trendCount > 16 ? 2.6 : 4.5} />
                    {showValues && showTick(i) ? (
                      <text className="uk-rate-trend-value" x={x.toFixed(1)} y={(y - 13).toFixed(1)} textAnchor="middle">{point.value.toFixed(1)}%</text>
                    ) : null}
                    {showTick(i) ? (
                      <text className="uk-rate-trend-label" x={x.toFixed(1)} y={TREND_Y_LABEL} textAnchor="middle">{point.label}</text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
            ) : (
              <div className="uk-filter-empty">暂无工单</div>
            )}
          </div>
          {hasVisibleWorkOrders ? (
          <div className="uk-chart-footnote">
            {/* 一位小数，与顶部「完成率」KPI 的精度对齐 —— 否则会出现
                「KPI 78.8%、趋势末点 79%」这种同屏两个值（纯四舍五入造成的，但客户会问）。
                切到近 7 日时，这个「均值」与顶部卡片「完成率」是同一个数（同出 aggregateKpiRange）。 */}
            <span>{trendMeta.label}均值 {trendAvg.toFixed(1)}%</span>
            <strong>最新 {trendValues[trendCount - 1].toFixed(1)}%</strong>
          </div>
          ) : null}
        </section>
      </div>

      <div className="uk-module-grid uk-module-grid-bottom uk-chart-grid-bottom">
        <section className="uk-module-panel uk-pending-panel"><div className="uk-module-panel-head"><div><h2>待完成工单分布</h2></div></div>{hasVisibleWorkOrders ? <div className="uk-pending-chart">{mealPlan.map((item) => <div className="uk-pending-row" key={item.segment}><div><b>{item.segment}</b><span>{item.dishes} 道菜</span></div><div className="uk-pending-track"><i style={{ width: `${totalPending ? (item.pending / totalPending) * 100 : 0}%` }} /><span>{item.pending}</span></div></div>)}</div> : <div className="uk-filter-empty">暂无工单</div>}</section>
        <section className="uk-module-panel uk-focus-panel"><div className="uk-module-panel-head"><div><h2>工单阶段分布</h2></div></div><div className="uk-stage-list">{STATIC_WORKFLOW_STAGES.map((item, index) => <div className="uk-stage-row" key={item.label}><span className="uk-stage-index">{String(index + 1).padStart(2, '0')}</span><div className="uk-stage-name"><b>{item.label}</b><small>{item.note}</small></div><div className="uk-stage-rail"><i style={{ width: `${(item.value / STATIC_WORKFLOW_TOTAL) * 100}%`, background: item.color }} /></div><strong>{item.value}</strong></div>)}</div><div className="uk-status-exception"><i /><span>工单作废 · 已作废</span><b>{STATIC_VOID_ORDERS}</b></div></section>
      </div>
    </CockpitModuleShell>
  );
}

function MealAssuranceModule({ data, clock, onNavigate }: { data: ModuleSharedData; clock: string; onNavigate: (id: string) => void }) {
  const mealSegments: MealSegment[] = ['早餐', '午餐', '晚餐'];
  const mealSummaries = mealSegments.map((segment) => {
    const dishes = data.dishes.filter((dish) => dish.segment === segment);
    const planned = dishes.reduce((sum, dish) => sum + dish.total, 0);
    const completed = dishes.reduce((sum, dish) => sum + dish.done, 0);
    return {
      segment,
      planned,
      completed,
      pending: Math.max(0, planned - completed),
      rate: planned ? (completed / planned) * 100 : 0,
    };
  });
  const currentMeal = mealSummaries.find((meal) => meal.segment === '午餐') ?? mealSummaries[0];
  const currentPendingDishes = data.dishes.filter((dish) => dish.segment === currentMeal.segment && dish.done < dish.total);
  const currentState = currentMeal.rate >= 80 ? '按计划推进' : '需要关注';
  const currentTone = currentMeal.rate >= 80 ? 'ok' : 'warn';
  const flowStages = [
    { label: '计划确认', note: `${currentMeal.planned} 批计划`, status: '已完成', tone: 'done' },
    { label: '称重加料', note: '核对投料任务', status: currentMeal.rate >= 35 ? '进行中' : '待开始', tone: currentMeal.rate >= 35 ? 'active' : 'idle' },
    { label: '烹饪加工', note: '关注未完成菜品', status: currentMeal.rate >= 65 ? '进行中' : '待进入', tone: currentMeal.rate >= 65 ? 'active' : 'idle' },
    { label: '出餐保障', note: currentMeal.pending ? `还剩 ${currentMeal.pending} 批` : '当前餐段已完成', status: currentMeal.pending ? '待保障' : '已完成', tone: currentMeal.pending ? 'warn' : 'done' },
  ];

  return (
    <CockpitModuleShell current="overview" clock={clock} onNavigate={onNavigate}>
      <main className="uk-assurance">
        <section className="uk-assurance-hero">
          <div>
            <span className="uk-assurance-kicker">当前餐段 · 结构演示</span>
            <h2>{currentMeal.segment} · {currentState}</h2>
            <p>先判断当前餐段能否按计划完成，再定位需要关注的菜品和环节。</p>
          </div>
          <div className={`uk-assurance-badge ${currentTone}`}><i />{currentState}</div>
        </section>

        <div className="uk-module-kpis uk-assurance-kpis">
          <ModuleKpi label="当前餐段计划" value={`${currentMeal.planned} 批`} note={currentMeal.segment} />
          <ModuleKpi label="已完成" value={`${currentMeal.completed} 批`} note="已进入完成统计" tone="green" />
          <ModuleKpi label="待完成" value={`${currentMeal.pending} 批`} note="需要持续关注" tone="amber" />
          <ModuleKpi label="餐段完成率" value={`${currentMeal.rate.toFixed(1)}%`} note="已完成 / 计划" tone="cyan" />
          <ModuleKpi label="待关注菜品" value={`${currentPendingDishes.length} 道`} note="当前餐段" tone="blue" />
        </div>

        <div className="uk-assurance-main">
          <section className="uk-module-panel uk-assurance-panel">
            <div className="uk-module-panel-head">
              <div><h2>餐段完成情况</h2><p>先看哪个餐段需要关注</p></div>
            </div>
            <div className="uk-assurance-meals">
              {mealSummaries.map((meal) => {
                const state = meal.pending === 0 ? '已完成' : meal.rate >= 80 ? '进行中' : '需关注';
                const tone = meal.pending === 0 ? 'done' : meal.rate >= 80 ? 'active' : 'warn';
                return (
                  <div className="uk-assurance-meal" key={meal.segment}>
                    <div className="uk-assurance-meal-head"><b>{meal.segment}</b><span className={tone}>{state}</span></div>
                    <div className="uk-assurance-meal-track"><i className={tone} style={{ width: `${meal.rate}%` }} /></div>
                    <div className="uk-assurance-meal-meta"><span>已完成 {meal.completed} / {meal.planned} 批</span><strong>{meal.rate.toFixed(1)}%</strong></div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="uk-module-panel uk-assurance-panel">
            <div className="uk-module-panel-head">
              <div><h2>当前保障判断</h2><p>基于计划与完成进度的结构演示</p></div>
            </div>
            <div className={`uk-assurance-judgement ${currentTone}`}>
              <strong>{currentMeal.segment}餐段{currentState}</strong>
              <span>{currentMeal.pending ? `已完成 ${currentMeal.completed} 批，仍有 ${currentMeal.pending} 批待完成` : '当前餐段计划已完成'}</span>
            </div>
            <div className="uk-assurance-checks">
              <div><i className="done" /><span>计划任务已建立</span><b>已确认</b></div>
              <div><i className={currentPendingDishes.length ? 'warn' : 'done'} /><span>待完成菜品</span><b>{currentPendingDishes.length ? `${currentPendingDishes.length} 道` : '无'}</b></div>
              <div><i className="info" /><span>下一关注点</span><b>{currentPendingDishes[0]?.name ?? '出餐确认'}</b></div>
            </div>
          </section>
        </div>

        <div className="uk-assurance-bottom">
          <section className="uk-module-panel uk-assurance-panel">
            <div className="uk-module-panel-head">
              <div><h2>生产链路</h2><p>从计划到出餐的关键节点</p></div>
            </div>
            <div className="uk-assurance-flow">
              {flowStages.map((stage, index) => (
                <React.Fragment key={stage.label}>
                  <div className={`uk-assurance-flow-item ${stage.tone}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <b>{stage.label}</b>
                    <small>{stage.note}</small>
                    <em>{stage.status}</em>
                  </div>
                  {index < flowStages.length - 1 ? <i className="uk-assurance-flow-arrow">→</i> : null}
                </React.Fragment>
              ))}
            </div>
          </section>

          <section className="uk-module-panel uk-assurance-panel">
            <div className="uk-module-panel-head">
              <div><h2>重点关注</h2><p>当前餐段仍未完成的菜品</p></div>
            </div>
            <div className="uk-assurance-attention">
              {currentPendingDishes.length ? currentPendingDishes.map((dish) => (
                <div className="uk-assurance-attention-row" key={dish.name}>
                  <div><b>{dish.name}</b><span>{dish.segment} · 已完成 {dish.done} / {dish.total} 批</span></div>
                  <strong>待完成 {dish.total - dish.done} 批</strong>
                </div>
              )) : <div className="uk-assurance-empty">当前餐段暂无待完成菜品</div>}
            </div>
          </section>
        </div>
      </main>
    </CockpitModuleShell>
  );
}

type ScheduledDish = {
  name: string;
  batch: string;
  device: string;
  prep: string | null;
  weigh: string;
  cook: string;
  out: string;
};

const SCHEDULED_DISHES: ScheduledDish[] = [
  { name: '小炒鸡胗肉', batch: '批次1', device: '炒菜机 CCJ1', prep: null, weigh: '17:57', cook: '18:00', out: '18:17' },
  { name: '丝瓜炒蛋', batch: '批次1', device: '炒菜机 CCJ2', prep: '17:45', weigh: '17:55', cook: '18:17', out: '18:33' },
  { name: '小炒杏鲍菇肉片', batch: '批次1', device: '炒菜机 CCJ3', prep: '17:43', weigh: '17:53', cook: '18:33', out: '18:49' },
  { name: '韭菜炒香干', batch: '批次1', device: '炒菜机 CCJ4', prep: null, weigh: '17:51', cook: '18:49', out: '19:01' },
  { name: '清炒豆皮', batch: '批次1', device: '烤箱 KX1', prep: null, weigh: '17:49', cook: '19:01', out: '19:13' },
];

const MEAL_DEADLINE = '19:30';

const MEAL_WINDOWS = [
  { id: 'breakfast', label: '早餐', start: '07:00', deadline: '09:30', batchCount: 3 },
  { id: 'lunch', label: '午餐', start: '11:00', deadline: '13:30', batchCount: 1 },
  { id: 'dinner', label: '晚餐', start: '17:30', deadline: MEAL_DEADLINE, batchCount: 1 },
  { id: 'late-night', label: '夜宵', start: '21:00', deadline: '22:30', batchCount: 1 },
] as const;

function MealPlanModule({ clock, onNavigate }: { clock: string; onNavigate: (id: string) => void }) {
  const toMinutes = (value: string) => {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  };
  const latestDish = SCHEDULED_DISHES.reduce((latest, dish) => toMinutes(dish.out) > toMinutes(latest.out) ? dish : latest, SCHEDULED_DISHES[0]);
  const safetyMinutes = toMinutes(MEAL_DEADLINE) - toMinutes(latestDish.out);
  const chartStart = '17:30';
  const chartSpan = toMinutes(MEAL_DEADLINE) - toMinutes(chartStart);
  const chartPercent = (time: string) => Math.min(100, Math.max(0, ((toMinutes(time) - toMinutes(chartStart)) / chartSpan) * 100));
  const currentTime = clock.match(/\d{2}:\d{2}/)?.[0] ?? '17:00';
  const currentMinutes = toMinutes(currentTime);
  const mealWindowState = (meal: (typeof MEAL_WINDOWS)[number]) => {
    if (currentMinutes >= toMinutes(meal.deadline)) return 'done';
    if (currentMinutes >= toMinutes(meal.start) - 90) return 'focus';
    return 'future';
  };
  const focusedMeal = MEAL_WINDOWS.find((meal) => mealWindowState(meal) === 'focus') ?? MEAL_WINDOWS.find((meal) => toMinutes(meal.start) > currentMinutes) ?? MEAL_WINDOWS[0];
  const productionStart = (dish: ScheduledDish) => dish.prep ?? dish.weigh;
  const phaseLegend = [
    { label: '预处理', className: 'prep' },
    { label: '称重加料', className: 'weigh' },
    { label: '烹饪', className: 'cook' },
  ];

  return (
    <CockpitModuleShell current="overview" clock={clock} onNavigate={onNavigate}>
      <main className="uk-plan-page">
        <section className="uk-plan-hero">
          <div>
            <span className="uk-assurance-kicker">晚餐餐段 · 计划保障</span>
            <h2>计划与进度</h2>
            <p>计划时间按餐段出餐时间倒排，确保所有菜品在出餐前完成；当前最晚计划出餐为 {latestDish.out}。</p>
          </div>
          <div className="uk-plan-verdict"><i />计划可保障</div>
        </section>

        <section className="uk-meal-status-summary">
          <div className="uk-meal-status-title"><b>餐段计划</b><span>{focusedMeal.label}为当前关注窗口</span></div>
          <div className="uk-meal-status-cards">
            {MEAL_WINDOWS.map((item) => (
              <div className={`uk-meal-status-card ${mealWindowState(item)}`} key={item.id} aria-label={`${item.label} ${item.start} 至 ${item.deadline}`}>
                <span>{item.label}</span><strong>{item.start}—{item.deadline}</strong><small>{item.batchCount} 批{item.id === 'dinner' ? ' · 5 道菜' : ''}</small>
              </div>
            ))}
          </div>
        </section>

        <div className="uk-module-kpis uk-plan-kpis">
          <ModuleKpi label="餐段最晚出餐" value={MEAL_DEADLINE} note="计划截止时间" tone="blue" />
          <ModuleKpi label="计划最晚完成" value={latestDish.out} note={latestDish.name} tone="cyan" />
          <ModuleKpi label="计划安全余量" value={`${safetyMinutes} 分钟`} note="截止时间 - 最晚出餐" tone="green" />
        </div>

        <div className="uk-plan-main">
        <section className="uk-module-panel uk-plan-chart-panel">
          <div className="uk-module-panel-head">
            <div><h2>批次设备排程</h2><p>按批次查看设备占用、菜品生产阶段和预计出餐</p></div>
            <span className="uk-plan-note">截止 {MEAL_DEADLINE}</span>
          </div>
          <div className="uk-plan-chart-legend">{phaseLegend.map((phase) => <span key={phase.className}><i className={phase.className} />{phase.label}</span>)}<span><i className="deadline" />餐段截止</span></div>
          <div className="uk-plan-schedule-chart">
            <div className="uk-plan-schedule-axis"><span style={{ left: '0%' }}>{chartStart}</span><span style={{ left: '25%' }}>18:00</span><span style={{ left: '50%' }}>18:30</span><span style={{ left: '75%' }}>19:00</span><span style={{ left: '100%' }}>{MEAL_DEADLINE}</span></div>
            {SCHEDULED_DISHES.map((dish) => (
              <div className="uk-plan-schedule-row" key={dish.name}>
                <div className="uk-plan-schedule-name"><b>{dish.device}</b><span>{dish.batch} · {dish.name}</span></div>
                <div className="uk-plan-schedule-track">
                  {[dish.prep ? toMinutes(dish.weigh) - toMinutes(dish.prep) : 0, toMinutes(dish.cook) - toMinutes(dish.weigh), toMinutes(dish.out) - toMinutes(dish.cook)].map((duration, index, durations) => duration > 0 ? <i className={`uk-plan-phase ${phaseLegend[index].className}`} key={phaseLegend[index].className} style={{ left: `${chartPercent(productionStart(dish)) + (durations.slice(0, index).reduce((sum, value) => sum + value, 0) / chartSpan) * 100}%`, width: `${(duration / chartSpan) * 100}%` }} /> : null)}
                  <b className="uk-plan-schedule-marker" style={{ left: `${chartPercent(dish.out)}%` }} />
                </div>
                <strong><b>{dish.out}</b><small>余量 {toMinutes(MEAL_DEADLINE) - toMinutes(dish.out)} 分</small></strong>
              </div>
            ))}
          </div>
          <div className="uk-plan-chart-foot"><span>横轴为计划生产窗口，黄色线为餐段截止时间</span><b>{SCHEDULED_DISHES.length} 道菜 · {new Set(SCHEDULED_DISHES.map((dish) => dish.device)).size} 台设备</b></div>
        </section>

        <section className="uk-module-panel uk-plan-judgement">
          <div className="uk-module-panel-head"><div><h2>餐段保障判断</h2><p>先回答能否按时出餐</p></div></div>
          <div className="uk-plan-judgement-main"><strong>可按计划完成</strong><span>最晚菜品仍比餐段截止时间提前 {safetyMinutes} 分钟</span></div>
          <div className="uk-plan-facts">
            <div><span>餐段截止</span><b>{MEAL_DEADLINE}</b></div>
            <div><span>最晚菜品</span><b>{latestDish.name}</b></div>
            <div><span>最晚出餐</span><b>{latestDish.out}</b></div>
            <div><span>计划状态</span><b>无超时风险</b></div>
          </div>
          <div className="uk-plan-check-list">
            <div><i /><span>批次设备已分配</span><b>{new Set(SCHEDULED_DISHES.map((dish) => dish.device)).size} / {new Set(SCHEDULED_DISHES.map((dish) => dish.device)).size}</b></div>
            <div><i /><span>生产阶段已排程</span><b>{SCHEDULED_DISHES.length * 3} 个节点</b></div>
            <div><i /><span>计划出餐满足截止</span><b>全部通过</b></div>
          </div>
          <div className="uk-plan-change-card"><span>临时加菜影响</span><strong>当前无临时加菜</strong><small>批次1预计生产时长未增加</small></div>
          <p className="uk-plan-explain">系统会根据设备占用和阶段时长重新计算批次完成时间，若影响截止时间则自动转为需要关注。</p>
        </section>
        </div>
      </main>
    </CockpitModuleShell>
  );
}

function DeviceMonitorModule({ data, clock, onNavigate }: { data: ModuleSharedData; clock: string; onNavigate: (id: string) => void }) {
  const running = data.machines.filter((machine) => machine.state === '烹饪中').length;
  const devices = [...data.machines, { id: '油炸炉 FR1', dish: '油炸炉任务', state: '加工中', color: '#25e0ee' }, { id: '油炸炉 FR2', dish: '待命', state: '待命', color: '#7da8d1' }];
  return (
    <CockpitModuleShell current="process" clock={clock} onNavigate={onNavigate}>
      <div className="uk-module-kpis"><ModuleKpi label="设备总数" value={`${devices.length} 台`} note="候选配置 · 演示" /><ModuleKpi label="加工中" value={`${running} 台`} note="炒菜机 / 烤箱" tone="green" /><ModuleKpi label="待命" value={`${devices.length - running} 台`} note="等待下一生产次" tone="blue" /><ModuleKpi label="当前加工菜品" value={`${data.machines.filter((machine) => machine.state === '烹饪中').length} 道`} note="设备任务关联" tone="cyan" /></div>
      <section className="uk-module-panel uk-device-dashboard"><div className="uk-module-panel-head"><div><h2>设备运行矩阵</h2><p>设备状态、当前菜品和任务进度集中展示</p></div></div><div className="uk-device-grid-dashboard">{devices.map((device, index) => <article className="uk-device-card" key={device.id}><div className="uk-device-card-head"><span className="uk-machine-dot" style={{ background: device.color }} /><b>{device.id}</b><em className={device.state === '烹饪中' || device.state === '协同中' ? 'running' : 'idle'}>{device.state}</em></div><p>{device.dish}</p><div className="uk-device-progress"><i style={{ width: `${device.state === '烹饪中' ? 48 + (index % 4) * 9 : device.state === '协同中' ? 64 : 12}%`, background: device.color }} /></div><small>{device.state === '烹饪中' ? `任务进行中 · ${58 + (index % 3) * 7}%` : device.state === '协同中' ? '设备协同中' : '等待任务下发'}</small></article>)}</div></section>
      <div className="uk-module-grid uk-module-grid-bottom"><section className="uk-module-panel"><div className="uk-module-panel-head"><div><h2>设备分布</h2><p>按设备类型统计</p></div></div><div className="uk-device-type-bars"><div><span>炒菜机</span><i><b style={{ width: '82%' }} /></i><em>4 台</em></div><div><span>烤箱</span><i><b style={{ width: '56%' }} /></i><em>2 台</em></div><div><span>油炸炉</span><i><b style={{ width: '42%' }} /></i><em>2 台</em></div></div></section><section className="uk-module-panel"><div className="uk-module-panel-head"><div><h2>状态说明</h2><p>接入现场数据后替换演示值</p></div></div><div className="uk-status-legend"><span><i className="running" />烹饪 / 加工中</span><span><i className="idle" />待命</span><span><i className="warn" />待接入数据</span></div><p className="uk-module-note">当前页面用于向领导展示设备协同关系，不提供启停、配方修改或任务下发操作。</p></section></div>
    </CockpitModuleShell>
  );
}

function TaskDispatchModule({ data, clock, onNavigate }: { data: ModuleSharedData; clock: string; onNavigate: (id: string) => void }) {
  return (
    <CockpitModuleShell current="equipment" clock={clock} onNavigate={onNavigate}>
      <div className="uk-module-kpis"><ModuleKpi label="早餐任务" value={`${data.dishes.filter((dish) => dish.segment === '早餐').length} 道`} note="计划已生成" /><ModuleKpi label="午餐任务" value={`${data.dishes.filter((dish) => dish.segment === '午餐').length} 道`} note="当前主餐段" tone="cyan" /><ModuleKpi label="晚餐任务" value={`${data.dishes.filter((dish) => dish.segment === '晚餐').length} 道`} note="待后续生产" tone="blue" /><ModuleKpi label="实际 / 计划" value={`${formatTrays(data.servedNow)} / ${formatTrays(data.totalPlan)}`} note={`${data.serveRate.toFixed(1)}%`} tone="green" /></div>
      <div className="uk-module-grid uk-module-grid-main"><section className="uk-module-panel uk-task-panel"><div className="uk-module-panel-head"><div><h2>今日菜品任务</h2><p>按餐段展示计划、完成和生产状态</p></div></div><div className="uk-task-table"><div className="uk-task-head"><span>餐段 / 菜品</span><span>计划</span><span>已完成</span><span>状态</span></div>{data.dishes.map((dish) => <div className="uk-task-row" key={dish.name}><span><i style={{ background: dish.color }} />{dish.segment} · {dish.name}</span><b>{dish.total} 批</b><b>{dish.done} 批</b><em className={data.dishState(dish) === '已出餐' ? 'done' : ''}>{data.dishState(dish)}</em></div>)}</div></section><section className="uk-module-panel"><div className="uk-module-panel-head"><div><h2>出口完成情况</h2><p>出餐数量按出口汇总</p></div></div><div className="uk-exit-cards"><div><b>出口 1</b><strong>{formatTrays(150)} 盆</strong><span>3 批已完成</span><i><em style={{ width: '76%' }} /></i></div><div><b>出口 2</b><strong>{formatTrays(100)} 盆</strong><span>2 批已完成</span><i><em style={{ width: '58%' }} /></i></div></div><div className="uk-module-note">到达出口的批次会同步更新右侧出餐记录与顶部完成率。</div></section></div>
    </CockpitModuleShell>
  );
}

export default function UnmannedKitchenCockpit() {
  const [scale, setScale] = useState(1);
  const [clock, setClock] = useState('');
  const [servedNow, setServedNow] = useState(SERVED);
  const [servedBatches, setServedBatches] = useState<OutItem[]>([]);
  const [flowNow, setFlowNow] = useState(() => Date.now());
  const [flowStartedAt] = useState(() => Date.now());
  const [view, setView] = useState<ViewId>(readViewFromLocation);

  const navigate = (id: string) => {
    const next = normalizeViewId(id);
    setView(next);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('page', next === 'cockpit' ? 'operations' : next);
      window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  };

  useEffect(() => {
    const onPopState = () => setView(readViewFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setFlowNow(Date.now()), 80);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timeoutIds: number[] = [];
    const intervalIds: number[] = [];
    ACTIVE_ROUTE_PATHS.forEach((route) => {
      const routeDelayMs = Number.parseFloat(route.delay) * 1000;
      const firstArrivalMs = Math.max(1000, LINE_CYCLE_MS + routeDelayMs);
      const addServedBatch = () => {
        setServedNow((current) => Math.min(TOTAL_PLAN, current + route.increment));
        setServedBatches((current) => [
          { port: route.port, dish: route.dish, qty: `${formatTrays(route.increment)} 盆`, color: route.color },
          ...current,
        ].slice(0, 3));
      };
      const timeoutId = window.setTimeout(() => {
        addServedBatch();
        intervalIds.push(window.setInterval(addServedBatch, LINE_CYCLE_MS));
      }, firstArrivalMs);
      timeoutIds.push(timeoutId);
    });
    return () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
      intervalIds.forEach((id) => window.clearInterval(id));
    };
  }, []);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const tickClock = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setClock(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}  ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
    };
    tickClock();
    const timer = window.setInterval(tickClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // 所有演示状态共享同一条产线时钟，保证动线、列表、设备状态和出餐记录同步。
  const routePhase = (route: (typeof ACTIVE_ROUTE_PATHS)[number]) => {
    const delayMs = Number.parseFloat(route.delay) * 1000;
    const elapsed = flowNow - flowStartedAt - delayMs;
    return ((elapsed % LINE_CYCLE_MS) + LINE_CYCLE_MS) % LINE_CYCLE_MS / LINE_CYCLE_MS;
  };
  const routeForDish = (dishName: string) => ACTIVE_ROUTE_PATHS.find((route) => route.dish === dishName);
  const isMachineCooking = (machineId: string) => {
    const machine = MACHINES.find((item) => item.id === machineId);
    const route = machine ? routeForDish(machine.dish) : undefined;
    if (!route) return false;
    const phase = routePhase(route);
    return phase >= route.pauseStart && phase < route.pauseEnd;
  };
  const isTrayWaiting = (route: (typeof ACTIVE_ROUTE_PATHS)[number]) => {
    const phase = routePhase(route);
    return phase >= route.trayStart && phase < route.trayEnd;
  };
  const dishState = (dish: Dish) => {
    const route = routeForDish(dish.name);
    if (!route) return dish.done === dish.total ? '已出餐' : '烹饪中';
    const phase = routePhase(route);
    if (phase < 0.25) return '待称重';
    if (phase < route.pauseStart) return '摆盆等待';
    if (phase < route.pauseEnd) return '烹饪中';
    if (phase < 0.88) return '烹饪中';
    return '已出餐';
  };
  const workOrderStatus = (dish: Dish): WorkOrderStatus => {
    const route = routeForDish(dish.name);
    if (!route) return dish.done === dish.total ? '取餐完成' : dish.done > 0 ? '烹饪中' : '未开始';
    const phase = routePhase(route);
    if (phase < route.trayStart) return '未开始';
    if (phase < route.trayStart + 0.03) return '待称重';
    if (phase < route.trayStart + 0.07) return '称重中';
    if (phase < route.trayStart + 0.10) return '待加料';
    if (phase < route.trayStart + 0.13) return '加料中';
    if (phase < route.trayEnd) return '称重加料完成';
    if (phase < route.pauseStart - 0.04) return '摆盆中';
    if (phase < route.pauseStart) return '待烹饪';
    if (phase < route.pauseStart + (route.pauseEnd - route.pauseStart) * 0.35) return '预热中';
    if (phase < route.pauseEnd) return '烹饪中';
    if (phase < 0.88) return '烹饪完成';
    if (phase < 0.94) return '开始出餐';
    if (phase < 0.98) return '出餐完成';
    if (phase < 0.995) return '取餐中';
    return '取餐完成';
  };
  const visibleMachines = MACHINES.slice(0, 4).map((machine) => {
    const route = routeForDish(machine.dish);
    if (!route) return machine;
    const phase = routePhase(route);
    return { ...machine, state: phase < route.pauseStart ? '待进入' : phase < 0.88 ? '烹饪中' : '已出餐' };
  });
  const allMachines = MACHINES.map((machine) => {
    const route = routeForDish(machine.dish);
    if (!route) return machine;
    const phase = routePhase(route);
    return { ...machine, state: phase < route.pauseStart ? '待进入' : phase < 0.88 ? '烹饪中' : '已出餐' };
  });
  const visibleFlow = [...servedBatches, ...OUTFLOW].slice(0, 5);
  const serveRate = Math.min(100, (servedNow / TOTAL_PLAN) * 100);
  const sparkTrend = SPARK_TREND.map((point, index) => (
    index === SPARK_TREND.length - 1 ? { ...point, v: servedNow } : point
  ));
  const sparkPeak = Math.max(...sparkTrend.map((point) => point.v));

  const sharedData: ModuleSharedData = {
    servedNow,
    totalPlan: TOTAL_PLAN,
    serveRate,
    dishes: DISHES,
    machines: allMachines,
    trend: sparkTrend,
    outflow: visibleFlow,
    dishState,
    workOrderStatus,
  };
  if (view === 'overview' || view === 'process' || view === 'equipment') return (
    <div className="uk-viewport">
      <div className="uk-screen uk-module-screen" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <MealPlanModule clock={clock} onNavigate={navigate} />
      </div>
    </div>
  );

  return (
    <div className="uk-viewport">
      <div className="uk-screen" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <TopHeader current={view} clock={clock} onNavigate={navigate} />

        {view === 'behavior' && <BehaviorView />}

        <main className="uk-body" hidden={view !== 'cockpit'}>
          <aside className="uk-col">
            <section className="uk-panel uk-served">
              <h2 className="uk-served-heading">
                <span>今日出餐</span>
                <span className="uk-serve-summary">
                  {/* 原「实际 / 计划」文字标签已去掉：数字本身用「/」分隔是通用写法，
                      前缀反而把标题行拉长，跟左侧「今日出餐」抢位置 */}
                  <b>{formatTrays(servedNow)} / {formatTrays(TOTAL_PLAN)}</b>
                  <em>盆</em>
                  <strong>{serveRate.toFixed(1)}%</strong>
                </span>
              </h2>
              <div className="uk-bignum" aria-live="polite">
                {formatTrays(servedNow)}<em>盆</em>
              </div>
              <p className="uk-delta">较去年同期 <b>↑ 12.4%</b></p>
              <div className="uk-spark">
                {sparkTrend.map((point) => (
                  <div
                    className="uk-spark-col"
                    key={point.label}
                    /* 柱高经 CSS 变量下发；数值标签用同一个变量把自己吸在柱顶上方，
                       所以「柱子多高」和「数字浮多高」永远同步。 */
                    style={{ '--bar-h': `${Math.round((point.v / sparkPeak) * SPARK_MAX_H)}%` } as React.CSSProperties}
                  >
                  <span className="uk-spark-val">{formatTrays(point.v)}</span>
                    <i />
                  </div>
                ))}
              </div>
              <div className="uk-spark-axis">
                {sparkTrend.map((point) => (
                  <span key={point.label}>{point.label}</span>
                ))}
              </div>
            </section>

            <section className="uk-panel uk-dishes">
              <h2>
                今日菜品
                {/* 数量从底栏挪到标题后面：它本来就是下面这 10 行的行数，贴着列表才对 */}
                <em className="uk-h2-count">{DISHES.length} 道</em>
              </h2>
              <div className="uk-dish-list">
                <div className="uk-dish-head" aria-hidden="true">
                  <span>菜品</span>
                  <span>原料称重（kg）</span>
                  <span>盆数</span>
                </div>
                {DISH_GROUPS.map((group) => (
                  <div className="uk-dish-group" key={group.segment}>
                    <div className="uk-dish-group-head"><b>{group.segment}</b><span>{group.dishes.length} 道</span></div>
                    {group.dishes.map((dish) => (
                      <div className="uk-dish" key={dish.name}>
                        <span className="uk-dish-name" style={{ color: dish.color }}>{dish.name}</span>
                        {dish.feedKg == null ? (
                          /* 未称重显示「—」而非 0：缺失不等于零（PRD:122） */
                          <b className="uk-dish-feed is-empty">—</b>
                        ) : (
                          <b className="uk-dish-feed">
                            {dish.feedKg.toFixed(1)}
                          </b>
                        )}
                        {/* 第三列由「状态词」改为「盆数」。
                            原来那列读不出状态：它由 dishState() 跟着产线动画推导，
                            每 14 秒在 待称重→摆盆等待→烹饪中→已出餐 之间循环跳，
                            同一行隔几秒看是另一个值，且 10 行里只有 3 行有动线其余靠兜底。
                            换成 done/total 后是静态数字，与「今日计划工单 / 已完成工单」
                            和 TOTAL_PLAN（26 盆 × 140 份）同源，可核对、不跳变。
                            done===total 时用绿色，表示该菜品已全部完成。 */}
                        <b className={`uk-dish-tray${dish.done === dish.total ? ' is-done' : ''}`}>
                          <i>{dish.done}</i>
                          <span>/{dish.total}</span>
                          <em>盆</em>
                        </b>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <p className="uk-dish-total">
                今日累计称重<b>{FEED_TOTAL_KG.toFixed(1)}</b>kg · 已称重 {WEIGHED.length} 道
              </p>
            </section>
          </aside>

          <section className="uk-col uk-main">
            <section className="uk-panel uk-line">
              <h2>
                智厨生产流程<span className="uk-tag-demo">流程演示</span>
              </h2>
              <div className="uk-line-stage">
                <svg viewBox="0 0 1040 400" preserveAspectRatio="xMidYMid meet">
                  {/* 四个环节：预处理 → 称重加料 → 烹饪分流 → 出餐分流。
                      主线走到称重加料区后分出 4 台炒菜机与 2 台烤箱，
                      亮色料箱沿演示路线进入具体设备，再汇入出口 1 / 出口 2。 */}
                  <path className="uk-rail" d="M125 240 H350" />
                  <path className="uk-rail-glow" d="M125 240 H350" />
                  {DEVICE_ROUTE_PATHS.map((path, index) => (
                    <path className="uk-route" d={path} key={`device-route-${index}`} />
                  ))}
                  {ACTIVE_ROUTE_PATHS.map((route) => (
                    <path className="uk-route-glow" d={route.path} key={`${route.id}-glow`} style={{ stroke: route.color }} />
                  ))}

                  <g className="uk-zone">
                    <rect x="60" y="80" width="130" height="300" rx="10" />
                    <text x="125" y="64" textAnchor="middle">预处理区</text>
                    {/* 预处理区等待队列：菜品进入称重加料区后，对应卡片淡出。 */}
                    {ACTIVE_ROUTE_PATHS.map((route) => (
                      <g className="uk-flow-queue-card uk-weigh-queue" key={`weigh-queue-${route.id}`} style={{ animationDelay: route.delay }}>
                        <rect x="76" y="112" width="98" height="30" rx="5" style={{ stroke: route.color }} />
                        <circle cx="88" cy="127" r="4" style={{ fill: route.color }} />
                        <text className="uk-flow-queue-label" x="98" y="131">{route.dish}</text>
                      </g>
                    ))}
                  </g>

                  <g className="uk-zone">
                    <rect x="220" y="80" width="130" height="300" rx="10" />
                    <text x="285" y="64" textAnchor="middle">称重加料区</text>
                    {/* 称重加料区等待队列：进入烹饪分支后，对应卡片淡出。 */}
                    {ACTIVE_ROUTE_PATHS.map((route, index) => (
                      <g className="uk-flow-queue-card uk-tray-queue" key={`tray-queue-${route.id}`} style={{ opacity: isTrayWaiting(route) ? 1 : 0 }}>
                        <rect
                          className="uk-tray-wait"
                          x="236"
                          y={112 + index * 48}
                          width="98"
                          height="30"
                          rx="5"
                          style={{ stroke: route.color }}
                        />
                        <circle cx="248" cy={127 + index * 48} r="4" style={{ fill: route.color }} />
                        <text className="uk-tray-wait-label" x="258" y={131 + index * 48}>{route.dish}</text>
                      </g>
                    ))}
                  </g>

                  <g className="uk-zone">
                    <rect x="380" y="80" width="320" height="300" rx="10" />
                    <text x="540" y="64" textAnchor="middle">烹饪区 · 4 台炒菜机 / 2 台烤箱</text>
                    {[0, 1, 2, 3].map((i) => (
                      <g key={`c${i}`}>
                        {/* 台间呼吸灯错峰由内联延迟控制 */}
                        <rect
                          className={`uk-cooker ${isMachineCooking(`炒菜机 CCJ${i + 1}`) ? 'is-route-active' : ''}`}
                          x={398 + i * 74}
                          y="128"
                          width="62"
                          height="68"
                          rx="8"
                          style={{ animationDelay: `${(i % 2) * 1.4}s` }}
                        />
                        <text className="uk-cooker-label" x={429 + i * 74} y="166" textAnchor="middle">CCJ{i + 1}</text>
                      </g>
                    ))}
                    {[0, 1].map((i) => (
                      <g key={`o${i}`}>
                        <rect className={`uk-oven ${isMachineCooking(`烤箱 KX${i + 1}`) ? 'is-route-active' : ''}`} x={424 + i * 128} y="284" width="104" height="68" rx="8" />
                        <text className="uk-oven-label" x={476 + i * 128} y="323" textAnchor="middle">KX{i + 1}</text>
                      </g>
                    ))}
                  </g>

                  <g className="uk-zone">
                    <rect x="760" y="80" width="180" height="300" rx="10" />
                    <text x="850" y="64" textAnchor="middle">出餐区</text>
                    <rect className="uk-port is-route-active" x="778" y="128" width="144" height="68" rx="8" />
                    <text className="uk-port-label" x="850" y="167" textAnchor="middle">出口 1</text>
                    <rect className="uk-port is-route-active" x="778" y="284" width="144" height="68" rx="8" />
                    <text className="uk-port-label" x="850" y="323" textAnchor="middle">出口 2</text>
                  </g>

                  {/* 仅展示 3 条活动路线，避免大量并行动画遮住设备；标签直接显示菜名，
                      现场接入后可替换成当前工单的菜品简称。 */}
                  {ACTIVE_ROUTE_PATHS.map((route) => (
                    <g className="uk-route-token" key={route.id}>
                      <rect x="-36" y="-10" width="72" height="20" rx="4" style={{ fill: route.color, stroke: route.color, filter: `drop-shadow(0 0 4px ${route.color})` }} />
                      <text x="0" y="4" textAnchor="middle" style={{ fill: '#ffffff' }}>{route.dish}</text>
                      <animate
                        attributeName="opacity"
                        values="0;1;1;0"
                        keyTimes="0;0.08;0.88;1"
                        dur={`${LINE_CYCLE_MS / 1000}s`}
                        begin={route.delay}
                        repeatCount="indefinite"
                      />
                      <animateMotion
                        dur={`${LINE_CYCLE_MS / 1000}s`}
                        begin={route.delay}
                        repeatCount="indefinite"
                        rotate="0"
                        path={route.path}
                        calcMode="linear"
                        keyPoints={route.keyPoints}
                        keyTimes={route.keyTimes}
                      />
                    </g>
                  ))}
                </svg>
              </div>
            </section>

            <section className="uk-panel uk-realtime">
              <h2>后厨画面</h2>
              <div className="uk-camera">
                <img src={kitchenImage} alt="后厨画面" />
                <span className="uk-camera-tag is-demo"><i />生产烹饪区</span>
              </div>
            </section>
          </section>

          <aside className="uk-col">
            <section className="uk-panel uk-device">
              <h2>设备数据</h2>
              <div className="uk-device-grid">
                <div><b>4</b><span>炒菜机</span></div>
                <div><b>2</b><span>烤箱</span></div>
                <div><b>2</b><span>油炸炉</span></div>
                <div><b>8</b><span>设备总数</span></div>
              </div>
            </section>

            <section className="uk-panel uk-cooking">
              <h2>设备任务</h2>
              <div className="uk-cook-list">
                {visibleMachines.map((machine) => (
                  <div className="uk-cook" key={machine.id}>
                    <div className="uk-cook-head">
                      <b>{machine.id}</b>
                      <span style={{ color: machine.color }}>{machine.dish}</span>
                    </div>
                    <div className="uk-cook-foot">
                      <span>状态</span>
                      <b>{machine.state}</b>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="uk-panel uk-outflow">
              <h2 className="uk-outflow-heading">
                <span>出餐记录</span>
                {/* 「平均出餐时长」胶囊已移除（写死的演示值、无计算逻辑、不在 PRD 指标清单内） */}
              </h2>
              <div className="uk-flow">
                {visibleFlow.map((item, index) => (
                  <div className="uk-flow-row" key={`${item.port}-${item.dish}-${index}`}>
                    <span className="uk-flow-port" style={{ borderColor: item.color, color: item.color }}>{item.port}</span>
                    <span className="uk-flow-dish" style={{ color: item.color }}>{item.dish}</span>
                    <b>{item.qty}</b>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </main>

        <footer className="uk-bottom" hidden={view !== 'cockpit'}>
          <div className="uk-ticker">
            <div className="uk-ticker-track">
              {[...DISHES, ...DISHES].map((dish, index) => (
                <span key={`${dish.name}-${index}`}>
                  <i style={{ background: dish.color }} />{dish.name}
                </span>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
