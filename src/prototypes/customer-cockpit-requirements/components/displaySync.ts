/**
 * 展示状态同步：大屏页面与 iPad 展示控制页共享同一份展示状态。
 *
 * 原型内用 localStorage + 自定义事件模拟“iPad 控制大屏”的跨端联动：
 * 同一浏览器的两个窗口分别打开大屏页与 iPad 控制页，即可看到切页联动效果。
 *
 * 注意：同浏览器模拟不构成跨设备联动验收（见 PRD AC02）。
 */
import { useEffect, useState } from 'react';

export interface DisplayPage {
    id: string;
    title: string;
    short: string;
    desc: string;
}

/**
 * 大屏展示页面，顺序即讲解顺序。
 *
 * 暂时下线（2026-09-23 按需求暂停展示）：厨房总览、无人烹饪流程、核心设备与能力。
 * 页面实现仍保留在 pages/ 下，恢复时取消下面三行注释即可。
 * 首页随之改为「运营驾驶舱」，见 HOME_PAGE_ID。
 */
export const DISPLAY_PAGES: DisplayPage[] = [
    { id: 'operations', title: '运营驾驶舱', short: '运营驾驶舱', desc: '生产、设备、用料与出成总览' },
    // { id: 'overview', title: '厨房总览', short: '厨房总览', desc: '设备协同示意与职责说明' },
    // { id: 'process', title: '无人烹饪流程', short: '烹饪流程', desc: '加工环节与参与设备' },
    // { id: 'equipment', title: '核心设备与能力', short: '设备与能力', desc: '设备、器具与已确认能力' },
    { id: 'behavior', title: '行为监控', short: '行为监控', desc: '异常分类统计与抓拍记录' },
];

/** 默认首页：运营驾驶舱（原「厨房总览」暂时下线）。 */
export const HOME_PAGE_ID = 'operations';

export interface MonitorPeriod {
    id: string;
    title: string;
}

/** 监控周期筛选为建议功能，周期定义（自然日 / 滚动时间窗）待确认。 */
export const MONITOR_PERIODS: MonitorPeriod[] = [
    { id: 'day', title: '最近一天' },
    { id: 'week', title: '最近一周' },
    { id: 'month', title: '最近一月' },
];

/** 大屏名称（演示值，实际交付屏幕名称待确认）。 */
export const DISPLAY_SCREEN_NAME = '无人智厨展示大屏 · 01';

export interface MonitorState {
    id: string;
    title: string;
    desc: string;
}

/**
 * 行为监控的数据状态，用于演示 PRD「状态、异常与边界」中的监控分支。
 * 仅用于原型评审，正式接入后由真实数据源决定。
 */
export const MONITOR_STATES: MonitorState[] = [
    { id: 'ready', title: '正常展示', desc: '有数据源，展示统计与抓拍' },
    { id: 'loading', title: '数据加载中', desc: '模块内显示加载提示，不阻塞其他页面' },
    { id: 'empty', title: '所选时段无事件', desc: '显示“所选时段暂无异常记录”' },
    { id: 'failed', title: '获取失败（保留缓存）', desc: '保留缓存内容并标明更新时间' },
    { id: 'offline', title: '监控未接入', desc: '显示“监控数据暂未接入”' },
];

const PAGE_KEY = 'ccr:display-page';
const PERIOD_KEY = 'ccr:monitor-period';
const CONNECTED_KEY = 'ccr:display-connected';
const MONITOR_STATE_KEY = 'ccr:monitor-state';
const STATE_EVENT = 'ccr:display-state-change';

function hasWindow(): boolean {
    return typeof window !== 'undefined';
}

function readKey(key: string): string | null {
    if (!hasWindow()) return null;
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeKey(key: string, value: string): void {
    if (!hasWindow()) return;
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // 隐私模式等场景写入失败时忽略，仅影响跨窗口联动
    }
    window.dispatchEvent(new Event(STATE_EVENT));
}

export function isDisplayPageId(id: string): boolean {
    return DISPLAY_PAGES.some((page) => page.id === id);
}

export function readDisplayPageId(): string {
    const stored = readKey(PAGE_KEY);
    return stored && isDisplayPageId(stored) ? stored : HOME_PAGE_ID;
}

export function writeDisplayPageId(id: string): void {
    if (isDisplayPageId(id)) writeKey(PAGE_KEY, id);
}

export function readMonitorPeriod(): string {
    const stored = readKey(PERIOD_KEY);
    return stored && MONITOR_PERIODS.some((period) => period.id === stored) ? stored : 'day';
}

export function writeMonitorPeriod(id: string): void {
    if (MONITOR_PERIODS.some((period) => period.id === id)) writeKey(PERIOD_KEY, id);
}

/** 控制连接状态：断开后大屏保留最后成功内容，控制端不虚报成功。 */
export function readConnected(): boolean {
    return readKey(CONNECTED_KEY) !== '0';
}

export function writeConnected(value: boolean): void {
    writeKey(CONNECTED_KEY, value ? '1' : '0');
}

export function readMonitorState(): string {
    const override = readMonitorStateOverride();
    if (override) return override;
    const stored = readKey(MONITOR_STATE_KEY);
    return stored && MONITOR_STATES.some((state) => state.id === stored) ? stored : 'ready';
}

/**
 * 评审用深链：`#page=behavior&monitor=loading` 可直接打开某个数据状态，
 * 便于逐一核对 PRD「状态、异常与边界」中的监控分支。仅读不写，不影响控制端状态。
 */
function readMonitorStateOverride(): string | null {
    if (!hasWindow()) return null;
    const rawHash = String(window.location.hash || '').replace(/^#/, '');
    const value = new URLSearchParams(rawHash).get('monitor');
    return value && MONITOR_STATES.some((state) => state.id === value) ? value : null;
}

export function writeMonitorState(id: string): void {
    if (MONITOR_STATES.some((state) => state.id === id)) writeKey(MONITOR_STATE_KEY, id);
}

export interface DisplayState {
    pageId: string;
    period: string;
    connected: boolean;
    monitorState: string;
    setPageId: (id: string) => void;
    setPeriod: (id: string) => void;
    setConnected: (value: boolean) => void;
    setMonitorState: (id: string) => void;
}

export function useDisplayState(): DisplayState {
    const [pageId, setPageIdState] = useState<string>(() => readDisplayPageId());
    const [period, setPeriodState] = useState<string>(() => readMonitorPeriod());
    const [connected, setConnectedState] = useState<boolean>(() => readConnected());
    const [monitorState, setMonitorStateValue] = useState<string>(() => readMonitorState());

    useEffect(() => {
        if (!hasWindow()) return undefined;
        const sync = () => {
            setPageIdState(readDisplayPageId());
            setPeriodState(readMonitorPeriod());
            setConnectedState(readConnected());
            setMonitorStateValue(readMonitorState());
        };
        window.addEventListener('storage', sync);
        window.addEventListener(STATE_EVENT, sync);
        window.addEventListener('hashchange', sync);
        return () => {
            window.removeEventListener('storage', sync);
            window.removeEventListener(STATE_EVENT, sync);
            window.removeEventListener('hashchange', sync);
        };
    }, []);

    return {
        pageId,
        period,
        connected,
        monitorState,
        setPageId: writeDisplayPageId,
        setPeriod: writeMonitorPeriod,
        setConnected: writeConnected,
        setMonitorState: writeMonitorState,
    };
}
