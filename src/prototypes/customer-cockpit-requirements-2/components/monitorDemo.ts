/**
 * 行为监控演示数据。
 *
 * 约束（来自 PRD）：
 * - 演示数据必须显式标注，不伪装为真实动态数据。
 * - 全部异常包含“发现人员”，且统计口径与列表周期一致。
 * - 相对时间由时间戳计算，不静态写死“2 分钟前”。
 * - 缺失不等于零：缺图保留事件其他信息。
 *
 * 参考页示例数（19 / 102 / 0 / 2 / 37，合计 160 与总量 158 不一致）
 * 在去重口径确认前不作为业务样本，此处使用自洽的演示数值。
 */
import mouseDetectionImage from '../assets/食材仓储老鼠检测.png';
import processingDetectionImage from '../assets/食材加工行为检测.png';
import sellingDetectionImage from '../assets/售卖间行为检测.png';

export const MONITOR_CATEGORIES = ['未佩戴口罩', '未佩戴帽子', '发现老鼠', '发现抽烟', '发现人员'] as const;
export type MonitorCategory = (typeof MONITOR_CATEGORIES)[number];

/** 演示用“当前时间”，用于计算相对时间，保证相对与绝对时间一致。 */
export const DEMO_NOW = '2026-09-23T11:26:42';

export interface MonitorEvent {
    id: string;
    type: MonitorCategory;
    area: string;
    camera: string;
    /** ISO 时间，页面同时展示相对时间与绝对时间 */
    time: string;
    /** 缺图时留空，页面展示“图片暂不可用”并保留其他信息 */
    image?: string;
}

export interface MonitorPeriodData {
    periodId: string;
    periodTitle: string;
    /** 统计口径说明 */
    scopeNote: string;
    /** 数据更新时间 */
    updatedAt: string;
    /** 统计周期内的事件总数（演示口径） */
    total: number;
    /** 分类计数，与 total 自洽 */
    counts: Record<MonitorCategory, number>;
    events: MonitorEvent[];
}

const COUNTS: Record<string, Record<MonitorCategory, number>> = {
    day: { 未佩戴口罩: 12, 未佩戴帽子: 9, 发现老鼠: 1, 发现抽烟: 2, 发现人员: 5 },
    week: { 未佩戴口罩: 68, 未佩戴帽子: 51, 发现老鼠: 3, 发现抽烟: 7, 发现人员: 22 },
    month: { 未佩戴口罩: 264, 未佩戴帽子: 198, 发现老鼠: 9, 发现抽烟: 21, 发现人员: 86 },
};

