import React, { useState } from 'react';

type DirectoryItem = { id: string; label: string };

const BUSINESS_PAGES: DirectoryItem[] = [
  { id: 'cockpit', label: '生产烹饪' },
  { id: 'nutrition', label: '营养健康' },
  { id: 'overview', label: '出餐统计' },
  { id: 'behavior', label: '行为监控' },
];

const TOP_LEVEL_PAGES: DirectoryItem[] = [
  { id: 'version', label: '版本管理' },
  { id: 'requirements', label: '需求文档' },
];

const BACKEND_PAGES: DirectoryItem[] = [
  { id: 'admin', label: '驾驶舱配置后台' },
  { id: 'production-process-view', label: '基础后台-生产工艺查看' },
  { id: 'production-process-edit', label: '基础后台-编辑生产工艺' },
  { id: 'production-process-edit-ai-timeout', label: '基础后台-编辑生产工艺-生成超时' },
  { id: 'production-process-edit-no-ingredients', label: '基础后台-编辑生产工艺-无原料' },
  { id: 'meal-menu', label: '商户后台-食堂餐品' },
];

const REFERENCE_PAGES: DirectoryItem[] = [
  { id: 'reference-no-data', label: '驾驶舱-无数据' },
  { id: 'reference-load-failed', label: '驾驶舱-加载失败' },
];

export function PrototypeDirectory({ currentPageId, onNavigate }: { currentPageId: string; onNavigate: (id: string) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((groups) => ({ ...groups, [groupId]: !groups[groupId] }));
  };

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
        <div className="uk-prototype-directory-top-level">
          {renderItems(TOP_LEVEL_PAGES)}
        </div>
        <section className="uk-prototype-directory-group">
          <button type="button" className="uk-prototype-directory-group-toggle" onClick={() => toggleGroup('backend')} aria-expanded={!collapsedGroups.backend}>
            <h2><b>{collapsedGroups.backend ? '›' : '⌄'}</b>后台页面</h2>
          </button>
          {!collapsedGroups.backend ? renderItems(BACKEND_PAGES) : null}
        </section>
        <section className="uk-prototype-directory-group">
          <button type="button" className="uk-prototype-directory-group-toggle" onClick={() => toggleGroup('cockpit')} aria-expanded={!collapsedGroups.cockpit}>
            <h2><b>{collapsedGroups.cockpit ? '›' : '⌄'}</b>驾驶舱</h2>
          </button>
          {!collapsedGroups.cockpit ? <>
            {renderItems(BUSINESS_PAGES)}
            <div className="uk-prototype-directory-subgroup">
              <button type="button" className="uk-prototype-directory-subgroup-title" onClick={() => toggleGroup('exceptions')} aria-expanded={!collapsedGroups.exceptions}><i /><span>异常状态</span><b>{collapsedGroups.exceptions ? '›' : '⌄'}</b></button>
              {!collapsedGroups.exceptions ? <div className="uk-prototype-directory-subgroup-items">{renderItems(REFERENCE_PAGES)}</div> : null}
            </div>
          </> : null}
        </section>
      </div>
    </aside>
  );
}
