/**
 * 大屏页面外壳：统一顶部信息与底部导航。
 * 顶部固定展示产品标题、客户／项目名称占位与当前页面名称。
 */
import React from 'react';
import { CockpitTopNav, DisplayNav } from './DisplayNav';

export interface DisplayShellProps {
    /** 当前页面名称，同时用于顶部“当前页面”标识 */
    title: string;
    /** 页面副标题，用于说明该页职责 */
    subtitle: string;
    current: string;
    onNavigate: (id: string) => void;
    /** 是否展示“演示数据”标识 */
    demo?: boolean;
    /** 是否在页面上方展示运营驾驶舱／行为监控大按钮 */
    showCockpitNav?: boolean;
    /** 是否展示底部页面导航 */
    showBottomNav?: boolean;
    /** 页面视觉变体 */
    screenClassName?: string;
    children: React.ReactNode;
}

export function DisplayShell({ title, subtitle, current, onNavigate, demo = true, showCockpitNav = false, showBottomNav = true, screenClassName = '', children }: DisplayShellProps) {
    return (
        <main className={`cc-screen ${screenClassName}`.trim()}>
            <header className="cc-top">
                <div className="cc-brand">
                    <div className="cc-logo">智</div>
                    <div>
                        <h1>无人智厨展示大屏</h1>
                        <p>{subtitle}</p>
                    </div>
                </div>
                <div className="cc-top-meta">
                    <span className="cc-project">客户／项目名称：待确认</span>
                    <span className="cc-current">当前页面 · {title}</span>
                    {demo && <span className="cc-demo-badge">演示数据</span>}
                </div>
            </header>
            {showCockpitNav && <CockpitTopNav current={current} onSelect={onNavigate} />}
            <section className="cc-body">{children}</section>
            {showBottomNav && <DisplayNav current={current} onSelect={onNavigate} />}
        </main>
    );
}
