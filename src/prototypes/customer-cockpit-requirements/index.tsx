/**
 * @name 客户驾驶舱需求
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { useHashPage, defineHashPageRoute, parseHashPage } from '../../common/useHashPage';
import { isDisplayPageId, useDisplayState, writeDisplayPageId } from './components/displaySync';
import { PageSwitcher } from './components/PageSwitcher';
// 暂时下线：厨房总览、无人烹饪流程、核心设备与能力（页面文件保留在 pages/ 下，恢复时一并取消注释）
// import { KitchenOverview } from './pages/KitchenOverview';
import { OperationsDashboard } from './pages/OperationsDashboard';
// import { CookingProcess } from './pages/CookingProcess';
// import { EquipmentCapability } from './pages/EquipmentCapability';
import { BehaviorMonitor } from './pages/BehaviorMonitor';
import { DisplayControl } from './pages/DisplayControl';
import modelImage from './assets/食堂现场3D建模示例.png';
import videoWallImage from './assets/后厨监控视频墙.png';
import mouseDetectionImage from './assets/食材仓储老鼠检测.png';
import processingDetectionImage from './assets/食材加工行为检测.png';
import sellingDetectionImage from './assets/售卖间行为检测.png';
import cookingImage from './assets/生产烹饪区.png';

type Zone = { id: string; name: string; group: string; summary: string; features: string; data: string };
type Panel = 'overview' | 'safety' | 'kitchen' | 'complaint' | 'morning' | 'testing' | 'retention' | 'office' | 'mouse' | 'behavior';

const zones: Zone[] = [
    { id: 'morning', name: '出入口晨检区', group: 'safety', summary: '晨检设备 1 台 · 正常', features: '智能人脸晨检、体温/健康证/手部健康监测、自动生成晨检台账', data: '42 人已完成晨检 · 最高体温 36.8℃ · 通过率 100%' },
    { id: 'acceptance', name: '食材验收区', group: 'safety', summary: '今日验收 38 批 · 正常', features: '食材称重、供应商信息核验、合格证拍照、验收台账', data: '今日验收 38 批 · 合格 37 批 · 待复核 1 批' },
    { id: 'storage', name: '食材仓储区', group: 'storage', summary: '老鼠检测 · 1 条报警', features: '老鼠检测、活动轨迹识别、异常报警', data: '今日检测 16 次 · 发现疑似活动 1 次 · 已触发报警' },
    { id: 'testing', name: '食材检测室', group: 'safety', summary: '今日检测 12 批 · 全部合格', features: '食材农残快检、自动生成检测台账', data: '检测项目 4 项 · 最近检测 11:08 · 合格率 100%' },
    { id: 'production', name: '食材加工区', group: 'production', summary: '行为检测 · 2 条报警', features: '未佩戴口罩、未佩戴帽子、人员检测、抽烟检测', data: '当前 3 人作业 · 口罩佩戴 2/3 · 今日报警 2 条' },
    { id: 'cooking', name: '烹饪区', group: 'production', summary: '烤箱、炒菜机运行中', features: '烤箱运行监测、炒菜机运行监测、菜品生产进度、设备状态', data: '烤箱烹饪中：娃娃菜 · 炒菜机烹饪中：干锅花菜' },
    { id: 'selling', name: '售卖区', group: 'production', summary: '行为检测 · 1 条报警', features: '未佩戴口罩、未佩戴帽子、抽烟检测', data: '当前 2 人售卖 · 行为检测正常 · 今日报警 1 条' },
    { id: 'retention', name: '留样区', group: 'safety', summary: '留样完成率 96%', features: '菜品自动识别/自动称重、留样图片实时抓拍/销样提醒、自动生成留样台账', data: '今日留样 24 份 · 待销样 2 份 · 柜内温度 4.2℃' },
    { id: 'front', name: '前厅服务台', group: 'safety', summary: '2 个出口 · 平均等待 3 分钟', features: '食安数据驾驶舱、明厨亮灶公示、客诉反馈系统', data: '今日满意度 92% · 投诉 3 条 · 已处理 2 条' },
];

const markerPositions: Record<string, string> = { morning: 'm1', acceptance: 'm2', storage: 'm3', testing: 'm4', production: 'm5', cooking: 'm6', selling: 'm7', retention: 'm8', front: 'm9' };

function Stat({ value, label }: { value: string; label: string }) { return <div className="dt-stat"><b>{value}</b><span>{label}</span></div>; }

function Ledger({ type }: { type: 'morning' | 'acceptance' | 'testing' | 'retention' | 'office' }) {
    const config = {
        morning: { title: '出入口晨检区 · 晨检台账', stats: [['42', '今日晨检人数'], ['42', '人脸核验通过'], ['36.5℃', '平均体温'], ['100%', '晨检通过率']], heads: ['序号', '人员', '晨检时间', '体温', '健康证', '手部检测', '人脸核验', '结果'], rows: [['01', '张师傅', '06:42:18', '36.5℃', '有效', '合格', '通过', '通过'], ['02', '李阿姨', '06:45:03', '36.7℃', '有效', '合格', '通过', '通过'], ['03', '王师傅', '06:48:27', '36.4℃', '有效', '合格', '通过', '通过'], ['04', '赵阿姨', '06:52:11', '36.8℃', '有效', '合格', '通过', '通过'], ['05', '周阿姨', '07:01:32', '37.1℃', '有效', '合格', '复测通过', '通过']] },
        acceptance: { title: '食材验收区 · 食材验收台账', stats: [['38', '今日验收批次'], ['37', '合格批次'], ['1', '待复核批次'], ['100%', '台账完成率']], heads: ['批次编号', '食材名称', '供应商', '验收重量', '合格证', '验收时间', '验收结果'], rows: [['YS24091501', '青菜', '鲜达供应链', '120kg', '已上传', '07:18', '合格'], ['YS24091502', '鸡蛋', '华安禽业', '80kg', '已上传', '07:32', '合格'], ['YS24091503', '猪肉', '放心肉业', '95kg', '已上传', '07:46', '合格'], ['YS24091504', '大米', '禾丰粮油', '200kg', '待补拍', '08:05', '待复核'], ['YS24091505', '西红柿', '鲜达供应链', '65kg', '已上传', '08:22', '合格']] },
        testing: { title: '食材检测室 · 食材检测台账', stats: [['12', '今日检测批次'], ['4', '检测项目'], ['12', '合格批次'], ['100%', '检测合格率']], heads: ['批次', '食材名称', '供应商', '检测项目', '检测时间', '结果'], rows: [['JC24091501', '青菜', '鲜达供应链', '农药残留', '08:16', '合格'], ['JC24091502', '鸡蛋', '华安禽业', '兽药残留', '08:32', '合格'], ['JC24091503', '猪肉', '放心肉业', '瘦肉精', '08:47', '合格'], ['JC24091504', '大米', '禾丰粮油', '重金属', '09:05', '合格'], ['JC24091505', '西红柿', '鲜达供应链', '农药残留', '09:24', '合格']] },
        retention: { title: '留样区 · 留样台账', stats: [['24', '今日留样份数'], ['96%', '留样完成率'], ['2', '待销样份数'], ['4.2℃', '留样柜温度']], heads: ['序号', '菜品名称', '留样重量', '留样图片', '留样时间', '柜内温度', '销样状态'], rows: [['01', '红烧排骨', '126g', '已抓拍', '10:12:06', '4.1℃', '已销样'], ['02', '清炒时蔬', '120g', '已抓拍', '10:15:22', '4.2℃', '已销样'], ['03', '番茄炒蛋', '124g', '已抓拍', '10:18:47', '4.2℃', '待销样'], ['04', '香菇鸡块', '128g', '已抓拍', '10:22:13', '4.3℃', '待销样'], ['05', '紫菜蛋汤', '118g', '已抓拍', '10:26:34', '4.2℃', '已销样']] },
        office: { title: '办公区 · 数据台账汇总', stats: [['68', '今日汇总记录'], ['98%', '台账完整率'], ['12', '今日新增台账'], ['2', '待处置预警']], heads: ['台账类型', '今日记录', '本月累计', '完整率', '最近更新时间', '状态'], rows: [['晨检台账', '42 条', '986 条', '100%', '11:22:06', '正常'], ['食材检测台账', '12 条', '268 条', '100%', '11:08:14', '正常'], ['留样台账', '24 条', '624 条', '96%', '11:05:48', '待销样 2 份'], ['消毒台账', '6 条', '156 条', '100%', '10:56:20', '正常'], ['AI 巡检台账', '36 条', '748 条', '98%', '11:24:16', '正常']] },
    }[type];
    return <div className="dt-ledger"><div className="dt-ledger-stats">{config.stats.map(([v, l]) => <Stat key={l} value={v} label={l} />)}</div><div className="dt-ledger-card"><div className="dt-ledger-head"><h3>{config.title}</h3><span>数据更新时间：11:26:42 · 自动生成</span></div><table><thead><tr>{config.heads.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{config.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className={cell === '合格' || cell === '通过' || cell === '已销样' || cell === '正常' ? 'ok' : cell === '待销样' || cell === '关注' ? 'warn' : ''}>{cell}</td>)}</tr>)}</tbody></table><div className="dt-ledger-foot">固定演示数据 · 台账已自动归档 · 当前页面仅用于方案展示</div></div></div>;
}

function AlarmPage({ type, zoneName }: { type: 'mouse' | 'behavior'; zoneName: string }) {
    const mouse = type === 'mouse';
    const selling = zoneName === '售卖区';
    const detectionImage = mouse ? mouseDetectionImage : selling ? sellingDetectionImage : processingDetectionImage;
    const cameraName = mouse ? '仓储东侧货架' : selling ? '售卖窗口摄像头' : '食材加工台摄像头';
    const types = mouse ? ['老鼠检测', '人员检测'] : selling ? ['未佩戴口罩', '未佩戴帽子', '抽烟检测'] : ['未佩戴口罩', '未佩戴帽子', '人员检测', '抽烟检测'];
    const rows = mouse
        ? [['AL24091501', '仓储东侧货架', '疑似老鼠活动', '11:02:18', '高', '待处置'], ['AL24091502', '仓储西侧通道', '人员检测', '09:46:32', '中', '已复核'], ['AL24091408', '主食库入口', '人员检测', '昨日 22:18', '中', '已关闭']]
        : selling
            ? [['AI24091531', '售卖窗口 01', '未佩戴帽子', '11:20:06', '中', '待提醒'], ['AI24091530', '售卖窗口 02', '抽烟检测', '11:05:42', '高', '待处置'], ['AI24091528', '售卖区东侧', '未佩戴口罩', '09:38:26', '中', '已整改']]
            : [['AI24091521', '加工台 02', '未佩戴口罩', '11:18:06', '中', '待提醒'], ['AI24091520', '加工台 01', '未佩戴帽子', '10:56:42', '中', '已整改'], ['AI24091519', '通道摄像头', '人员检测', '10:22:14', '低', '正常'], ['AI24091518', '加工区西侧', '抽烟检测', '09:38:26', '高', '已处置']];
    const cards = mouse ? rows : [...rows, ...rows];
    return <div className="dt-alarm-page">
        <div className="dt-alarm-title"><div><h2>{zoneName} · {mouse ? '老鼠检测' : 'AI 行为监控'}</h2><p>{mouse ? '仓储区域生物识别与异常活动报警' : '实时展示异常行为抓拍与报警记录'}</p></div><span className="dt-live">● 实时监测</span></div>
        <div className="dt-alarm-stats">
            <Stat value={mouse ? '16' : '186'} label="全部检测" />
            <Stat value={mouse ? '1' : '12'} label={mouse ? '发现老鼠' : '未佩戴口罩'} />
            <Stat value={mouse ? '3' : '9'} label={mouse ? '活动轨迹' : '未佩戴帽子'} />
            <Stat value="0" label={mouse ? '抽烟检测' : '人员检测异常'} />
            <Stat value={mouse ? '1' : '2'} label="待处置报警" />
            <Stat value={mouse ? '99%' : '98%'} label="设备在线率" />
        </div>
        <div className="dt-alarm-features">{types.map((x, i) => <span className={i === (mouse ? 0 : 3) ? 'active' : ''} key={x}>● {x}</span>)}</div>
        <div className="dt-capture-grid">{cards.map((row, index) => <article className="dt-capture-card" key={`${row[0]}-${index}`}>
            <div className="dt-capture-head"><b>{row[2]}</b><span>{index + 19}分钟前</span></div>
            <div className="dt-capture-image"><img src={detectionImage} alt={`${zoneName} ${row[2]}抓拍`} /><span className="dt-camera-label">{cameraName} · CAM-{String(index + 1).padStart(2, '0')}</span><em>{row[2]}</em></div>
            <div className="dt-capture-meta"><span>{row[1]}</span><span>{row[3]}</span></div>
        </article>)}</div>
        <div className="dt-capture-footer"><span>固定演示数据 · 最近更新 11:26:42</span></div>
    </div>;
}

function FrontCockpit({ page, setPage }: { page: 'safety' | 'kitchen' | 'complaint'; setPage: (page: 'safety' | 'kitchen' | 'complaint') => void }) {
    return <SafetyCockpit />;
    return <><div className="dt-subtabs">{[['safety', '食安数据驾驶舱'], ['kitchen', '明厨亮灶公示'], ['complaint', '客诉反馈系统']].map(([id, name]) => <button className={page === id ? 'active' : ''} onClick={() => setPage(id as typeof page)} key={id}>{name}</button>)}</div>{page === 'safety' && <div className="dt-safe-grid"><section><h3>食品安全运行概况</h3><div className="dt-mini-stats"><Stat value="92" label="安全评分" /><Stat value="68" label="今日台账" /><Stat value="2" label="待处置预警" /><Stat value="98%" label="台账完整率" /></div><p>晨检完成 42 人　食材验收 38 批　农残检测 12 批</p><p>留样完成率 96%　AI 巡检 36 次　异常行为 0 次</p></section><section><h3>监管风险动态</h3><p>油烟监测 F01 离线　<span className="dt-tag warn">待处理</span></p><p>仓储区温度 27.8℃　<span className="dt-tag">持续关注</span></p><p>今日安全记录完整率 98%　<span className="dt-tag ok">正常</span></p></section></div>}{page === 'kitchen' && <div className="dt-video-page"><h3>明厨亮灶公示 <span className="dt-live">● 8 路在线</span></h3><img src={videoWallImage} alt="明厨亮灶实时监控画面" /><p>画面更新时间：11:26:42　｜　AI 异常行为：0 次　｜　视频在线率：100%</p></div>}{page === 'complaint' && <div className="dt-safe-grid"><section><h3>客诉反馈概况</h3><div className="dt-mini-stats"><Stat value="92%" label="今日满意度" /><Stat value="3" label="今日投诉" /><Stat value="2" label="已处理" /><Stat value="1" label="处理中" /></div></section><section><h3>投诉问题列表</h3><p>餐品口味 <span className="dt-tag ok">已处理</span>　10:42</p><p>排队时间 <span className="dt-tag warn">处理中</span>　11:08</p><p>环境卫生 <span className="dt-tag ok">已处理</span>　11:16</p></section></div>}</>;
}

function ProductionCockpit() {
    const progressRows = [
        ['01', '清炒莲藕片', '鲜达供应链', '预处理完成'],
        ['02', '番茄炒蛋', '华安食材', '已出餐'],
        ['03', '土豆烧牛肉', '放心肉业', '烹饪中'],
        ['04', '青椒肉丝', '放心肉业', '预处理完成'],
        ['05', '清蒸鸡腿', '华安禽业', '预处理完成'],
        ['06', '紫菜蛋汤', '禾丰粮油', '待生产'],
        ['07', '米饭', '禾丰粮油', '待生产'],
        ['08', '时蔬拼盘', '鲜达供应链', '待生产'],
    ] as const;
    const summary = {
        total: progressRows.length,
        served: progressRows.filter((row) => row[3] === '已出餐').length,
        cooking: progressRows.filter((row) => row[3] === '烹饪中').length,
        ready: progressRows.filter((row) => row[3] === '预处理完成').length,
        pending: progressRows.filter((row) => row[3] === '待生产').length,
    };
    return <div className="dt-production-page">
        <div className="dt-production-brand"><div className="dt-production-logo">食</div><div><h2>无人智厨生产驾驶舱</h2><p>生产进度 · 设备协同 · 出餐管理</p></div><span>● 演示数据　11:26:42</span></div>
        <div className="dt-production-kpis" aria-label="生产概况">
            <div><b>{summary.total}</b><span>今日生产任务</span></div>
            <div><b className="ok">{summary.served}</b><span>已出餐</span></div>
            <div><b className="info-text">{summary.cooking}</b><span>烹饪中</span></div>
            <div><b className="ready-text">{summary.ready}</b><span>预处理完成</span></div>
            <div><b className="warn-text">{summary.pending}</b><span>待生产</span></div>
        </div>
        <div className="dt-production-visual-row">
            <section className="dt-production-visual-card"><div className="dt-production-visual-head"><h3>任务完成趋势</h3><span>固定演示数据</span></div><svg viewBox="0 0 520 130" role="img" aria-label="任务完成趋势图"><line x1="14" x2="506" y1="108" y2="108" className="dt-chart-grid" /><line x1="14" x2="506" y1="70" y2="70" className="dt-chart-grid" /><line x1="14" x2="506" y1="32" y2="32" className="dt-chart-grid" /><polyline points="14,98 95,90 177,96 259,72 341,61 423,48 506,28" className="dt-chart-line" /><circle cx="14" cy="98" r="4" className="dt-chart-point" /><circle cx="95" cy="90" r="4" className="dt-chart-point" /><circle cx="177" cy="96" r="4" className="dt-chart-point" /><circle cx="259" cy="72" r="4" className="dt-chart-point" /><circle cx="341" cy="61" r="4" className="dt-chart-point" /><circle cx="423" cy="48" r="4" className="dt-chart-point" /><circle cx="506" cy="28" r="4" className="dt-chart-point" /></svg><div className="dt-production-chart-labels"><span>06:00</span><span>08:00</span><span>10:00</span><span>12:00</span></div></section>
            <section className="dt-production-visual-card"><div className="dt-production-visual-head"><h3>无人厨房设备画面</h3><span>现场示意图</span></div><div className="dt-production-map"><img src={modelImage} alt="无人厨房设备协同示意图" /><span className="dt-production-map-tag left">机械臂 · 分装</span><span className="dt-production-map-tag right">层架 · 暂存</span></div><div className="dt-production-map-note">炒菜机、烤箱与机械臂协同展示；具体接入状态待客户系统确认。</div></section>
        </div>
        <div className="dt-production-grid">
            <section className="dt-production-panel dt-progress-panel"><div className="dt-production-panel-head"><h3>生产进度</h3><span>固定演示数据 · 任务口径可按客户系统接入</span></div><div className="dt-progress-summary"><b>当前班次 {summary.total} 项任务</b><span className="ok">● 已出餐 {summary.served}</span><span className="info-text">● 烹饪中 {summary.cooking}</span><span className="warn-text">● 待生产 {summary.pending}</span></div><table><thead><tr><th>序号</th><th>菜品名称</th><th>来源</th><th>生产状态</th></tr></thead><tbody>{progressRows.map(row => <tr key={row[0]}>{row.map((cell, i) => <td className={i === 3 ? ({ '已出餐': 'ok', '烹饪中': 'info-text', '预处理完成': 'ready-text', '待生产': 'warn-text' } as Record<string, string>)[cell] : ''} key={cell}>{cell}</td>)}</tr>)}</tbody></table></section>
            <section className="dt-production-panel dt-status-panel"><div className="dt-production-panel-head"><h3>生产状态</h3><span>设备状态按接入能力展示</span></div><div className="dt-production-legend"><span><i className="legend-dot ok-dot" />已完成</span><span><i className="legend-dot info-dot" />进行中</span><span><i className="legend-dot warn-dot" />待处理</span></div><div className="dt-production-section"><h4>投料区</h4><div className="dt-station-row"><b>入口 1</b><span className="warn">待摆盘</span><span className="info">切块土豆</span><b>入口 2</b><span className="warn">空闲中</span></div></div><div className="dt-production-section"><h4>烹饪区</h4><div className="dt-cooking"><div className="dt-cooking-image"><img src={cookingImage} alt="烹饪区烤箱与炒菜机现场画面" /><span>烤箱　烹饪中：娃娃菜</span><span>炒菜机　烹饪中：干锅花菜</span></div></div></div><div className="dt-production-section"><h4>出餐区</h4><div className="dt-serving"><div><b>出口 1</b><p>清炒莲藕片　3盆/75份</p><p>番茄炒蛋　3盆/75份</p><p>紫菜蛋汤　2盆/50份</p></div><div><b>出口 2</b><p>清炒莲藕片　3盆/75份</p><p>土豆烧牛肉　3盆/75份</p><p>青椒肉丝　2盆/50份</p></div></div></div></section>
        </div>
    </div>;
}

function BehaviorCockpit() {
    const cards = [
        ['未佩戴口罩', '食材加工区 · CAM-01', '14:02:56', processingDetectionImage],
        ['未佩戴帽子', '食材加工区 · CAM-02', '13:54:20', processingDetectionImage],
        ['抽烟检测', '售卖区 · CAM-01', '13:47:49', sellingDetectionImage],
        ['人员检测', '售卖区 · CAM-02', '13:43:28', sellingDetectionImage],
        ['未佩戴帽子', '食材加工区 · CAM-03', '13:38:55', processingDetectionImage],
        ['未佩戴口罩', '售卖区 · CAM-03', '13:36:23', sellingDetectionImage],
        ['人员检测', '食材加工区 · CAM-04', '13:31:42', processingDetectionImage],
        ['抽烟检测', '售卖区 · CAM-04', '13:26:18', sellingDetectionImage],
    ];
    return <div className="dt-behavior-page">
        <div className="dt-behavior-brand"><div className="dt-behavior-logo">食</div><div><h2>江南校区 · 第一食堂</h2><p>AI 行为识别 · 异常事件实时抓拍</p></div><b>行为监控</b></div>
        <div className="dt-behavior-toolbar"><div className="dt-behavior-stats"><Stat value="158" label="全部异常" /><Stat value="19" label="未佩戴口罩" /><Stat value="102" label="未佩戴帽子" /><Stat value="0" label="发现老鼠" /><Stat value="2" label="发现抽烟" /><Stat value="37" label="发现人员" /></div><div className="dt-period"><button className="active">最近一天</button><button>最近一周</button><button>最近一月</button></div></div>
        <div className="dt-behavior-grid">{cards.map(([title, location, time, image]) => <article className="dt-behavior-card" key={`${title}-${location}`}><div className="dt-behavior-card-head"><b>{title}</b><span>2分钟前<br />2026-09-15 {time}</span></div><div className="dt-behavior-image"><img src={image} alt={`${location}${title}抓拍`} /><small>{location}</small><i>{title}</i></div></article>)}</div>
    </div>;
}

function NutritionCockpit() {
    const [activeMeal, setActiveMeal] = useState('午餐');
    const menusByMeal = { 早餐: [['鲜肉包', '早餐'], ['红豆包', '早餐'], ['油条', '早餐']], 午餐: [['水饺', '午餐'], ['红烧鸡块', '午餐'], ['清炒时蔬', '午餐']], 下午茶: [['鲜肉包', '下午茶'], ['红豆包', '下午茶'], ['油条', '下午茶']] };
    const menus = menusByMeal[activeMeal as keyof typeof menusByMeal];
    const dishStats = ({ 早餐: ['3', '3', '6', '0', '0', '0'], 午餐: ['6', '3', '6', '6', '0', '0'], 下午茶: ['3', '3', '6', '0', '0', '3'] } as Record<string, string[]>)[activeMeal] ?? ['0', '0', '0', '0', '0', '0'];
    return <div className="dt-nutrition-page">
        <div className="dt-nutrition-title"><span>综合公示大屏</span><small>江南校区 · 第一食堂　|　营养健康数据中心</small></div>
        <div className="dt-nutrition-grid">
            <section className="dt-nutrition-panel menu-panel"><h3>今日菜谱 · {activeMeal}</h3><div className="dt-meal-tabs">{['早餐', '午餐', '下午茶'].map(meal => <button className={activeMeal === meal ? 'active' : ''} onClick={() => setActiveMeal(meal)} key={meal}>{meal}</button>)}</div><div className="dt-menu-grid">{menus.map(([name, meal], i) => <div className="dt-menu-item" key={name}><div className={`dt-food food-${activeMeal === '午餐' ? i + 3 : i}`}></div><span>{name}</span><small>{meal}</small></div>)}</div></section>
            <section className="dt-nutrition-panel chart-panel"><h3>近七日就餐人数变化</h3><div className="dt-line-chart"><i></i><i></i><span>07-01　07-02　07-03　07-04　07-05　07-06　07-07</span></div></section>
            <section className="dt-nutrition-panel metrics-panel"><h3>今日菜品数量 · {activeMeal}</h3><div className="dt-metric-grid">{['菜谱菜品总数', '早餐菜品数量', '午餐菜品数量', '晚餐菜品数量', '夜宵菜品数量', '下午茶菜品数量'].map((label, i) => <div className={i === 0 ? 'active' : ''} key={label}><b>{dishStats[i]}</b><span>{label}</span></div>)}</div></section>
            <section className="dt-nutrition-panel nutrient-panel"><h3>菜品营养成分</h3><table><thead><tr><th>菜品</th><th>能量</th><th>蛋白质</th><th>脂肪</th><th>碳水</th></tr></thead><tbody>{[['番茄炒蛋', '118 kcal', '8.6g', '6.2g', '7.4g'], ['清炒时蔬', '76 kcal', '3.1g', '2.8g', '9.6g'], ['土豆烧牛肉', '236 kcal', '18.4g', '11.2g', '15.8g'], ['紫菜蛋汤', '58 kcal', '4.2g', '2.6g', '3.8g']].map(row => <tr key={row[0]}>{row.map(cell => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></section>
            <section className="dt-nutrition-panel brand-panel"><h3>原料品牌公示</h3>{[['大米', '稻香', '中粮供应'], ['菜籽油', '金龙鱼', '金龙鱼供应'], ['小白菜', '菜王', '合作社供应'], ['猪肉', '放心肉业', '定点供应']].map(row => <div className="dt-brand-row" key={row[0]}><span>🌿</span>{row.map(cell => <b key={cell}>{cell}</b>)}</div>)}</section>
            <section className="dt-nutrition-panel balance-panel"><h3>营养分析</h3><div className="dt-donut"><b>今日<br />营养均衡</b></div><div className="dt-legend"><span>● 蛋白质　达标 86%</span><span>● 脂肪　达标 78%</span><span>● 碳水　达标 92%</span><span>● 蔬菜摄入　达标 81%</span><span>● 水果摄入　达标 64%</span></div></section>
            <section className="dt-nutrition-panel hot-panel"><h3>热门菜品</h3><div className="dt-hot-dish"><b>毛氏红烧肉</b><span>今日选择 362 次</span></div><div className="dt-hot-tags"><i>番茄炒蛋</i><i>清炒时蔬</i><i>土豆烧牛肉</i><i>红烧鸡块</i><i>紫菜蛋汤</i><i>鱼香肉丝</i><i>手撕包菜</i><i>香菇鸡块</i></div></section>
            <section className="dt-nutrition-panel rank-panel"><h3>今日菜品销售排行</h3>{[['🥇', '农家烧肉', '362'], ['🥈', '麻婆豆腐', '228'], ['🥉', '番茄炒蛋', '120'], ['4', '手撕包菜', '110']].map(row => <div className="dt-rank-row" key={row[1]}><b>{row[0]}</b><span>{row[1]}</span><i style={{ width: `${Number(row[2]) / 4}%` }}></i><em>{row[2]}</em></div>)}</section>
        </div>
    </div>;
}

function SafetyCockpit() {
    return <div className="dt-safety-dashboard">
        <div className="dt-safety-dashboard-head"><div><h2>AI 食品安全监管驾驶舱</h2><p>留样 · 检测 · 晨检 · 环境监控 · 全流程追溯</p></div><span>● 数据实时更新　11:26:42</span></div>
        <div className="dt-safety-kpis">{[['24', '今日留样', '完成率 96%'], ['12', '原料检测', '全部合格'], ['42', '员工消毒晨检', '通过率 100%'], ['8', '环境监控点位', '7 正常 · 1 关注'], ['36', 'AI 巡检次数', '异常 2 次'], ['100%', '健康证有效率', '42 人在岗']].map(row => <div key={row[1]}><b>{row[0]}</b><span>{row[1]}</span><em>{row[2]}</em></div>)}</div>
        <div className="dt-safety-dashboard-grid">
            <section className="dt-safe-widget dt-safe-monitor"><h3>明厨亮灶 · 现场监控</h3><img src={videoWallImage} alt="食堂现场监控画面" /><div><span>8 路在线</span><span>AI 异常行为 0 次</span><span>环境状态正常</span></div></section>
            <section className="dt-safe-widget dt-safe-trace"><h3>食品安全全流程追溯</h3><table><thead><tr><th>环节</th><th>今日记录</th><th>状态</th></tr></thead><tbody>{[['01 食材验收', '38 批', '已完成'], ['02 原料检测', '12 批', '全部合格'], ['03 仓储入库', '37 批', '已完成'], ['04 加工烹饪', '12 道', '进行中'], ['05 菜品留样', '24 份', '已完成']].map(row => <tr key={row[0]}>{row.map((cell, i) => <td className={i === 2 ? 'ok' : ''} key={cell}>{cell}</td>)}</tr>)}</tbody></table></section>
            <section className="dt-safe-widget dt-safe-health"><h3>员工消毒晨检 & 健康证</h3><table><thead><tr><th>员工</th><th>晨检时间</th><th>消毒</th><th>健康证</th></tr></thead><tbody>{[['张师傅', '06:42', '合格', '有效'], ['李阿姨', '06:45', '合格', '有效'], ['王师傅', '06:48', '合格', '有效'], ['赵阿姨', '06:52', '合格', '有效']].map(row => <tr key={row[0]}>{row.map(cell => <td className={cell === '合格' || cell === '有效' ? 'ok' : ''} key={cell}>{cell}</td>)}</tr>)}</tbody></table></section>
            <section className="dt-safe-widget dt-safe-ledger"><h3>菜品留样统计</h3><table><thead><tr><th>菜品名称</th><th>重量</th><th>留样时间</th><th>销样</th></tr></thead><tbody>{[['红烧排骨', '126g', '10:12', '已销样'], ['清炒时蔬', '120g', '10:15', '已销样'], ['番茄炒蛋', '124g', '10:18', '待销样'], ['香菇鸡块', '128g', '10:22', '待销样']].map(row => <tr key={row[0]}>{row.map((cell, i) => <td className={i === 3 && cell === '待销样' ? 'warn' : i === 3 ? 'ok' : ''} key={cell}>{cell}</td>)}</tr>)}</tbody></table></section>
            <section className="dt-safe-widget dt-safe-testing"><h3>原料检测记录</h3><table><thead><tr><th>食材</th><th>检测项目</th><th>结果</th><th>时间</th></tr></thead><tbody>{[['青菜', '农药残留', '合格', '08:16'], ['鸡蛋', '兽药残留', '合格', '08:32'], ['猪肉', '瘦肉精', '合格', '08:47'], ['大米', '重金属', '合格', '09:05']].map(row => <tr key={row[0]}>{row.map(cell => <td className={cell === '合格' ? 'ok' : ''} key={cell}>{cell}</td>)}</tr>)}</tbody></table></section>
            <section className="dt-safe-widget dt-safe-environment"><h3>环境监控 & AI 巡检</h3><table><thead><tr><th>监控项</th><th>当前值</th><th>状态</th></tr></thead><tbody>{[['仓储温度', '27.8℃', '关注'], ['留样柜温度', '4.2℃', '正常'], ['后厨湿度', '61%', '正常'], ['油烟监测', '离线', '异常']].map(row => <tr key={row[0]}>{row.map((cell, i) => <td className={i === 2 ? row[2] === '异常' ? 'bad' : row[2] === '关注' ? 'warn' : 'ok' : ''} key={cell}>{cell}</td>)}</tr>)}</tbody></table></section>
        </div>
    </div>;
}

function buildAlarmHtml(zone: Zone) {
    const mouse = zone.id === 'storage';
    const rows = mouse ? [['AL24091501', '仓储东侧货架', '疑似老鼠活动', '11:02:18', '高', '待处置'], ['AL24091502', '仓储西侧通道', '人员检测', '09:46:32', '中', '已复核'], ['AL24091408', '主食库入口', '人员检测', '昨日 22:18', '中', '已关闭']] : [['AI24091521', '加工台 02', '未佩戴口罩', '11:18:06', '中', '待提醒'], ['AI24091520', '加工台 01', '未佩戴帽子', '10:56:42', '中', '已整改'], ['AI24091519', '通道摄像头', '人员检测', '10:22:14', '低', '正常'], ['AI24091518', '区域西侧', '抽烟检测', '09:38:26', '高', '已处置']];
    const types = mouse ? ['老鼠检测', '人员检测'] : ['未佩戴口罩', '未佩戴帽子', '人员检测', '抽烟检测'];
    return <div className="dt-alarm-page"><div className="dt-alarm-title"><div><h2>{zone.name} · {mouse ? '老鼠检测' : 'AI 行为检测'}</h2><p>{mouse ? '仓储区域生物识别与异常活动报警' : '人员行为实时识别与风险报警'}</p></div><span className="dt-live">● 实时监测</span></div><div className="dt-alarm-stats"><Stat value={mouse ? '16' : '186'} label="今日检测次数" /><Stat value={mouse ? '1' : '4'} label="今日报警" /><Stat value={mouse ? '1' : '2'} label="待处置" /><Stat value={mouse ? '99%' : '98%'} label="设备在线率" /></div><div className="dt-alarm-features">{types.map((x, i) => <span className={i === (mouse ? 0 : 3) ? 'active' : ''} key={x}>● {x}</span>)}</div><div className="dt-ledger-card"><div className="dt-ledger-head"><h3>{mouse ? '老鼠检测报警记录' : '人员行为检测报警记录'}</h3><span>更新时间：11:26:42 · 固定演示数据</span></div><table><thead><tr>{['报警编号', '检测位置', '检测类型', '发生时间', '等级', '处置状态'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row[0]}>{row.map((cell, i) => <td className={i === 4 && cell === '高' ? 'bad' : i === 5 && cell.includes('待') ? 'warn' : i === 5 && cell.includes('正常') ? 'ok' : ''} key={cell}>{cell}</td>)}</tr>)}</tbody></table><div className="dt-ledger-foot">报警信息已自动归档 · 当前{mouse ? '老鼠活动' : '行为'}风险需持续关注</div></div></div>;
}

/**
 * 原有“食堂驾驶舱”内容，保留生产与行为监控主链路，通过 #page=cockpit 进入。
 * 生产页保留原有结构并优化演示口径；营养与食品安全不纳入本次客户驾驶舱范围。
 */
