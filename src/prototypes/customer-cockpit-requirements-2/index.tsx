/**
 * @name 客户驾驶舱需求 2
 *
 * 数据口径：本页全部为**静态结构演示数据**，未接入任何真实系统。
 * 按 PRD 对齐：
 * - PRD:129 / AC08：演示数据显式标注；无数据源时不显示「实时连接」「设备运行中」等无依据状态。
 * - PRD:189：不显示虚构的任务百分比、当前批次或剩余时间；说明性动画标注为「流程演示」。
 * - PRD:32：未接入数据不显示为实时数据。
 * - PRD:111：数量未知时不显示数量。
 * 因此本页不自动累加、不自动轮播（避免把演示值伪装成实时动态数据），
 * 唯一保留的动画是「产线动线」，已在标题旁标注「流程演示」。
 *
 * 页内切换：顶部提供「驾驶舱 / 行为监控」两个视图（本页演示讲解用，
 * 与 PRD 中由 iPad 切页的五页体系并行，不替代该体系）。
 * 行为监控视图的数据口径见 ./components/BehaviorView.tsx。
 */
import React, { useEffect, useState } from 'react';
import { BehaviorView } from './components/BehaviorView';
import './style.css';
import kitchenImage from './assets/realtime-kitchen.png';

type Dish = { name: string; done: number; total: number; color: string; feedKg?: number };
type Machine = { id: string; dish: string; state: string; color: string };
type OutItem = { port: string; dish: string; qty: string; color: string };

/** feedKg = 称重加料区实测投料量（kg）。演示口径，非客户现场数据。
    自检：合计 82.0 kg ÷ 26 盆 ≈ 3.2 kg/盆，与盆量级吻合。 */
const DISHES: Dish[] = [
  { name: '青椒肉丝', done: 4, total: 4, color: '#3b8be0', feedKg: 13.2 },
  { name: '番茄炒蛋', done: 4, total: 4, color: '#42a885', feedKg: 12.8 },
  { name: '土豆烧牛肉', done: 3, total: 4, color: '#9367d8', feedKg: 9.6 },
  { name: '干锅花菜', done: 3, total: 4, color: '#f09a4b', feedKg: 8.4 },
  { name: '清炒莲藕片', done: 3, total: 3, color: '#e85d75', feedKg: 8.7 },
  { name: '蒜蓉娃娃菜', done: 2, total: 3, color: '#079f96', feedKg: 5.2 },
  { name: '小炒黄牛肉', done: 2, total: 3, color: '#6f8fe8', feedKg: 6.4 },
  { name: '韭菜绿豆芽', done: 2, total: 3, color: '#d879b0', feedKg: 4.8 },
  { name: '紫菜蛋汤', done: 2, total: 2, color: '#e0a629', feedKg: 9.8 },
  { name: '蚝油牛柳', done: 1, total: 3, color: '#56a66f', feedKg: 3.1 },
];

/** 已称重菜品与累计投料量。由数组推导而非写死，避免与明细行对不上。 */
const WEIGHED = DISHES.filter((dish) => dish.feedKg != null);
const FEED_TOTAL_KG = WEIGHED.reduce((sum, dish) => sum + (dish.feedKg ?? 0), 0);

/** 每盆约 140 份，用于由菜品盆数推算今日计划总份数 */
const PORTIONS_PER_TRAY = 140;
/** 今日计划总份数（演示口径：26 盆 × 140 份 = 3640 份） */
const TOTAL_PLAN = DISHES.reduce((sum, dish) => sum + dish.done * PORTIONS_PER_TRAY, 0);
/** 今日出餐（演示快照，不自动累加） */
const SERVED = 3182;

/** 近 7 天出餐趋势（演示口径，值为相对高度 %）。最后一根是当天。 */
const SPARK_TREND = [
  { label: '09-17', h: 72 },
  { label: '09-18', h: 78 },
  { label: '09-19', h: 69 },
  { label: '09-20', h: 84 },
  { label: '09-21', h: 80 },
  { label: '09-22', h: 88 },
  { label: '09-23', h: 96 },
];

const MACHINES: Machine[] = [
  { id: '炒菜机 CCJ1', dish: '青椒肉丝', state: '烹饪中', color: '#3b8be0' },
  { id: '炒菜机 CCJ2', dish: '番茄炒蛋', state: '烹饪中', color: '#42a885' },
  { id: '炒菜机 CCJ3', dish: '土豆烧牛肉', state: '待出餐', color: '#9367d8' },
  { id: '炒菜机 CCJ4', dish: '干锅花菜', state: '烹饪中', color: '#f09a4b' },
  { id: '烤箱 KXJ1', dish: '蒜蓉娃娃菜', state: '待出餐', color: '#079f96' },
  { id: '烤箱 KXJ2', dish: '清炒莲藕片', state: '烹饪中', color: '#e85d75' },
];

