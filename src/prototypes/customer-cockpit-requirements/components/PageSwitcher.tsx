/**
 * 原型页面切换器。
 *
 * 仅用于原型评审：在 PRD 五页、保留优化的生产驾驶舱与 iPad 展示控制页之间跳转。
 * 不属于交付给客户的展示界面，正式交付时移除。
 */
import React, { useState } from 'react';
import { DISPLAY_PAGES } from './displaySync';

const EXTRA_PAGES = [
    { id: 'control', title: 'iPad 展示控制页' },
    { id: 'cockpit', title: '生产驾驶舱（保留优化）' },
];

export function PageSwitcher({ current, onSelect }: { current: string; onSelect: (id: string) => void }) {
    const [open, setOpen] = useState(false);
    const activeTitle = [...DISPLAY_PAGES.map((page) => ({ id: page.id, title: page.title })), ...EXTRA_PAGES]
        .find((page) => page.id === current)?.title ?? current;

    return (
        <div className={open ? 'cc-switcher open' : 'cc-switcher'}>
            {open && (
                <div className="cc-switcher-panel" role="menu" aria-label="原型页面切换">
                    <div className="cc-switcher-head">
                        <b>原型页面</b>
                        <small>仅评审用，不随交付发布</small>
                    </div>
                    {DISPLAY_PAGES.map((page) => (
                        <button
                            type="button"
                            role="menuitem"
                            key={page.id}
                            className={current === page.id ? 'active' : ''}
                            onClick={() => { onSelect(page.id); setOpen(false); }}
                        >
                            <b>{page.title}</b>
                            <span>{page.desc}</span>
                        </button>
                    ))}
                    <div className="cc-switcher-split">其他</div>
                    {EXTRA_PAGES.map((page) => (
                        <button
                            type="button"
                            role="menuitem"
                            key={page.id}
                            className={current === page.id ? 'active' : ''}
                            onClick={() => { onSelect(page.id); setOpen(false); }}
                        >
                            <b>{page.title}</b>
                        </button>
                    ))}
                </div>
            )}
            <button
                type="button"
                className="cc-switcher-toggle"
                aria-expanded={open}
                title={`原型页面 · 当前：${activeTitle}`}
                onClick={() => setOpen((value) => !value)}
            >
                {open ? '收起' : '原型页面'}
            </button>
        </div>
    );
}