const EVENTS: Record<string, MonitorEvent[]> = {
    day: [
        { id: 'EV230923001', type: '未佩戴口罩', area: '食材加工区 · 加工台 02', camera: 'CAM-01', time: '2026-09-23T11:20:06', image: processingDetectionImage },
        { id: 'EV230923002', type: '未佩戴帽子', area: '食材加工区 · 加工台 01', camera: 'CAM-02', time: '2026-09-23T10:56:42', image: processingDetectionImage },
        { id: 'EV230923003', type: '发现抽烟', area: '售卖区 · 售卖窗口 02', camera: 'CAM-05', time: '2026-09-23T10:22:14', image: sellingDetectionImage },
        { id: 'EV230923004', type: '未佩戴口罩', area: '售卖区 · 售卖窗口 01', camera: 'CAM-06', time: '2026-09-23T09:38:26', image: sellingDetectionImage },
        { id: 'EV230923005', type: '发现人员', area: '食材仓储区 · 东侧通道', camera: 'CAM-09', time: '2026-09-23T09:12:03', image: processingDetectionImage },
        { id: 'EV230923006', type: '未佩戴帽子', area: '食材加工区 · 通道摄像头', camera: 'CAM-03', time: '2026-09-23T08:47:19', image: processingDetectionImage },
        { id: 'EV230923007', type: '发现老鼠', area: '食材仓储区 · 东侧货架', camera: 'CAM-08', time: '2026-09-23T08:20:55', image: mouseDetectionImage },
        { id: 'EV230923008', type: '未佩戴口罩', area: '食材加工区 · 加工台 03', camera: 'CAM-04', time: '2026-09-23T07:55:12', image: processingDetectionImage },
    ],
    week: [
        { id: 'EV230922011', type: '未佩戴帽子', area: '食材加工区 · 加工台 01', camera: 'CAM-02', time: '2026-09-22T16:30:11', image: processingDetectionImage },
        { id: 'EV230922004', type: '未佩戴口罩', area: '食材加工区 · 加工台 02', camera: 'CAM-01', time: '2026-09-22T11:05:47', image: processingDetectionImage },
        { id: 'EV230921018', type: '发现抽烟', area: '售卖区 · 售卖窗口 01', camera: 'CAM-06', time: '2026-09-21T18:42:36', image: sellingDetectionImage },
        { id: 'EV230921009', type: '发现人员', area: '食材仓储区 · 西侧通道', camera: 'CAM-09', time: '2026-09-21T09:15:28', image: processingDetectionImage },
        { id: 'EV230920014', type: '发现老鼠', area: '食材仓储区 · 主食库入口', camera: 'CAM-08', time: '2026-09-20T14:08:52', image: mouseDetectionImage },
        { id: 'EV230920006', type: '未佩戴帽子', area: '售卖区 · 售卖窗口 02', camera: 'CAM-05', time: '2026-09-20T08:36:14', image: sellingDetectionImage },
        { id: 'EV230919017', type: '未佩戴口罩', area: '食材加工区 · 加工台 03', camera: 'CAM-04', time: '2026-09-19T17:22:41', image: processingDetectionImage },
        { id: 'EV230919003', type: '未佩戴帽子', area: '食材加工区 · 通道摄像头', camera: 'CAM-03', time: '2026-09-19T07:48:09', image: processingDetectionImage },
    ],
    month: [
        { id: 'EV230922004', type: '未佩戴口罩', area: '食材加工区 · 加工台 01', camera: 'CAM-01', time: '2026-09-22T11:05:47', image: processingDetectionImage },
        { id: 'EV230918012', type: '发现抽烟', area: '售卖区 · 售卖窗口 01', camera: 'CAM-06', time: '2026-09-18T15:12:33', image: sellingDetectionImage },
        { id: 'EV230915021', type: '发现人员', area: '食材仓储区 · 东侧通道', camera: 'CAM-09', time: '2026-09-15T10:26:18', image: processingDetectionImage },
        { id: 'EV230912008', type: '未佩戴帽子', area: '食材加工区 · 加工台 02', camera: 'CAM-02', time: '2026-09-12T09:41:07', image: processingDetectionImage },
        { id: 'EV230909015', type: '发现老鼠', area: '食材仓储区 · 东侧货架', camera: 'CAM-08', time: '2026-09-09T13:55:24', image: mouseDetectionImage },
        { id: 'EV230905022', type: '未佩戴口罩', area: '售卖区 · 售卖窗口 02', camera: 'CAM-05', time: '2026-09-05T16:08:46', image: sellingDetectionImage },
        { id: 'EV230902007', type: '未佩戴帽子', area: '食材加工区 · 加工台 03', camera: 'CAM-04', time: '2026-09-02T08:52:19', image: processingDetectionImage },
        { id: 'EV230828019', type: '未佩戴口罩', area: '食材加工区 · 通道摄像头', camera: 'CAM-03', time: '2026-08-28T11:34:52', image: processingDetectionImage },
    ],
};

const PERIOD_TITLE: Record<string, string> = { day: '今天', week: '最近一周', month: '最近一月' };

const SCOPE_NOTE: Record<string, string> = {
    day: '统计口径：当日 00:00 至当前（演示）',
    week: '统计口径：最近 7 个自然日（演示）',
    month: '统计口径：最近 30 个自然日（演示）',
};

export function getMonitorData(periodId: string): MonitorPeriodData {
    const key = COUNTS[periodId] ? periodId : 'day';
    const counts = COUNTS[key];
    const total = MONITOR_CATEGORIES.reduce((sum, category) => sum + counts[category], 0);
    return {
        periodId: key,
        periodTitle: PERIOD_TITLE[key],
        scopeNote: SCOPE_NOTE[key],
        updatedAt: '2026-09-23 11:26:42',
        total,
        counts,
        events: EVENTS[key],
    };
}

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

/** 绝对时间：MM-DD HH:mm */
export function formatAbsolute(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 相对时间：由时间戳与演示当前时间计算，不写死。 */
export function formatRelative(iso: string, nowIso: string = DEMO_NOW): string {
    const diff = new Date(nowIso).getTime() - new Date(iso).getTime();
    if (Number.isNaN(diff)) return '—';
    const minutes = Math.max(0, Math.floor(diff / 60000));
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    return `${Math.floor(hours / 24)} 天前`;
}