const OUTFLOW: OutItem[] = [
  { port: '出口 1', dish: '清炒莲藕片', qty: '3 盆 / 75 份', color: '#e85d75' },
  { port: '出口 2', dish: '土豆烧牛肉', qty: '2 盆 / 50 份', color: '#9367d8' },
  { port: '出口 1', dish: '番茄炒蛋', qty: '3 盆 / 75 份', color: '#42a885' },
  { port: '出口 2', dish: '青椒肉丝', qty: '2 盆 / 50 份', color: '#3b8be0' },
  { port: '出口 1', dish: '紫菜蛋汤', qty: '2 盆 / 50 份', color: '#e0a629' },
  { port: '出口 2', dish: '干锅花菜', qty: '1 盆 / 25 份', color: '#f09a4b' },
];

/** 平均出餐时长使用示例值（8、10、12 分钟/批的均值）。 */
const METRICS = [
  { label: '今日菜肴', value: `${DISHES.length} 道` },
  { label: '平均出餐时长', value: '10 分钟' },
];

type ViewId = 'cockpit' | 'behavior';

export default function UnmannedKitchenCockpit() {
  const [scale, setScale] = useState(1);
  const [clock, setClock] = useState('');
  const [view, setView] = useState<ViewId>('cockpit');

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

  // 演示数据取静态快照：不再自动累加出餐数、不再轮播出餐记录与设备列表，
  // 否则演示值会被伪装成实时动态数据（PRD AC08）。
  const visibleMachines = MACHINES.slice(0, 4);
  const visibleFlow = OUTFLOW.slice(0, 5);

  return (
    <div className="uk-viewport">
      <div className="uk-screen" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <header className="uk-top">
          <div className="uk-brand">
            <div className="uk-logo">智</div>
            <div>
              <h1>智慧厨房驾驶舱</h1>
            </div>
          </div>
          <nav className="uk-switch" aria-label="展示视图切换">
            <button type="button" className={view === 'cockpit' ? 'active' : ''} onClick={() => setView('cockpit')}>
              驾驶舱
            </button>
            <button type="button" className={view === 'behavior' ? 'active' : ''} onClick={() => setView('behavior')}>
              行为监控
            </button>
          </nav>
          <div className="uk-meta">
            <span className="uk-clock">{clock}</span>
          </div>
        </header>

        {view === 'behavior' && <BehaviorView />}

        <main className="uk-body" hidden={view !== 'cockpit'}>
          <aside className="uk-col">
            <section className="uk-panel uk-served">
              <h2>今日出餐</h2>
              <div className="uk-bignum">
                {SERVED.toLocaleString()}<em>份</em>
              </div>
              <p className="uk-delta">较去年同期 <b>↑ 12.4%</b></p>
              <div className="uk-spark">
                {SPARK_TREND.map((point) => (
                  <i key={point.label} style={{ height: `${point.h}%` }} />
                ))}
              </div>
              <div className="uk-spark-axis">
                {SPARK_TREND.map((point) => (
                  <span key={point.label}>{point.label}</span>
                ))}
              </div>
              <p className="uk-note">近 7 天出餐量 · 今日计划 {TOTAL_PLAN.toLocaleString()} 份</p>
            </section>

            <section className="uk-panel uk-dishes">
              <h2>今日菜品</h2>
              <div className="uk-dish-list">
                {DISHES.map((dish) => (
                  <div className="uk-dish" key={dish.name}>
                    <span className="uk-dish-name">{dish.name}</span>
                    {dish.feedKg == null ? (
                      /* 未称重显示「—」而非 0：缺失不等于零（PRD:122） */
                      <b className="uk-dish-feed is-empty">—</b>
                    ) : (
                      <b className="uk-dish-feed">
                        {dish.feedKg.toFixed(1)}
                        <i>kg</i>
                      </b>
                    )}
                    <b className={dish.done === dish.total ? 'is-done' : ''}>
                      {dish.done === dish.total ? '已出餐' : '烹饪中'}
                    </b>
                  </div>
                ))}
              </div>
              <p className="uk-dish-total">
                今日累计投料<b>{FEED_TOTAL_KG.toFixed(1)}</b>kg · 已称重 {WEIGHED.length} 道
              </p>
            </section>
          </aside>

          <section className="uk-col uk-main">
            <section className="uk-panel uk-line">
              <h2>
                产线动线
              </h2>
              <div className="uk-line-stage">
                <svg viewBox="0 0 1040 400" preserveAspectRatio="xMidYMid meet">
                  {/* 五个环节横排：投料 → 称重加料 → 摆盆 → 烹饪 → 出餐。
                      摆盆在烹饪之前——按工单状态机，摆盆完成（容器全部摆好）后
                      工单才进入「待烹饪」，容器再被搬进烹饪设备。
                      轨道 y=240，即炒菜机（y 128–196）与烤箱（y 284–352）之间的净空带中线，
                      在途料箱才不会压在设备面板和标签上。 */}
                  <line className="uk-rail" x1="90" y1="240" x2="950" y2="240" />
                  <line className="uk-rail-glow" x1="90" y1="240" x2="950" y2="240" />

                  <g className="uk-zone">
                    <rect x="20" y="80" width="140" height="300" rx="10" />
                    <text x="90" y="64" textAnchor="middle">投料区</text>
                    <rect className="uk-box" x="41" y="128" width="46" height="52" rx="6" />
                    <rect className="uk-box" x="93" y="128" width="46" height="52" rx="6" />
                    {/* 待取料箱与轨道同高（中心 y=240），料箱出箱时与在途料箱对齐 */}
                    <rect className="uk-box is-ready" x="67" y="218" width="46" height="44" rx="6" />
                  </g>

                  <g className="uk-zone">
                    <rect x="195" y="80" width="130" height="300" rx="10" />
                    <text x="260" y="64" textAnchor="middle">称重加料区</text>
                    <rect className="uk-weigh" x="204" y="128" width="50" height="52" rx="6" />
                    <rect className="uk-weigh" x="266" y="128" width="50" height="52" rx="6" />
                    <rect className="uk-weigh is-ready" x="235" y="218" width="50" height="44" rx="6" />
                  </g>

                  <g className="uk-zone">
                    <rect x="360" y="80" width="130" height="300" rx="10" />
                    <text x="425" y="64" textAnchor="middle">摆盆区</text>
                    <rect className="uk-tray" x="369" y="128" width="50" height="52" rx="6" />
                    <rect className="uk-tray" x="431" y="128" width="50" height="52" rx="6" />
                    <rect className="uk-tray is-ready" x="400" y="218" width="50" height="44" rx="6" />
                  </g>

                  <g className="uk-zone">
                    <rect x="525" y="80" width="320" height="300" rx="10" />
                    <text x="685" y="64" textAnchor="middle">烹饪区 · 4 台炒菜机 / 2 台烤箱</text>
                    {[0, 1, 2, 3].map((i) => (
                      <g key={`c${i}`}>
                        {/* 台间呼吸灯错峰由内联延迟控制 */}
                        <rect
                          className="uk-cooker"
                          x={543 + i * 74}
                          y="128"
                          width="62"
                          height="68"
                          rx="8"
                          style={{ animationDelay: `${(i % 2) * 1.4}s` }}
                        />
                        <text className="uk-cooker-label" x={574 + i * 74} y="166" textAnchor="middle">CCJ{i + 1}</text>
                      </g>
                    ))}
                    {[0, 1].map((i) => (
                      <g key={`o${i}`}>
                        <rect className="uk-oven" x={569 + i * 128} y="284" width="104" height="68" rx="8" />
                        <text className="uk-oven-label" x={621 + i * 128} y="323" textAnchor="middle">KXJ{i + 1}</text>
                      </g>
                    ))}
                  </g>

                  <g className="uk-zone">
                    <rect x="880" y="80" width="140" height="300" rx="10" />
                    <text x="950" y="64" textAnchor="middle">出餐区</text>
                    <rect className="uk-port" x="898" y="128" width="104" height="68" rx="8" />
                    <text className="uk-port-label" x="950" y="167" textAnchor="middle">出口 1</text>
                    <rect className="uk-port" x="898" y="284" width="104" height="68" rx="8" />
                    <text className="uk-port-label" x="950" y="323" textAnchor="middle">出口 2</text>
                  </g>

                  {/* 机械臂：位于投料区与称重加料区之间的间隙，中心随轨道下移到 y=240 */}
                  <g className="uk-arm">
                    <rect x="161" y="200" width="34" height="80" rx="8" />
                    <circle cx="178" cy="192" r="11" />
                  </g>

                  {/* 在途料箱：节拍「15 秒 / 趟」→ 每 15 秒投入一个料箱，
                      走完投料区→出餐区（x 90 → 950，共 860px）约需 30 秒，
                      所以线上同时有 2 个在途料箱、相位相差 180°。
                      两个料箱统一贴轨道中线（y=229，高 22 → 中心 240），不再上下错位。 */}
                  {[0, 1].map((i) => (
                    <rect
                      className="uk-box-move"
                      key={`m${i}`}
                      x="0"
                      y="229"
                      width="44"
                      height="22"
                      rx="4"
                      style={{ animationDelay: `${i * -15}s` }}
                    />
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
              <h2>设备运行</h2>
              <div className="uk-device-grid">
                <div><b>4</b><span>炒菜机</span></div>
                <div><b>2</b><span>烤箱</span></div>
                <div><b>2</b><span>机械臂</span></div>
                <div><b>8</b><span>在线设备</span></div>
              </div>
            </section>

            <section className="uk-panel uk-cooking">
              <h2>烹饪中</h2>
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
              <h2>出餐区出餐记录</h2>
              <div className="uk-flow">
                {visibleFlow.map((item, index) => (
                  <div className="uk-flow-row" key={`${item.port}-${item.dish}-${index}`}>
                    <span className="uk-flow-port" style={{ borderColor: item.color, color: item.color }}>{item.port}</span>
                    <span className="uk-flow-dish">{item.dish}</span>
                    <b>{item.qty}</b>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </main>

        <footer className="uk-bottom" hidden={view !== 'cockpit'}>
          <div className="uk-metrics">
            {METRICS.map((metric) => (
              <div className="uk-metric" key={metric.label}>
                <span>{metric.label}</span>
                <b>{metric.value}</b>
              </div>
            ))}
          </div>
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