function LegacyCanteenCockpit() {
    const [group, setGroup] = useState('production');
    const [selected, setSelected] = useState<string | null>(null);
    const [frontPage, setFrontPage] = useState<'safety' | 'kitchen' | 'complaint'>('safety');
    const visibleZones = useMemo(() => {
        const groups: Record<string, string[]> = { production: ['production'], nutrition: ['safety'], behavior: ['production', 'storage'], safety: ['safety', 'storage'] };
        return group === 'all' ? zones : zones.filter(z => groups[group]?.includes(z.group));
    }, [group]);
    const openZone = (id: string) => { setSelected(id); if (id === 'front') setFrontPage('safety'); };
    const selectedZone = zones.find(z => z.id === selected);
    useEffect(() => {
        if (!selectedZone || !['storage', 'production', 'selling'].includes(selectedZone.id)) return;
        const target = document.querySelector('.dt-generic');
        if (target) createRoot(target).render(<AlarmPage type={selectedZone.id === 'storage' ? 'mouse' : 'behavior'} zoneName={selectedZone.name} />);
    }, [selectedZone]);
    useEffect(() => {
        if (!selectedZone || !['acceptance', 'cooking'].includes(selectedZone.id)) return;
        const target = document.querySelector('.dt-generic');
        if (target) createRoot(target).render(selectedZone.id === 'acceptance' ? <Ledger type="acceptance" /> : <ProductionCockpit />);
    }, [selectedZone]);
    useEffect(() => {
        const devices = document.querySelectorAll('.dt-right .dt-device');
        if (devices.length >= 4) {
            const cooking = devices[2];
            const oven = devices[3];
            cooking.querySelector('span')!.textContent = '炒菜机 C01';
            cooking.querySelector('b')!.textContent = '离线';
            cooking.querySelector('b')!.className = 'bad';
            oven.querySelector('span')!.textContent = '烤箱 B01';
            oven.querySelector('b')!.textContent = '运行中 · 180℃';
            oven.querySelector('b')!.className = 'ok';
        }
        const alerts = document.querySelectorAll('.dt-right .dt-alert');
        if (alerts[0]) {
            alerts[0].querySelector('b')!.textContent = '烹饪区炒菜机 C01 离线';
            alerts[0].querySelector('small')!.textContent = '烹饪区 · 8 分钟前';
        }
        if (alerts[1]) {
            alerts[1].querySelector('b')!.textContent = '食材仓储区老鼠检测告警';
            alerts[1].querySelector('small')!.textContent = '仓储区东侧货架 · 3 分钟前';
        }
        document.querySelectorAll('.dt-right .dt-stat span').forEach(node => {
            if (node.textContent === '关注事项') node.textContent = '待处理事项';
        });
        document.querySelectorAll('.dt-safety-kpis em').forEach(node => {
            if (node.textContent?.includes('关注')) node.textContent = node.textContent.replace('7 正常 · 1 关注', '全部正常');
        });
        document.querySelectorAll('.dt-safe-environment tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells[0]?.textContent === '仓储温度') {
                cells[1].textContent = '25.6℃';
                cells[2].textContent = '正常';
                cells[2].className = 'ok';
            }
        });
    }, [group, selectedZone]);
    useEffect(() => {
        const nav = document.querySelector('.dt-tabs');
        if (!nav || nav.querySelector('[data-global-tab]')) return;
        const button = document.createElement('button');
        button.dataset.globalTab = 'true';
        button.textContent = '全局视图';
        button.className = group === 'all' ? 'active' : '';
        button.onclick = () => { setGroup('all'); setSelected(null); };
        nav.prepend(button);
        return () => button.remove();
    }, []);
    useEffect(() => {
        const button = document.querySelector<HTMLButtonElement>('[data-global-tab]');
        if (button) button.className = group === 'all' ? 'active' : '';
        const label = document.querySelector('.dt-stage-label p');
        if (label && !selectedZone) label.textContent = `当前查看：${group === 'all' ? '全局视图' : group === 'production' ? '生产烹饪' : group === 'nutrition' ? '营养健康' : group === 'behavior' ? '行为监控' : '食品安全'} · 8 个区域演示状态`;
    }, [group, selectedZone]);
    useEffect(() => {
        const label = document.querySelector('.dt-stage-label p');
        if (label && !selectedZone) label.textContent = label.textContent?.replace('8 个区域', `${zones.length} 个区域`) || '';
    }, [group, selectedZone]);
    useEffect(() => {
        const app = document.querySelector('.dt-app');
        if (!app) return;
        const host = document.createElement('div');
        host.className = 'dt-production-host';
        if (['production', 'behavior', 'nutrition', 'safety'].includes(group) && !selected) {
            app.classList.add('production-mode');
            app.append(host);
            const root = createRoot(host);
            root.render(group === 'production' ? <ProductionCockpit /> : group === 'behavior' ? <BehaviorCockpit /> : group === 'nutrition' ? <NutritionCockpit /> : <SafetyCockpit />);
            return () => { root.unmount(); app.classList.remove('production-mode'); host.remove(); };
        }
    }, [group, selected]);
    return <main className="dt-app"><header className="dt-top"><div className="dt-brand"><div className="dt-logo">食</div><div><h1>无人智厨驾驶舱</h1><p>生产现场 · 设备协同 · 行为监控一体化展示</p></div></div><div className="dt-meta"><span>客户演示环境</span><span>午餐班次</span><span className="dt-online">● 演示数据</span><span>11:26:42</span></div></header><nav className="dt-tabs">{[['production', '生产烹饪'], ['behavior', '行为监控']].map(([id, name]) => <button className={group === id ? 'active' : ''} onClick={() => { setGroup(id); setSelected(null); }} key={id}>{name}</button>)}</nav><div className="dt-layout"><aside className="dt-panel"><h2>空间区域</h2><div className="dt-area-list"><button className={!selected ? 'selected' : ''} onClick={() => setSelected(null)}><b>全局视图</b><span>8 个区域 · 15 台设备</span></button>{visibleZones.map(z => <button className={selected === z.id ? 'selected' : ''} onClick={() => openZone(z.id)} key={z.id}><b>{z.name}</b><span>{z.summary}</span></button>)}</div></aside><section className="dt-stage"><div className="dt-stage-label"><h2>食堂现场 3D 模型</h2><p>{selectedZone ? `当前查看：${selectedZone.name} · 区域点位详情` : `当前查看：${group === 'production' ? '生产烹饪' : '行为监控'} · 8 个区域演示状态`}</p></div><img src={modelImage} alt="食堂现场3D模型" /><div className="dt-zone-legend"><b>区域点位</b>{zones.map((z, index) => <button key={z.id} onClick={() => openZone(z.id)} className={z.id === selected ? 'active' : ''}><i>{String(index + 1).padStart(2, '0')}</i>{z.name}</button>)}</div>{zones.map((z, index) => <button key={z.id} aria-label={`${String(index + 1).padStart(2, '0')}号点位：${z.name}`} className={`dt-marker ${markerPositions[z.id]} ${z.id === selected ? 'selected' : ''}`} onClick={() => openZone(z.id)}><span>{index + 1}</span><em>{z.name.replace('区', '')}</em></button>)}<div className="dt-stage-focus"><b>{selectedZone?.name || '全局视图'}</b><span>{selectedZone?.data || '点击模型点位或右上角区域编号，查看对应功能和现场数据'}</span></div></section><aside className="dt-right"><section className="dt-panel"><h2>现场概况</h2><div className="dt-stat-grid"><Stat value="15" label="接入设备" /><Stat value="14" label="正常运行" /><Stat value="2" label="关注事项" /><Stat value="1" label="异常告警" /></div></section><section className="dt-panel"><h2>设备状态</h2><div className="dt-device"><span>智能晨检仪 A01</span><b className="ok">正常 · 42人</b></div><div className="dt-device"><span>智能留样柜 D01</span><b className="ok">正常 · 4℃</b></div><div className="dt-device"><span>仓库温湿度 C01</span><b className="warn">关注 · 27.8℃</b></div><div className="dt-device"><span>油烟监测 F01</span><b className="bad">离线</b></div></section><section className="dt-panel"><h2>实时告警</h2><div className="dt-alert bad-border"><b>油烟监测 F01 离线</b><small>设备运维 · 2 小时前</small></div><div className="dt-alert"><b>仓储区温度偏高</b><small>食材仓储区 · 26 分钟前</small></div></section></aside></div>{selected && <div className="dt-modal-backdrop" onClick={() => setSelected(null)}><section className="dt-modal" onClick={e => e.stopPropagation()}><button className="dt-close" onClick={() => setSelected(null)}>×</button>{selected === 'front' ? <FrontCockpit page={frontPage} setPage={setFrontPage} /> : selected === 'morning' ? <Ledger type="morning" /> : selected === 'testing' ? <Ledger type="testing" /> : selected === 'retention' ? <Ledger type="retention" /> : selected === 'office' ? <Ledger type="office" /> : <div className="dt-generic"><h2>{selectedZone?.name}区域驾驶舱</h2><p>{selectedZone?.features}</p><strong>{selectedZone?.data}</strong></div>}</section></div>}</main>;
}

