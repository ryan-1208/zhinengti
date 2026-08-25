/**
 * @name 岗位规划看板
 */
import React, { useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    CircleHelp,
    Clock3,
    Factory,
    Filter,
    Gauge,
    GitBranch,
    Layers3,
    LayoutDashboard,
    ListChecks,
    LockKeyhole,
    MoreHorizontal,
    PackageCheck,
    PlayCircle,
    RefreshCw,
    Route,
    Send,
    Settings2,
    ShieldAlert,
    SlidersHorizontal,
    Sparkles,
    Timer,
    UsersRound,
    X,
    Zap,
} from 'lucide-react';
import './style.css';

type DrawerType = 'parameters' | 'task' | 'risk' | 'simulate' | null;
type FilterType = 'all' | 'risk' | 'transfer';
type TaskState = 'active' | 'waiting' | 'risk' | 'done';

type PlanParams = {
    serviceTime: string;
    lineReady: string;
    headcount: number;
    handoff: number;
    buffer: number;
    equipment: number;
};

type Task = {
    id: string;
    slot: string;
    operation: string;
    role: string;
    area: string;
    dish: string;
    workOrder: string;
    state: TaskState;
    source: string;
    note?: string;
};

const displayName = '岗位规划看板';
const slotColors: Record<string, string> = {
    P1: 'slot-orange',
    P2: 'slot-blue',
    P3: 'slot-green',
    P4: 'slot-purple',
};

