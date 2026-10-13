import React, { useState } from 'react';

type DirectoryItem = { id: string; label: string };

const BUSINESS_PAGES: DirectoryItem[] = [
  { id: 'cockpit', label: '生产烹饪' },
  { id: 'nutrition', label: '营养健康' },
  { id: 'overview', label: '出餐统计' },
  { id: 'behavior', label: '行为监控' },
];

const MANAGEMENT_PAGES: DirectoryItem[] = [
  { id: 'admin', label: '驾驶舱配置后台' },
  { id: 'version', label: '版本管理' },
  { id: 'requirements', label: '需求文档' },
];

const REFERENCE_PAGES: DirectoryItem[] = [
  { id: 'reference-no-data', label: '驾驶舱-无数据' },
  { id: 'reference-load-failed', label: '驾驶舱-加载失败' },
];

export function PrototypeDirectory({ currentPageId, onNavigate }: { currentPageId: string; onNavigate: (id: string) => void }) {
  const [collapsed, setCollapsed] = useState(false);

  const renderItems = (items: DirectoryItem[]) => items.map((item) => (
    <button
      type="button"
      key={item.id}
      className={currentPageId === item.id ? 'uk-prototype-directory-link is-active' : 'uk-prototype-directory-link'}
      onClick={() => onNavigate(item.id)}
    >
      <i />
      <span>{item.label}</span>
    </button>
  ));

  return (
    <aside className={`uk-prototype-directory${collapsed ? ' is-collapsed' : ''}`} aria-label="原型目录">
      <button
        type="button"
        className="uk-prototype-directory-toggle"
        onClick={() => setCollapsed((value) => !value)}
        aria-label={collapsed ? '展开原型目录' : '收起原型目录'}
        title={collapsed ? '打开目录' : '收起目录'}
      >
        {collapsed ? '› 打开目录' : '‹ 收起目录'}
      </button>
      <div className="uk-prototype-directory-inner">
        <div className="uk-prototype-directory-heading">
          <span>原型目录</span>
          <small>智慧厨房驾驶舱</small>
        </div>
        <section className="uk-prototype-directory-group">
          <h2><b>⌄</b>原型管理</h2>
          {renderItems(MANAGEMENT_PAGES)}
        </section>
        <section className="uk-prototype-directory-group">
          <h2><b>⌄</b>开发参考 · 异常状态</h2>
          {renderItems(REFERENCE_PAGES)}
        </section>
        <section className="uk-prototype-directory-group">
          <h2><b>⌄</b>业务页面</h2>
          {renderItems(BUSINESS_PAGES)}
        </section>
      </div>
    </aside>
  );
}
