/**
 * 运营驾驶舱。
 *
 * 行业调研归纳的非食安运营内容：生产任务、设备状态、用料与出成。
 * 当前全部为结构演示数据，接入真实系统后替换。
 */
import React from 'react';
import { DisplayShell } from '../components/DisplayShell';
import kitchenSceneImage from '../assets/生产烹饪区.png';

const KPIS = [
    { value: '1,200', label: '今日计划产量', note: '份 · 演示' },
    { value: '768', label: '已完成产量', note: '份 · 演示' },
    { value: '64%', label: '任务完成率', note: '按计划任务计算 · 演示' },
    { value: '3 / 4', label: '加工设备', note: '运行中 / 已配置 · 演示' },
    { value: '6', label: '待处理任务', note: '条 · 演示' },
    { value: '1', label: '设备告警', note: '条 · 演示' },
];

const PROGRESS_ROWS = [
    ['01', '清炒莲藕片', '鲜达供应链', '预处理完成'],
    ['02', '番茄炒蛋', '华安食材', '已出餐'],
    ['03', '土豆烧牛肉', '放心肉业', '预处理完成'],
    ['04', '青椒肉丝', '放心肉业', '预处理完成'],
    ['05', '清蒸鸡腿', '华安禽业', '预处理完成'],
    ['06', '紫菜蛋汤', '禾丰粮油', '待生产'],
    ['07', '米饭', '禾丰粮油', '待生产'],
    ['08', '时蔬拼盘', '鲜达供应链', '待生产'],
] as const;

const MATERIALS = [
    { name: '主料用量', value: '420 kg', detail: '按生产任务汇总 · 演示' },
    { name: '配料投放', value: '68 kg', detail: '称重数据接入后可替换 · 演示' },
    { name: '目标 / 实际偏差', value: '+0.8%', detail: '允许误差口径待确认 · 演示' },
    { name: '出成率', value: '92%', detail: '需有投入与产出数据 · 演示' },
];

const PRODUCTION_TREND = [42, 55, 49, 68, 72, 84, 92];
const PRODUCTION_TREND_LABELS = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00'];
const MATERIAL_TREND = [
    { label: '计划', value: 82, color: 'plan' },
    { label: '投料', value: 68, color: 'input' },
    { label: '出成', value: 61, color: 'output' },
];