const timelineRows: { time: string; label: string; tasks: Task[] }[] = [
    {
        time: '08:15—08:35',
        label: '准备窗口',
        tasks: [
            { id: 'p1-1', slot: 'P1', operation: '肉禽腌制', role: '预处理岗', area: '冷加工区', dish: '宫保鸡丁', workOrder: 'WO-24081', state: 'waiting', source: '菜品工艺 · 腌制等待', note: '等待时间不计入主动工时' },
            { id: 'p2-1', slot: 'P2', operation: '水产称量', role: '称量分装岗', area: '称量区', dish: '清蒸鲈鱼', workOrder: 'WO-24084', state: 'active', source: '用工标准 · 按盆称量' },
            { id: 'p3-1', slot: 'P3', operation: '根茎焯烫', role: '焯烫岗', area: '预处理区', dish: '西兰花炒虾仁', workOrder: 'WO-24086', state: 'active', source: '菜品工艺 · 焯烫步骤' },
            { id: 'p4-1', slot: 'P4', operation: '称量分装', role: '称量分装岗', area: '称量区', dish: '红烧牛腩', workOrder: 'WO-24088', state: 'active', source: '用工标准 · 按锅分装' },
        ],
    },
    {
        time: '08:35—09:05',
        label: '主动操作',
        tasks: [
            { id: 'p1-2', slot: 'P1', operation: '拉油 / 预炸', role: '拉油岗', area: '热加工区', dish: '宫保鸡丁', workOrder: 'WO-24081', state: 'active', source: '菜品工艺 · 拉油步骤' },
            { id: 'p2-2', slot: 'P2', operation: '水产拉油', role: '拉油岗', area: '热加工区', dish: '清蒸鲈鱼', workOrder: 'WO-24084', state: 'active', source: '菜品工艺 · 拉油步骤' },
            { id: 'p3-2', slot: 'P3', operation: '焯烫续作', role: '焯烫岗', area: '预处理区', dish: '菌菇拼盘', workOrder: 'WO-24090', state: 'active', source: '菜品工艺 · 焯烫步骤' },
            { id: 'p4-2', slot: 'P4', operation: '分装装盘', role: '称量分装岗', area: '称量区', dish: '红烧牛腩', workOrder: 'WO-24088', state: 'active', source: '用工标准 · 按盆分装' },
        ],
    },
    {
        time: '09:05—09:25',
        label: '复核窗口',
        tasks: [
            { id: 'p1-3', slot: 'P1', operation: '肉禽复核', role: '预处理岗', area: '冷加工区', dish: '宫保鸡丁', workOrder: 'WO-24081', state: 'active', source: '前置依赖校验' },
            { id: 'p2-3', slot: 'P2', operation: '水产复核', role: '称量分装岗', area: '称量区', dish: '清蒸鲈鱼', workOrder: 'WO-24084', state: 'active', source: '前置依赖校验' },
            { id: 'p3-3', slot: 'P3', operation: '焯烫复核', role: '焯烫岗', area: '预处理区', dish: '西兰花炒虾仁', workOrder: 'WO-24086', state: 'active', source: '前置依赖校验' },
            { id: 'p4-3', slot: 'P4', operation: '标签复核', role: '交接岗', area: '交接区', dish: '今日批次', workOrder: 'WO-24092', state: 'active', source: '工单规则 · 批次交接' },
        ],
    },
    {
        time: '09:25—09:40',
        label: '交接峰值',
        tasks: [
            { id: 'p1-4', slot: 'P1', operation: '炒菜机 1 转运', role: '转运交接岗', area: '设备线', dish: '肉禽批次 A', workOrder: 'WO-24081', state: 'risk', source: '设备节点 · 交接缓冲', note: '当前 4 个槽位，峰值需求 5 个' },
            { id: 'p2-4', slot: 'P2', operation: '炒菜机 2 转运', role: '转运交接岗', area: '设备线', dish: '水产批次 A', workOrder: 'WO-24084', state: 'risk', source: '设备节点 · 交接缓冲', note: '缺 1 个转运槽位' },
            { id: 'p3-4', slot: 'P3', operation: '蒸烤盘转运', role: '转运交接岗', area: '蒸烤线', dish: '素菜批次 B', workOrder: 'WO-24086', state: 'risk', source: '设备节点 · 交接缓冲', note: '可能影响 2 张工单' },
            { id: 'p4-4', slot: 'P4', operation: '设备线交接', role: '交接岗', area: '交接区', dish: '今日批次', workOrder: 'WO-24092', state: 'active', source: '设备节点 · 设备线到位' },
        ],
    },
    {
        time: '09:40—10:00',
        label: '设备准备',
        tasks: [
            { id: 'p1-5', slot: 'P1', operation: '设备交接', role: '交接岗', area: '设备线', dish: '炒菜机 1', workOrder: 'WO-24081', state: 'done', source: '设备节点 · 设备线到位' },
            { id: 'p2-5', slot: 'P2', operation: '设备交接', role: '交接岗', area: '设备线', dish: '炒菜机 2', workOrder: 'WO-24084', state: 'done', source: '设备节点 · 设备线到位' },
            { id: 'p3-5', slot: 'P3', operation: '蒸烤盘交接', role: '交接岗', area: '蒸烤线', dish: '蒸烤箱 1', workOrder: 'WO-24086', state: 'active', source: '设备节点 · 设备线到位' },
            { id: 'p4-5', slot: 'P4', operation: '设备参数确认', role: '设备岗', area: '设备线', dish: '炒菜机 4', workOrder: 'WO-24092', state: 'active', source: '设备节点 · 设备准备' },
        ],
    },
    {
        time: '10:00—10:30',
        label: '烹饪前检查',
        tasks: [
            { id: 'p1-6', slot: 'P1', operation: '加料复核', role: '烹饪准备岗', area: '设备线', dish: '宫保鸡丁', workOrder: 'WO-24081', state: 'active', source: '工单阶段 · 待烹饪' },
            { id: 'p2-6', slot: 'P2', operation: '摆盆确认', role: '摆盆岗', area: '设备线', dish: '清蒸鲈鱼', workOrder: 'WO-24084', state: 'active', source: '工单阶段 · 待烹饪' },
            { id: 'p3-6', slot: 'P3', operation: '蒸烤预热确认', role: '设备岗', area: '蒸烤线', dish: '菌菇拼盘', workOrder: 'WO-24090', state: 'active', source: '工单阶段 · 预热中' },
            { id: 'p4-6', slot: 'P4', operation: '设备巡检', role: '设备岗', area: '设备线', dish: '今日批次', workOrder: 'WO-24092', state: 'active', source: '岗位用工标准 · 设备巡检' },
        ],
    },
];

const navItems = [
    { label: '岗位规划看板', icon: LayoutDashboard, active: true },
    { label: '生产工艺', icon: GitBranch },
    { label: '生产工单', icon: ListChecks },
    { label: '岗位用工标准', icon: Layers3 },
    { label: '人员槽位配置', icon: UsersRound },
];

const toMinutes = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
};

const formatTime = (total: number) => {
    const normalized = Math.max(0, total);
    const hour = Math.floor(normalized / 60).toString().padStart(2, '0');
    const minute = Math.round(normalized % 60).toString().padStart(2, '0');
    return `${hour}:${minute}`;
};

