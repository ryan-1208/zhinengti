/**
 * @name 表格展示
 */
import React from 'react';
import './style.css';

type RecordItem = {
  id: number;
  content: string;
  author: string;
  date: string;
};

const initialRecords: RecordItem[] = [
  { id: 1, content: '1.新增修改就餐人数接口', author: '陈希阳', date: '2026-08-04' },
  { id: 2, content: '2.语音助手对话流程优化', author: '', date: '' },
  { id: 3, content: '3.新增生成菜单结果提示', author: '', date: '' },
  { id: 4, content: '4.生成菜单条件新增“烹饪时限”、“设备比例”', author: '', date: '' },
  { id: 5, content: '5.新增语音排产流程', author: '', date: '' },
  { id: 6, content: '6.菜单生成、语音排产对话合并（暂不开发 ）', author: '', date: '' },
  { id: 7, content: '7.新增订货采购页面', author: '', date: '' },
  { id: 8, content: '8.增加无餐段提示', author: '', date: '' },
  { id: 9, content: '9.工单列表、工单详情、备餐屏、称重加料屏、轻量总控屏增加批次字段', author: '', date: '' },
]; 

const combinedContent = initialRecords.map((record) => record.content).join('\n');
const version110Content = '1.支持生成菜单条件二次修改，见对话修改示例页面\n2.新增点击查看菜单生成第一天所在周\n3.ai 生成菜单新增结果提示\n4.后台增加批次逻辑，备餐屏排产计划、语音排产同时优化';

export default function TableViewPrototype() {
  return (
    <main className="table-page" aria-label="表格展示">
      <header className="page-header">
      </header>

      <section className="table-shell">
        <div className="table-title-row">
          <div>
            <h1>版本管理</h1>
            <p>记录每次修订的内容，方便追踪。</p>
          </div>
        </div>

        <div className="view-tabs" aria-label="当前视图">
          <div className="active-tab"><span className="grid-symbol">▦</span> 表格视图</div>
        </div>

        <div className="table-viewport">
          <table className="records-table">
            <colgroup><col className="index-column" /><col className="version-column" /><col className="content-column" /><col className="author-column" /><col className="date-column" /></colgroup>
            <thead>
              <tr>
                <th className="row-check">序号</th>
                <th><span className="field-icon">☷</span> 版本号</th>
                <th><span className="field-icon">☷</span> 修订内容</th>
                <th><span className="field-icon">☷</span> 作者</th>
                <th><span className="field-icon">▣</span> 日期</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="row-number">1</td>
                <td className="text-cell">v1.0.0</td>
                <td className="text-cell content-cell">{combinedContent}</td>
                <td className="text-cell">{initialRecords[0].author}</td>
                <td className="text-cell">{initialRecords[0].date}</td>
              </tr>
              <tr>
                <td className="row-number">2</td>
                <td className="text-cell">v1.1.0</td>
                <td className="text-cell content-cell">{version110Content}</td>
                <td className="text-cell">陈希阳</td>
                <td className="text-cell">2026-08-28</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="table-footer"><span>共 2 条记录，包含 11 项修订</span><span>最后编辑于 2026-08-28</span></div>
      </section>
    </main>
  );
}
