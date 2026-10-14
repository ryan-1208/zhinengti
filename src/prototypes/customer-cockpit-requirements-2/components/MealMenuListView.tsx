import React from 'react';
import './MealMenuListView.css';

const MENU_ROWS = [
  ['408', '肉丝元白菜-清华', '测试001', '小荤', '肉类', '清淡', '中系', '绿色', '1'],
  ['404', '狮子头', 'szt', '小荤', '肉类', '清淡', '中系', '黄色', '2'],
  ['403', '韭菜炒香干', 'jccxg', '小荤', '肉类', '咸鲜', '中系', '绿色', '3'],
  ['402', '红烧干张', 'hsqz', '小荤', '肉类', '咸鲜', '中系', '绿色', '4'],
  ['401', '蒜蓉小白菜', 'srxbc', '蔬菜', '时蔬', '咸鲜', '中系', '绿色', '5'],
  ['400', '清炒油麦菜', 'qcymc', '蔬菜', '时蔬', '咸鲜', '中系', '绿色', '6'],
  ['399', '狮子头配油豆腐', 'sztpydf', '小荤', '豆制品', '咸鲜', '中系', '黄色', '7'],
  ['377', '牛腩烧冻豆腐', 'nnsddf', '小荤', '肉类', '清淡', '中系', '绿色', '8'],
  ['330', '大排烧百叶', 'dpsbyj', '测测', '豆制品', '甜', '家常', '绿色', '9'],
  ['325', '鱼块烧老豆腐', 'yksldf', '小荤', '豆制品', '咸鲜', '中系', '绿色', '10'],
];

const FILTERS = [
  ['餐品名称：', '餐品名称'],
  ['餐品编号：', '餐品编号'],
  ['一级分类：', '全部'],
  ['二级分类：', '全部'],
  ['菜系：', '全部'],
  ['口味：', '全部'],
  ['餐品分级：', '全部'],
  ['是否启用：', '全部'],
];

function StaticFilter({ label, placeholder }: { label: string; placeholder: string }) {
  const isInput = placeholder !== '全部';
  return <label className="mm-filter"><b>{label}</b><span className={isInput ? 'mm-filter-input' : 'mm-filter-select'}>{placeholder}{!isInput ? <i>⌄</i> : null}</span></label>;
}

export function MealMenuListView() {
  return (
    <div className="mm-shell">
      <aside className="mm-sidebar">
        <div className="mm-home">首页</div>
        <div className="mm-side-group"><span>生产管理 <i>⌄</i></span></div>
        <div className="mm-side-group"><span>设备管理 <i>⌄</i></span></div>
        <div className="mm-side-group"><span>工艺管理 <i>⌄</i></span></div>
        <div className="mm-side-group is-open"><span>餐品管理 <i>⌃</i></span><em>预处理后原料</em><em>烹饪后原料</em><em className="is-active">食堂餐品</em><em>食堂原料</em><em>餐品一级分类</em><em>餐品二级分类</em><em>餐品菜系</em><em>餐品口味</em><em>餐品标签</em></div>
        <div className="mm-side-group"><span>权限管理 <i>⌄</i></span></div>
        <div className="mm-side-group"><span>系统管理 <i>⌄</i></span></div>
      </aside>
      <div className="mm-main">
        <header className="mm-topbar"><div className="mm-breadcrumb"><b className="mm-menu-icon">☰</b><strong>首页</strong><i>/</i><strong>餐品管理</strong><i>/</i><span>商户后台-食堂餐品</span></div><div className="mm-canteen">当前食堂：排产测试用 - 自动生成排产计划测试用 <span>切换食堂⌄</span><b className="mm-logo">膳<br />食</b><small>⌄</small></div></header>
        <nav className="mm-workspace-tabs"><span>首页</span><span>语音交互管理 ×</span><span>生产工单 ×</span><span>生产工艺 ×</span><span>查看生产工艺 ×</span><span>食堂原料 ×</span><span>餐品一级分类 ×</span><span>查看一级分类 ×</span><span>烹饪后原料 ×</span><strong>● 商户后台-食堂餐品 ×</strong><span>预处理后原料 ×</span></nav>
        <main className="mm-content">
          <section className="mm-filter-card"><h2>⌕<span>筛选</span></h2><div className="mm-filter-grid">{FILTERS.map(([label, placeholder]) => <StaticFilter key={label} label={label} placeholder={placeholder} />)}</div><div className="mm-filter-actions"><button disabled>重置</button><button className="is-primary" disabled>搜索</button></div></section>
          <section className="mm-list-title"><h2>▣ 餐品列表</h2><div><button className="is-download" data-annotation-id="meal-menu-download" disabled>从云餐品库下载</button><button className="is-primary" disabled>添加</button></div></section>
          <section className="mm-table-card"><table><thead><tr><th>ID</th><th>餐品名称</th><th>餐品编号</th><th>一级分类</th><th>二级分类</th><th>口味</th><th>菜系</th><th>餐品分级</th><th>排序</th><th>来源</th><th>是否启用</th><th>操作</th></tr></thead><tbody>{MENU_ROWS.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{index === 5 ? <span className="mm-taste">{cell}</span> : index === 7 ? <span className={`mm-grade ${cell === '黄色' ? 'is-yellow' : ''}`}>{cell}</span> : index === 10 ? <span className="mm-toggle"><i /></span> : index === 11 ? <span className="mm-actions">查看&nbsp;&nbsp;编辑</span> : cell}</td>)}</tr>)}</tbody></table></section>
        </main>
      </div>
    </div>
  );
}