/**
 * 客户驾驶舱需求：原型页面入口。
 *
 * 页面（#page=<id>）：
 * - operations 运营驾驶舱（生产、设备、用料与能耗；默认首页）
 * - behavior  行为监控
 * - control   iPad 展示控制页
 * - cockpit   原有生产驾驶舱（保留优化）
 *
 * 暂时下线（2026-09-23 按需求暂停展示）：overview 厨房总览、process 无人烹饪流程、equipment 核心设备与能力。
 * 页面文件仍保留在 pages/ 下，恢复时取消下方注释及对应 import 即可。
 */
const CUSTOMER_COCKPIT_ROUTE = defineHashPageRoute(
    [
        { id: 'operations', title: '运营驾驶舱' },
        // { id: 'overview', title: '厨房总览' },
        // { id: 'process', title: '无人烹饪流程' },
        // { id: 'equipment', title: '核心设备与能力' },
        { id: 'behavior', title: '行为监控' },
        { id: 'control', title: 'iPad 展示控制页' },
        { id: 'cockpit', title: '生产驾驶舱（保留优化）' },
    ],
    { defaultPageId: 'operations' },
);

export default function CustomerCockpitRequirements() {
    const { page, setPage } = useHashPage(CUSTOMER_COCKPIT_ROUTE);
    const { pageId, period, monitorState } = useDisplayState();
    /** 上一次已同步的展示页；null 表示尚未同步过。 */
    const lastSyncedPageId = useRef<string | null>(null);
    /** 进入时 URL 是否显式指定了页面；显式指定时以 URL 为准，不被控制端状态改写。 */
    const urlPageSpecified = useRef(parseHashPage(window.location.hash) !== null);

    // 大屏跟随 iPad 控制端切换：
    // - 控制页与保留旧页自身不参与跟随，否则控制端点按钮后会被这条同步逻辑导航走。
    // - 首次进入且 URL 未显式指定页面时，采纳控制端当前页，避免两端长期不一致。
    useEffect(() => {
        if (page === 'control' || page === 'cockpit') {
            lastSyncedPageId.current = pageId;
            return;
        }
        if (lastSyncedPageId.current === pageId) return;
        const isFirstSync = lastSyncedPageId.current === null;
        lastSyncedPageId.current = pageId;
        if (isFirstSync && urlPageSpecified.current) return;
        if (isDisplayPageId(pageId)) setPage(pageId);
    }, [page, pageId, setPage]);

    // 大屏侧切换时回写当前页，保证 iPad 控制端高亮与实际展示结果一致。
    const navigate = useCallback((id: string) => {
        setPage(id);
        if (isDisplayPageId(id)) writeDisplayPageId(id);
    }, [setPage]);

    const switcher = <PageSwitcher current={page} onSelect={navigate} />;

    if (page === 'cockpit') {
        return <><LegacyCanteenCockpit />{switcher}</>;
    }
    if (page === 'control') {
        return <><DisplayControl onNavigate={navigate} />{switcher}</>;
    }
    if (page === 'behavior') {
        return <><BehaviorMonitor period={period} monitorState={monitorState} onNavigate={navigate} />{switcher}</>;
    }
    // 暂时下线的页面（厨房总览 / 无人烹饪流程 / 核心设备与能力）不再有独立分支：
    // 旧链接（如 #page=overview）与未知页面统一回落到默认首页「运营驾驶舱」。
    // if (page === 'process') { return <><CookingProcess onNavigate={navigate} />{switcher}</>; }
    // if (page === 'equipment') { return <><EquipmentCapability onNavigate={navigate} />{switcher}</>; }
    return <><OperationsDashboard onNavigate={navigate} />{switcher}</>;
}