export function OperationsDashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
    return (
        <DisplayShell
            title="运营驾驶舱"
            subtitle="生产执行 · 设备状态 · 用料与出成"
            current="operations"
            onNavigate={onNavigate}
            showCockpitNav
            showBottomNav={false}
            screenClassName="cc-cockpit-screen"
        >
            <div className="cc-page-head">
                <div>
                    <h2>无人智厨运营总览</h2>
                    <p>行业常见的运营驾驶舱内容：把生产、设备、用料和运维信息放到同一张图里。</p>
                </div>
                <div className="cc-head-tags">
                    <span className="cc-tag-assume">演示数据 · 数据源待接入</span>
                    <span className="cc-tag-note">不含食安模块</span>
                </div>
            </div>

            <div className="cc-op-kpis">
                {KPIS.map((item) => (
                    <div className="cc-op-kpi" key={item.label}>
                        <b>{item.value}</b>
                        <span>{item.label}</span>
                        <em>{item.note}</em>
                    </div>
                ))}
            </div>

            <div className="cc-op-main-grid">
                <section className="cc-op-panel cc-op-task-panel cc-op-progress-table-panel">
                    <h3 className="cc-op-progress-heading">生产进度</h3>
                    <div className="cc-op-progress-banner"><b>今日生产总数 12</b><span className="done">● 已完成 2</span><span className="unfinished">● 未完成 2</span></div>
                    <table className="cc-op-progress-table"><thead><tr><th>序号</th><th>菜品名称</th><th>供应商</th><th>生产状态</th></tr></thead><tbody>{PROGRESS_ROWS.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td className={index === 3 && cell === '已出餐' ? 'done-text' : ''} key={cell}>{cell}</td>)}</tr>)}</tbody></table>
                </section>

            </div>

            <div className="cc-op-visual-grid">
                <section className="cc-op-panel cc-op-chart-panel">
                    <header className="cc-op-panel-head"><div><h3>生产完成趋势</h3><p>按小时观察计划任务的完成节奏</p></div><span className="cc-op-label">趋势图</span></header>
                    <div className="cc-op-line-chart">
                        <svg viewBox="0 0 560 150" role="img" aria-label="生产完成趋势折线图">
                            <defs><linearGradient id="ccOpTrendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#17d9e5" stopOpacity=".35" /><stop offset="100%" stopColor="#17d9e5" stopOpacity="0" /></linearGradient></defs>
                            {[30, 65, 100, 135].map((y) => <line key={y} x1="18" x2="548" y1={y} y2={y} className="cc-op-chart-grid" />)}
                            <polygon points="18,127 106,112 194,118 282,88 370,82 458,54 548,36 548,135 18,135" fill="url(#ccOpTrendFill)" />
                            <polyline points="18,127 106,112 194,118 282,88 370,82 458,54 548,36" className="cc-op-chart-line" />
                            {PRODUCTION_TREND.map((value, index) => <circle key={value} cx={18 + index * 88.3} cy={135 - value} r="4" className="cc-op-chart-point" />)}
                        </svg>
                        <div className="cc-op-chart-labels">{PRODUCTION_TREND_LABELS.map((label) => <span key={label}>{label}</span>)}</div>
                    </div>
                    <div className="cc-op-chart-caption"><span><i className="cc-op-chart-dot" />完成任务数</span><b>较上一时段 +18%</b></div>
                </section>

                <section className="cc-op-panel cc-op-material-chart">
                    <header className="cc-op-panel-head"><div><h3>计划与出成对比</h3><p>用料投入和产出结果的结构展示</p></div><span className="cc-op-label">柱状图</span></header>
                    <div className="cc-op-bars">{MATERIAL_TREND.map((item) => <div className="cc-op-bar-item" key={item.label}><div className="cc-op-bar-value">{item.value}%</div><div className={`cc-op-bar ${item.color}`} style={{ height: `${item.value}%` }} /><span>{item.label}</span></div>)}</div>
                    <small className="cc-op-chart-note">称重与出成数据接入后替换演示值</small>
                </section>
            </div>

            <section className="cc-op-panel cc-op-production-panel">
                <header className="cc-op-panel-head"><div><h3>生产状态</h3><p>投料、烹饪、出餐三段状态串联展示</p></div><span className="cc-op-label">生产现场</span></header>
                <div className="cc-op-zone-grid">
                    <article className="cc-op-zone-card">
                        <h4>投料区</h4>
                        <div className="cc-op-station-row"><b>入口 1</b><span className="cc-op-zone-warn">待摆盘</span><em>切块土豆</em></div>
                        <div className="cc-op-station-row"><b>入口 2</b><span className="cc-op-zone-idle">空闲中</span><em>等待下一批次</em></div>
                        <small>投料称重：待数据接入</small>
                    </article>
                    <article className="cc-op-zone-card cc-op-cooking-zone">
                        <h4>烹饪区</h4>
                        <div className="cc-op-zone-image"><img src={kitchenSceneImage} alt="无人厨房烹饪区，展示烤箱与炒菜机" /><span className="left">烤箱 · 运行中</span><span className="right">炒菜机 · 运行中</span></div>
                        <div className="cc-op-zone-devices"><span>烤箱 <b>烹饪中</b></span><span>炒菜机 <b>烹饪中</b></span></div>
                    </article>
                    <article className="cc-op-zone-card">
                        <h4>出餐区</h4>
                        <div className="cc-op-serving-columns"><div><b>出口 1</b><span>清炒莲藕片　3盆 / 75份</span><span>番茄炒蛋　3盆 / 75份</span></div><div><b>出口 2</b><span>土豆烧牛肉　3盆 / 75份</span><span>青椒肉丝　2盆 / 50份</span></div></div>
                        <small>出餐节拍：演示口径 · 待系统接入</small>
                    </article>
                </div>
            </section>

            <div className="cc-op-lower-grid">
                <section className="cc-op-panel">
                    <header className="cc-op-panel-head"><div><h3>用料与出成</h3><p>突出称重、投料和损耗分析能力</p></div><span className="cc-op-label">称重数据</span></header>
                    <div className="cc-op-materials">
                        {MATERIALS.map((item) => <div className="cc-op-material" key={item.name}><span>{item.name}</span><b>{item.value}</b><small>{item.detail}</small></div>)}
                    </div>
                </section>

            </div>

            <div className="cc-op-foot"><span>当前数据均为结构演示，接入真实设备与系统后再替换。</span></div>
        </DisplayShell>
    );
}
