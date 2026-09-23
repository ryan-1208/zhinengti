/**
 * iPad 展示控制页。
 *
 * PRD 要点：
 * - 仅控制展示，不提供任何厨房设备操作入口。
 * - 必备内容：目标大屏名称、连接状态、五个页面按钮、当前页状态、返回首页。
 * - 点击当前页不重复加载；切换失败保留原页并提示重试。
 * - 控制连接中断时显示未连接、提供重试，不虚报成功。
 * - 监控周期筛选仅在行为监控控制区展示。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    DISPLAY_PAGES,
    DISPLAY_SCREEN_NAME,
    HOME_PAGE_ID,
    MONITOR_PERIODS,
    MONITOR_STATES,
    useDisplayState,
} from '../components/displaySync';

/** 切换过程的模拟耗时：正式实现以真实设备响应为准。 */
const SWITCH_DELAY_MS = 900;

export function DisplayControl({ onNavigate }: { onNavigate: (id: string) => void }) {
    const { pageId, period, connected, monitorState, setPageId, setPeriod, setConnected, setMonitorState } = useDisplayState();
    const [switching, setSwitching] = useState<string | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    /** 演示开关：仅用于原型演示异常分支，正式交付不含此开关。 */
    const [forceFailure, setForceFailure] = useState(false);
    const timerRef = useRef<number | null>(null);

    useEffect(() => () => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    }, []);

    const currentPage = useMemo(
        () => DISPLAY_PAGES.find((page) => page.id === pageId) ?? DISPLAY_PAGES[0],
        [pageId],
    );

    const startSwitch = (targetId: string) => {
        if (!connected) return;
        if (switching) return;
        if (targetId === pageId) return;
        setFailure(null);
        setSwitching(targetId);
        timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            if (forceFailure) {
                // 切换失败：保持原页面，提示可重试
                setFailure(targetId);
            } else {
                setPageId(targetId);
            }
            setSwitching(null);
        }, SWITCH_DELAY_MS);
    };

    const handleReconnect = () => {
        setRetrying(true);
        window.setTimeout(() => {
            setConnected(true);
            setRetrying(false);
        }, 700);
    };

    return (
        <main className="cc-control-screen">
            <div className="cc-control-frame">
                <header className="cc-control-top">
                    <div>
                        <h1>展示控制</h1>
                        <p>iPad 控制端 · 仅控制展示页面，不含任何设备操作</p>
                    </div>
                    <span className="cc-control-device-tag">iPad</span>
                </header>

                <section className="cc-control-target">
                    <div>
                        <small>目标大屏</small>
                        <b>{DISPLAY_SCREEN_NAME}</b>
                    </div>
                    <div className="cc-control-conn">
                        {connected ? (
                            <span className="cc-conn ok">● 已连接</span>
                        ) : (
                            <>
                                <span className="cc-conn bad">● 未连接</span>
                                <button type="button" className="cc-btn ghost" onClick={handleReconnect} disabled={retrying}>
                                    {retrying ? '重连中…' : '重试'}
                                </button>
                            </>
                        )}
                    </div>
                </section>

                {!connected && (
                    <div className="cc-control-alert">
                        控制连接已中断：大屏保留最后成功展示的内容；未连接期间无法切页。
                    </div>
                )}

                {failure && (
                    <div className="cc-control-alert fail">
                        切换失败，已保留当前页面「{currentPage.title}」。
                        <button type="button" className="cc-btn ghost" onClick={() => startSwitch(failure)}>
                            重试
                        </button>
                    </div>
                )}

                <section className="cc-control-current">
                    <small>当前展示</small>
                    <b>{currentPage.title}</b>
                    <span>{currentPage.desc}</span>
                </section>

                <section className="cc-control-pages">
                    {DISPLAY_PAGES.map((page) => {
                        const isCurrent = page.id === pageId;
                        const isSwitching = switching === page.id;
                        return (
                            <button
                                type="button"
                                key={page.id}
                                className={isCurrent ? 'cc-page-btn active' : 'cc-page-btn'}
                                onClick={() => startSwitch(page.id)}
                                disabled={!connected || isCurrent || Boolean(switching)}
                                aria-current={isCurrent ? 'true' : undefined}
                            >
                                <b>{page.title}</b>
                                <span>{page.desc}</span>
                                <em>
                                    {isCurrent
                                        ? '当前页'
                                        : isSwitching
                                            ? '切换中…'
                                            : connected
                                                ? '点击切换'
                                                : '未连接'}
                                </em>
                            </button>
                        );
                    })}
                </section>

                <section className="cc-control-home">
                    <button
                        type="button"
                        className="cc-btn primary"
                        onClick={() => startSwitch(HOME_PAGE_ID)}
                        disabled={!connected || pageId === HOME_PAGE_ID || Boolean(switching)}
                    >
                        返回首页（{DISPLAY_PAGES[0].title}）
                    </button>
                    <span>讲解结束后可一键回到首页。</span>
                </section>

                <section className="cc-control-period">
                    <div className="cc-control-period-head">
                        <b>行为监控 · 统计周期</b>
                        <small>建议功能，仅作用于行为监控页面；周期定义（自然日／滚动时间窗）待确认</small>
                    </div>
                    <div className="cc-period-btns">
                        {MONITOR_PERIODS.map((item) => (
                            <button
                                type="button"
                                key={item.id}
                                className={period === item.id ? 'active' : ''}
                                onClick={() => setPeriod(item.id)}
                                disabled={!connected}
                            >
                                {item.title}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="cc-control-demo">
                    <b>演示开关</b>
                    <label>
                        <input
                            type="checkbox"
                            checked={!connected}
                            onChange={(event) => setConnected(!event.target.checked)}
                        />
                        模拟控制连接中断
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            checked={forceFailure}
                            onChange={(event) => setForceFailure(event.target.checked)}
                        />
                        模拟切换失败
                    </label>
                    <div className="cc-control-demo-states">
                        <span>模拟行为监控数据状态</span>
                        <div>
                            {MONITOR_STATES.map((item) => (
                                <button
                                    type="button"
                                    key={item.id}
                                    title={item.desc}
                                    className={monitorState === item.id ? 'active' : ''}
                                    onClick={() => setMonitorState(item.id)}
                                >
                                    {item.title}
                                </button>
                            ))}
                        </div>
                    </div>
                    <p>演示开关仅用于原型评审，正式交付不含此区域；同一浏览器另开窗口打开大屏页可看到切页联动。</p>
                </section>

                <footer className="cc-control-foot">
                    <button type="button" className="cc-btn ghost" onClick={() => onNavigate(HOME_PAGE_ID)}>
                        打开大屏 · {DISPLAY_PAGES[0].title}
                    </button>
                    <button type="button" className="cc-btn ghost" onClick={() => onNavigate('cockpit')}>
                        打开生产驾驶舱（保留优化）
                    </button>
                </footer>
            </div>
        </main>
    );
}