function MetricCard({ label, value, detail, tone = 'neutral', icon, onClick }: { label: string; value: string; detail: string; tone?: 'neutral' | 'accent' | 'warning' | 'danger' | 'success'; icon: React.ReactNode; onClick?: () => void }) {
    return <button type="button" className={`metric-card metric-${tone}`} onClick={onClick}><div className="metric-topline"><span className="metric-label">{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}</strong><span className="metric-detail">{detail}</span></button>;
}

function Drawer({ title, eyebrow, children, onClose, wide = false }: { title: string; eyebrow: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
    return <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><aside className={`drawer ${wide ? 'drawer-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="drawer-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button type="button" className="icon-button" aria-label="关闭" onClick={onClose}><X size={18} /></button></div><div className="drawer-content">{children}</div></aside></div>;
}

export default function RolePlanningBoard() {
    const [params, setParams] = useState<PlanParams>({ serviceTime: '11:00', lineReady: '09:40', headcount: 4, handoff: 15, buffer: 10, equipment: 4 });
    const [draftParams, setDraftParams] = useState(params);
    const [drawer, setDrawer] = useState<DrawerType>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');
    const [published, setPublished] = useState(false);
    const [delaySimulated, setDelaySimulated] = useState(false);
    const [toast, setToast] = useState('');
    const [lastUpdated, setLastUpdated] = useState('08:12');

    const plan = useMemo(() => {
        const totalActive = 188;
        const averageActive = Math.ceil(totalActive / params.headcount);
        const baseStart = 8 * 60 + 15;
        const start = baseStart + (4 - params.headcount) * 8 + (params.handoff - 15) + (params.buffer - 10) - (params.equipment - 4) * 4;
        const peakDemand = Math.max(5, params.equipment + 1);
        const shortfall = Math.max(0, peakDemand - params.headcount);
        const risk = shortfall > 0 ? '存在风险' : '正常';
        return { totalActive, averageActive, start, peakDemand, shortfall, risk };
    }, [params]);

    const showToast = (message: string) => {
        setToast(message);
        window.setTimeout(() => setToast(''), 2600);
    };

    const openTask = (task: Task) => { setSelectedTask(task); setDrawer('task'); };
    const applyParams = () => { setParams(draftParams); setLastUpdated('刚刚'); setPublished(false); setDrawer(null); showToast('已更新倒排参数，未锁定任务已重新计算'); };
    const recalculate = () => { setLastUpdated('刚刚'); setPublished(false); showToast('倒排计划已重新计算，风险提示已刷新'); };
    const publish = () => { setPublished(true); showToast('岗位规划已发布，现场看板可按槽位查看'); };
    const simulateDelay = () => { setDelaySimulated(true); setPublished(false); showToast('WO-24084 延误 8 分钟，未开始任务已顺延'); };

    const filteredRows = useMemo(() => timelineRows.map((row) => ({ ...row, tasks: row.tasks.map((task) => ({ ...task, hidden: filter === 'risk' ? task.state !== 'risk' : filter === 'transfer' ? task.role !== '转运交接岗' && task.role !== '交接岗' : false })) })), [filter]);
    const selectedTaskRow = selectedTask ? timelineRows.find((row) => row.tasks.some((task) => task.id === selectedTask.id)) : null;

    return (
        <main className="planning-app" aria-label={displayName}>
            <aside className="app-sidebar">
                <div className="brand-block"><div className="brand-mark"><Factory size={17} /></div><div><strong>备餐 OS</strong><span>生产管理平台</span></div></div>
                <div className="workspace-switcher"><span className="workspace-dot" /><span>清华项目 · 一期</span><ChevronDown size={14} /></div>
                <div className="nav-section-label">生产管理</div>
                <nav className="app-nav" aria-label="生产管理导航">{navItems.map((item) => { const Icon = item.icon; return <button type="button" key={item.label} className={`nav-item ${item.active ? 'nav-item-active' : ''}`} onClick={() => !item.active && showToast(`${item.label}将在后续版本展开`)}><Icon size={17} strokeWidth={item.active ? 2.2 : 1.8} /><span>{item.label}</span>{!item.active && <span className="nav-lock"><LockKeyhole size={12} /></span>}</button>; })}</nav>
                <div className="sidebar-bottom"><button type="button" className="nav-item" onClick={() => showToast('系统设置将在后续版本展开')}><Settings2 size={17} /><span>系统设置</span></button><div className="profile-mini"><div className="avatar">林</div><div><strong>林计划</strong><span>项目经理</span></div><MoreHorizontal size={16} /></div></div>
            </aside>

            <section className="app-content">
                <header className="top-header"><div className="mobile-brand"><div className="brand-mark"><Factory size={16} /></div><strong>备餐 OS</strong></div><div className="breadcrumbs"><span>生产管理</span><ChevronRight size={14} /><strong>岗位规划看板</strong></div><div className="header-actions"><button type="button" className="header-icon-button" aria-label="帮助" onClick={() => showToast('看板按 15 分钟汇总，底层任务精确到分钟')}><CircleHelp size={17} /></button><div className="header-divider" /><button type="button" className="header-profile" onClick={() => showToast('当前以项目经理权限查看')}><span className="avatar avatar-small">林</span><span>林计划</span><ChevronDown size={14} /></button></div></header>

                <div className="content-wrap">
                    <div className="page-heading"><div><div className="heading-kicker"><span className="status-dot status-dot-live" />计划运行中 · 更新于 {lastUpdated}</div><h1>岗位规划看板</h1><p>把今天的生产节点，转换成每个匿名槽位的可执行任务。</p></div><div className="heading-actions"><button type="button" className="button button-secondary" onClick={() => { setDraftParams(params); setDrawer('simulate'); }}><Sparkles size={16} />方案模拟</button><button type="button" className="button button-secondary" onClick={recalculate}><RefreshCw size={16} />重新计算</button><button type="button" className={`button button-primary ${published ? 'button-published' : ''}`} onClick={publish}>{published ? <Check size={16} /> : <Send size={16} />}{published ? '已发布' : '发布岗位规划'}</button></div></div>

                    <section className="plan-context-card"><div className="context-main"><div className="context-icon"><CalendarDays size={19} /></div><div><span className="eyebrow">生产计划</span><strong>2026 年 8 月 20 日 · 午餐</strong><span className="context-sub">开餐时间 <b>{params.serviceTime}</b><span className="dot-separator">·</span> 设备线到位 <b>{params.lineReady}</b></span></div></div><div className="context-controls"><label><span>日期</span><input type="date" value="2026-08-20" onChange={() => showToast('示例原型固定展示 8 月 20 日')} /></label><label><span>餐段</span><select value="午餐 · 11:00" onChange={() => showToast('当前示例仅展示午餐计划')}><option>午餐 · 11:00</option></select></label><button type="button" className="button button-quiet" onClick={() => { setDraftParams(params); setDrawer('parameters'); }}><SlidersHorizontal size={15} />调整参数</button></div></section>

                    <section className="metric-grid" aria-label="计划摘要"><MetricCard label="计划状态" value={plan.risk} detail={plan.shortfall ? '09:25—09:40 存在槽位缺口' : '当前计划满足人员需求'} tone={plan.shortfall ? 'warning' : 'success'} icon={plan.shortfall ? <ShieldAlert size={17} /> : <CheckCircle2 size={17} />} onClick={() => plan.shortfall && setDrawer('risk')} /><MetricCard label="总主动工时" value={`${plan.totalActive} 分钟`} detail="40 道菜 · 预处理步骤合计" tone="neutral" icon={<Timer size={17} />} /><MetricCard label="平均主动工时" value={`${plan.averageActive} 分钟/人`} detail={`备餐人数 ${params.headcount} 人`} tone="accent" icon={<Gauge size={17} />} /><MetricCard label="备餐开始" value={formatTime(plan.start)} detail={`设备线到位前 ${Math.max(0, toMinutes(params.lineReady) - plan.start)} 分钟`} tone="neutral" icon={<Clock3 size={17} />} /><MetricCard label="峰值需求" value={`${plan.peakDemand} 个槽位`} detail={`当前可用 ${params.headcount} 个`} tone={plan.shortfall ? 'danger' : 'success'} icon={<UsersRound size={17} />} onClick={() => plan.shortfall && setDrawer('risk')} /><MetricCard label="缺口" value={plan.shortfall ? `缺 ${plan.shortfall} 个` : '无缺口'} detail={plan.shortfall ? '影响 2 张工单进入烹饪' : '可以按当前计划执行'} tone={plan.shortfall ? 'danger' : 'success'} icon={plan.shortfall ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />} onClick={() => plan.shortfall && setDrawer('risk')} /></section>

                    {delaySimulated && <div className="delay-banner"><div className="delay-banner-icon"><AlertTriangle size={17} /></div><div><strong>生产中修正已模拟</strong><span>WO-24084 延误 8 分钟，未开始任务已顺延；已完成任务保持不变。</span></div><button type="button" onClick={() => setDelaySimulated(false)} aria-label="关闭提示"><X size={16} /></button></div>}

                    <section className="board-toolbar"><div><div className="section-title-row"><h2>槽位时间轴</h2><span className="live-badge"><span className="status-dot status-dot-live" />按 15 分钟汇总</span></div><p>每个任务精确到分钟，点击任务卡查看工单、工艺和计算来源。</p></div><div className="toolbar-actions"><div className="filter-group"><button type="button" className={`filter-button ${filter === 'all' ? 'filter-active' : ''}`} onClick={() => setFilter('all')}><Filter size={14} />全部</button><button type="button" className={`filter-button ${filter === 'risk' ? 'filter-active filter-risk' : ''}`} onClick={() => setFilter('risk')}><AlertTriangle size={14} />风险</button><button type="button" className={`filter-button ${filter === 'transfer' ? 'filter-active' : ''}`} onClick={() => setFilter('transfer')}><Route size={14} />交接</button></div><button type="button" className="text-button" onClick={simulateDelay}><PlayCircle size={15} />模拟工单延误</button></div></section>

                    <section className="board-layout"><div className="timeline-card"><div className="timeline-scroll"><div className="timeline-head"><div className="time-head">时间 / 节点</div>{['P1', 'P2', 'P3', 'P4'].map((slot) => <div className="slot-head" key={slot}><span className={`slot-dot ${slotColors[slot]}`} />{slot}<small>{slot === 'P1' ? '预处理' : slot === 'P2' ? '称量' : slot === 'P3' ? '焯烫' : '交接'}</small></div>)}</div>{filteredRows.map((row) => <div className="timeline-row" key={row.time}><div className="time-cell"><strong>{row.time}</strong><span>{row.label}</span></div>{row.tasks.map((task) => <button type="button" className={`task-card task-${task.state} ${task.hidden ? 'task-hidden' : ''}`} key={task.id} onClick={() => !task.hidden && openTask(task)}><div className="task-card-top"><span className={`task-slot ${slotColors[task.slot]}`}>{task.slot}</span><span className="task-time">{row.time.split('—')[0]}</span></div><strong>{task.operation}</strong><span className="task-role">{task.role} · {task.area}</span><span className="task-dish">{task.dish}</span>{task.state === 'risk' && <span className="task-risk-note"><AlertTriangle size={12} />{task.note}</span>}{task.state === 'waiting' && <span className="task-wait-note"><Clock3 size={12} />等待依赖</span>}{task.state === 'done' && <span className="task-done-note"><Check size={12} />已完成</span>}</button>)}</div>)}</div><div className="timeline-footer"><span><i className="legend-dot legend-active" />主动任务</span><span><i className="legend-dot legend-waiting" />等待 / 不占主动工时</span><span><i className="legend-dot legend-risk" />缺口 / 冲突</span><span><i className="legend-dot legend-done" />已完成</span><span className="timeline-foot-note"><LockKeyhole size={12} />公共看板仅显示匿名槽位</span></div></div>

                        <aside className="risk-panel"><div className="risk-panel-header"><div><span className="eyebrow">需关注</span><h2>风险与资源</h2></div><button type="button" className="icon-button" aria-label="更多风险操作" onClick={() => setDrawer('risk')}><MoreHorizontal size={17} /></button></div><div className={`risk-hero ${plan.shortfall ? 'risk-hero-warning' : 'risk-hero-success'}`}><div className="risk-hero-icon">{plan.shortfall ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}</div><div><strong>{plan.shortfall ? `缺口 ${plan.shortfall} 个槽位` : '当前计划可执行'}</strong><span>{plan.shortfall ? '交接峰值时段需要额外转运支持' : '需求与可用槽位已匹配'}</span></div><ChevronRight size={17} /></div><div className="risk-list"><button type="button" className="risk-item" onClick={() => setDrawer('risk')}><span className="risk-item-icon risk-item-icon-danger"><AlertTriangle size={15} /></span><span><strong>转运交接缺口</strong><small>09:25—09:40 · 缺 1 个</small></span><ChevronRight size={15} /></button><button type="button" className="risk-item" onClick={() => setDrawer('risk')}><span className="risk-item-icon risk-item-icon-warning"><Clock3 size={15} /></span><span><strong>缓冲仅剩 5 分钟</strong><small>WO-24084 · 预计影响烹饪</small></span><ChevronRight size={15} /></button><button type="button" className="risk-item" onClick={() => setDrawer('risk')}><span className="risk-item-icon risk-item-icon-neutral"><Zap size={15} /></span><span><strong>设备线已准备</strong><small>4 台设备 · 09:40 到位</small></span><ChevronRight size={15} /></button></div><div className="capacity-block"><div className="capacity-title"><span>槽位利用率</span><strong>{Math.min(100, Math.round((params.headcount / plan.peakDemand) * 100))}%</strong></div><div className="capacity-bar"><span style={{ width: `${Math.min(100, Math.round((params.headcount / plan.peakDemand) * 100))}%` }} /></div><div className="capacity-meta"><span>可用 {params.headcount} 个</span><span>峰值 {plan.peakDemand} 个</span></div></div><button type="button" className="risk-detail-link" onClick={() => setDrawer('simulate')}><Sparkles size={14} />打开方案模拟 <ArrowUpRight size={14} /></button></aside></section>

                    <section className="lower-grid"><div className="info-card"><div className="info-card-header"><div><span className="eyebrow">岗位需求</span><h2>区域与岗位汇总</h2></div><button type="button" className="text-button" onClick={() => showToast('汇总数据已按当前筛选刷新')}>刷新 <RefreshCw size={13} /></button></div><div className="summary-table"><div className="summary-table-head"><span>岗位 / 区域</span><span>需求</span><span>可用</span><span>状态</span></div>{[['预处理岗', '预处理区', '2', '2', '满足'], ['称量分装岗', '称量区', '2', '2', '满足'], ['转运交接岗', '设备线', '5', String(params.headcount), plan.shortfall ? '缺口' : '满足'], ['设备岗', '蒸烤线', '2', '2', '满足']].map(([role, area, demand, available, status]) => <div className="summary-table-row" key={role}><span><strong>{role}</strong><small>{area}</small></span><b>{demand}</b><span>{available}</span><span className={`table-status ${status === '缺口' ? 'status-danger' : 'status-success'}`}><i />{status}</span></div>)}</div></div><div className="info-card trace-card"><div className="info-card-header"><div><span className="eyebrow">计算追溯</span><h2>本次计划来源</h2></div><button type="button" className="icon-button" aria-label="查看计算说明" onClick={() => showToast('计算版本 V0.8 · 工艺规则 R-2026.08')}><CircleHelp size={16} /></button></div><div className="trace-list"><div><span className="trace-number">01</span><span><strong>读取生产工单</strong><small>100 张以内 · 当前 42 张待执行</small></span><CheckCircle2 size={16} /></div><div><span className="trace-number">02</span><span><strong>汇总主动工时</strong><small>{plan.totalActive} 分钟 · 腌制等待未计入</small></span><CheckCircle2 size={16} /></div><div><span className="trace-number">03</span><span><strong>分配匿名槽位</strong><small>P1—P4 · 技能标签匹配</small></span><CheckCircle2 size={16} /></div><div><span className="trace-number">04</span><span><strong>检查峰值与冲突</strong><small>{plan.shortfall ? '发现 1 处需人工调整' : '未发现人员缺口'}</small></span>{plan.shortfall ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}</div></div></div></section>
                </div>
            </section>

            {drawer === 'parameters' && <Drawer eyebrow="计划输入" title="调整倒排参数" onClose={() => setDrawer(null)}><div className="drawer-intro"><Settings2 size={17} /><span>修改后将更新所有未锁定任务，已完成任务不会被覆盖。</span></div><div className="form-grid"><label><span>开餐时间</span><input type="time" value={draftParams.serviceTime} onChange={(event) => setDraftParams({ ...draftParams, serviceTime: event.target.value })} /></label><label><span>设备线到位</span><input type="time" value={draftParams.lineReady} onChange={(event) => setDraftParams({ ...draftParams, lineReady: event.target.value })} /></label><label><span>备餐人数</span><input type="number" min="1" max="8" value={draftParams.headcount} onChange={(event) => setDraftParams({ ...draftParams, headcount: Number(event.target.value) })} /></label><label><span>设备数量</span><input type="number" min="1" max="8" value={draftParams.equipment} onChange={(event) => setDraftParams({ ...draftParams, equipment: Number(event.target.value) })} /></label><label><span>交接缓冲（分钟）</span><input type="number" min="0" max="60" value={draftParams.handoff} onChange={(event) => setDraftParams({ ...draftParams, handoff: Number(event.target.value) })} /></label><label><span>异常缓冲（分钟）</span><input type="number" min="0" max="60" value={draftParams.buffer} onChange={(event) => setDraftParams({ ...draftParams, buffer: Number(event.target.value) })} /></label></div><div className="drawer-section"><div className="drawer-section-title"><span>重算预览</span><span className="status-chip chip-warning">待确认</span></div><div className="preview-diff"><div><small>备餐开始</small><strong>{formatTime(8 * 60 + 15 + (4 - draftParams.headcount) * 8 + (draftParams.handoff - 15) + (draftParams.buffer - 10) - (draftParams.equipment - 4) * 4)}</strong></div><ArrowDownRight size={16} /><div><small>峰值需求</small><strong>{Math.max(5, draftParams.equipment + 1)} 个槽位</strong></div></div></div><div className="drawer-actions"><button type="button" className="button button-secondary" onClick={() => setDrawer(null)}>取消</button><button type="button" className="button button-primary" onClick={applyParams}><RefreshCw size={15} />保存并重新计算</button></div></Drawer>}

            {drawer === 'task' && selectedTask && <Drawer eyebrow={`任务 ${selectedTask.workOrder}`} title={selectedTask.operation} onClose={() => setDrawer(null)}><div className={`drawer-task-banner ${selectedTask.state === 'risk' ? 'banner-danger' : selectedTask.state === 'waiting' ? 'banner-waiting' : selectedTask.state === 'done' ? 'banner-done' : 'banner-active'}`}><span className={`task-slot ${slotColors[selectedTask.slot]}`}>{selectedTask.slot}</span><div><strong>{selectedTask.state === 'risk' ? '存在风险' : selectedTask.state === 'waiting' ? '等待前置依赖' : selectedTask.state === 'done' ? '已完成' : '执行中'}</strong><span>{selectedTaskRow?.time} · {selectedTask.area}</span></div></div><div className="detail-grid"><div><span>岗位</span><strong>{selectedTask.role}</strong></div><div><span>关联菜品</span><strong>{selectedTask.dish}</strong></div><div><span>工单</span><strong>{selectedTask.workOrder}</strong></div><div><span>槽位</span><strong>{selectedTask.slot} · 匿名</strong></div></div><div className="drawer-section"><div className="drawer-section-title"><span>计算来源</span><GitBranch size={15} /></div><div className="source-trace"><div className="source-trace-dot" /><div><strong>{selectedTask.source}</strong><p>任务时间由菜品步骤工时、工单阶段和设备线节点共同倒排生成。</p></div></div></div>{selectedTask.note && <div className="callout callout-warning"><AlertTriangle size={16} /><span>{selectedTask.note}</span></div>}<button type="button" className="full-button" onClick={() => { setDrawer('risk'); }}>查看关联风险 <ChevronRight size={15} /></button></Drawer>}

            {drawer === 'risk' && <Drawer eyebrow="风险详情" title="转运交接缺口" onClose={() => setDrawer(null)} wide><div className="risk-detail-hero"><div className="risk-detail-icon"><AlertTriangle size={22} /></div><div><strong>09:25—09:40 缺 1 个槽位</strong><span>当前可用 4 个，峰值需求 5 个</span></div><span className="status-chip chip-danger">P1 风险</span></div><div className="drawer-section"><div className="drawer-section-title"><span>影响范围</span><span className="eyebrow">2 张工单</span></div><div className="affected-orders"><div><span className="order-icon"><PackageCheck size={15} /></span><span><strong>WO-24084 · 清蒸鲈鱼</strong><small>炒菜机 2 转运 · 预计延误 8 分钟</small></span><ArrowUpRight size={15} /></div><div><span className="order-icon"><PackageCheck size={15} /></span><span><strong>WO-24086 · 西兰花炒虾仁</strong><small>蒸烤盘转运 · 缓冲仅剩 5 分钟</small></span><ArrowUpRight size={15} /></div></div></div><div className="drawer-section"><div className="drawer-section-title"><span>建议调整方向</span></div><div className="suggestion-list"><button type="button" onClick={() => setDrawer('simulate')}><span className="suggestion-icon"><UsersRound size={16} /></span><span><strong>增加 1 个备餐槽位</strong><small>直接消除峰值缺口</small></span><ChevronRight size={15} /></button><button type="button" onClick={() => setDrawer('simulate')}><span className="suggestion-icon"><Route size={16} /></span><span><strong>错峰开始转运</strong><small>延后 P3 3 分钟，保留当前人数</small></span><ChevronRight size={15} /></button><button type="button" onClick={() => setDrawer('simulate')}><span className="suggestion-icon"><Factory size={16} /></span><span><strong>启用备用设备</strong><small>减少设备线交接集中度</small></span><ChevronRight size={15} /></button></div></div><div className="drawer-actions"><button type="button" className="button button-secondary" onClick={() => setDrawer(null)}>稍后处理</button><button type="button" className="button button-primary" onClick={() => setDrawer('simulate')}><Sparkles size={15} />进入方案模拟</button></div></Drawer>}

            {drawer === 'simulate' && <Drawer eyebrow="方案模拟" title="调整人力与窗口" onClose={() => setDrawer(null)}><div className="simulation-note"><Sparkles size={16} /><span>只试算，不会自动调班或修改现有工单状态。</span></div><div className="simulation-control"><div><strong>备餐人数</strong><span>增加槽位可直接覆盖交接峰值</span></div><div className="stepper"><button type="button" onClick={() => setDraftParams({ ...draftParams, headcount: Math.max(1, draftParams.headcount - 1) })}>−</button><strong>{draftParams.headcount}</strong><button type="button" onClick={() => setDraftParams({ ...draftParams, headcount: Math.min(8, draftParams.headcount + 1) })}>+</button></div></div><div className="simulation-control"><div><strong>设备数量</strong><span>备用设备减少同刻度转运压力</span></div><div className="stepper"><button type="button" onClick={() => setDraftParams({ ...draftParams, equipment: Math.max(1, draftParams.equipment - 1) })}>−</button><strong>{draftParams.equipment}</strong><button type="button" onClick={() => setDraftParams({ ...draftParams, equipment: Math.min(8, draftParams.equipment + 1) })}>+</button></div></div><div className="simulation-control"><div><strong>交接缓冲</strong><span>延长窗口会推迟备餐开始</span></div><div className="stepper"><button type="button" onClick={() => setDraftParams({ ...draftParams, handoff: Math.max(0, draftParams.handoff - 5) })}>−</button><strong>{draftParams.handoff}m</strong><button type="button" onClick={() => setDraftParams({ ...draftParams, handoff: Math.min(60, draftParams.handoff + 5) })}>+</button></div></div><div className="simulation-result"><div className="simulation-result-header"><span>模拟结果</span><span className="status-chip chip-success"><Check size={12} />可执行</span></div><div className="simulation-metrics"><div><small>缺口</small><strong>{Math.max(0, Math.max(5, draftParams.equipment + 1) - draftParams.headcount)} 个</strong><span>当前 {plan.shortfall} 个</span></div><div><small>备餐开始</small><strong>{formatTime(8 * 60 + 15 + (4 - draftParams.headcount) * 8 + (draftParams.handoff - 15) + (draftParams.buffer - 10) - (draftParams.equipment - 4) * 4)}</strong><span>当前 {formatTime(plan.start)}</span></div><div><small>峰值利用率</small><strong>{Math.min(100, Math.round((draftParams.headcount / Math.max(5, draftParams.equipment + 1)) * 100))}%</strong><span>目标 ≤ 100%</span></div></div></div><div className="drawer-actions"><button type="button" className="button button-secondary" onClick={() => setDrawer(null)}>返回原方案</button><button type="button" className="button button-primary" onClick={() => { setParams(draftParams); setLastUpdated('刚刚'); setPublished(false); setDrawer(null); showToast('模拟方案已应用，岗位规划已重新计算'); }}><Check size={15} />应用模拟方案</button></div></Drawer>}

            {toast && <div className="toast" role="status"><CheckCircle2 size={17} /><span>{toast}</span></div>}
        </main>
    );
}
