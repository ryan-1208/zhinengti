/**
 * 大屏底部页面导航：五页直达 + 返回首页。
 * 非触摸大屏本身不需要点击；该导航用于讲解与原型演示。
 */
import React from 'react';
import { DISPLAY_PAGES, HOME_PAGE_ID } from './displaySync';

export function CockpitTopNav({ current, onSelect }: { current: string; onSelect: (id: string) => void }) {
    return (
        <nav className="cc-cockpit-top-nav" aria-label="驾驶舱主题切换">
            <button type="button" className={current === 'operations' ? 'active' : ''} onClick={() => onSelect('operations')}>运营驾驶舱</button>
            <button type="button" className={current === 'behavior' ? 'active' : ''} onClick={() => onSelect('behavior')}>行为监控</button>
        </nav>
    );
}

export function DisplayNav({ current, onSelect }: { current: string; onSelect: (id: string) => void }) {
    return (
        <nav className="cc-nav" aria-label="展示页面导航">
            {DISPLAY_PAGES.map((page) => (
                <button
                    type="button"
                    key={page.id}
                    className={current === page.id ? 'cc-nav-item active' : 'cc-nav-item'}
                    aria-current={current === page.id ? 'page' : undefined}
                    onClick={() => onSelect(page.id)}
                >
                    {page.short}
                </button>
            ))}
            <button
                type="button"
                className="cc-nav-home"
                onClick={() => onSelect(HOME_PAGE_ID)}
                disabled={current === HOME_PAGE_ID}
            >
                返回首页
            </button>
        </nav>
    );
}
