import React from 'react';

type VersionRecord = {
  serial: number;
  version: string;
  date: string;
  author: string;
  content: string[];
};

const VERSION_RECORDS: VersionRecord[] = [
  {
    serial: 1,
    version: 'v1.0.0',
    date: '2026-10-12',
    author: '陈希阳',
    content: [
      '面向后厨管理者、客户领导和参观讲解人员，统一展示从投料到出餐的厨房生产过程',
      '设计生产烹饪页：今日菜单、菜品统计、投料区、烹饪区、出餐区、生产进度、明厨亮灶和出餐记录',
      '设计营养健康页：膳食结构建议、营养分析、动态圆环统计、今日菜单和餐品图片',
      '设计出餐统计页：按餐段查看计划、完成情况、偏差趋势和任务明细',
      '设计行为监控页：展示行为分类、事件数量、发生时间、区域、摄像头和事件图片',
      '建立四个业务页面的手动切换与 20 秒自动轮播，并支持开始和暂停轮播',
      '统一菜品、设备、生产进度、出餐记录、营养分析和统计数据的展示口径',
    ],
  },
];

export function VersionManagementView() {
  return (
    <main className="uk-version-page">
      <div className="uk-module-head">
        <div>
          <span className="uk-module-kicker">原型资料</span>
          <h1>版本管理</h1>
          <p>记录本次原型需求与页面设计范围</p>
        </div>
        <div className="uk-module-meta">
          <span><i />演示数据</span>
          <b>共 {VERSION_RECORDS.length} 个版本</b>
        </div>
      </div>

      <section className="uk-version-table-shell uk-module-panel">
        <div className="uk-version-view-tab"><span>▦</span>表格视图</div>
        <div className="uk-version-table-wrap">
          <table className="uk-version-table">
            <colgroup><col className="uk-version-index-column" /><col className="uk-version-number-column" /><col className="uk-version-content-column" /><col className="uk-version-author-column" /><col className="uk-version-date-column" /></colgroup>
            <thead><tr><th>序号</th><th>版本号</th><th>修订内容</th><th>作者</th><th>日期</th></tr></thead>
            <tbody>
              {VERSION_RECORDS.map((record, index) => (
                <tr className={index === 0 ? 'is-current' : ''} key={record.version}>
                  <td className="uk-version-index">{record.serial}</td>
                  <td className="uk-version-number">{record.version}{index === 0 ? <em>当前</em> : null}</td>
                  <td className="uk-version-content">{record.content.map((item) => <div key={item}>{item}</div>)}</td>
                  <td>{record.author}</td>
                  <td>{record.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="uk-version-table-footer"><span>共 {VERSION_RECORDS.length} 条记录</span><span>最后编辑于 {VERSION_RECORDS[0].date}</span></div>
      </section>
    </main>
  );
}
