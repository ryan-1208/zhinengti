import React from 'react';
import './ProductionProcessView.css';

type ProcessMode = 'view' | 'edit';
type ProcessTab = 'basic' | 'preprocess' | 'ingredients' | 'today' | 'output' | 'nutrition';
type NutritionState = 'normal' | 'ai-timeout' | 'no-ingredients';

const PROCESS_TABS: Array<{ id: ProcessTab; label: string }> = [
  { id: 'basic', label: '基本信息' }, { id: 'preprocess', label: '预处理' },
  { id: 'ingredients', label: '烹饪原料' }, { id: 'today', label: '当天烹饪' },
  { id: 'output', label: '出餐' }, { id: 'nutrition', label: '营养素' },
];

const NUTRITION_ROWS = [
  ['能量', '132', 'kcal'], ['蛋白质', '8.6', 'g'], ['脂肪', '8.1', 'g'],
  ['碳水化合物', '4.4', 'g'], ['膳食纤维', '0.2', 'g'], ['钠', '286', 'mg'],
];

function Field({ label, value, mode, unit, placeholder }: { label: string; value: string; mode: ProcessMode; unit?: string; placeholder?: string }) {
  if (mode === 'view') return <div className="pp-field"><span>{label}</span><div className="pp-readonly-value">{value}{unit ? <em>{unit}</em> : null}</div></div>;
  return <label className="pp-field"><span>{label}</span><div className="pp-input-wrap"><input value={value} placeholder={placeholder} readOnly />{unit ? <em>{unit}</em> : null}</div></label>;
}

function InfoTable({ rows }: { rows: Array<[string, string, string]> }) {
  return <div className="pp-info-table"><div className="pp-info-head"><span>项目</span><span>当前值</span><span>说明</span></div>{rows.map((row) => <div className="pp-info-row" key={row[0]}><b>{row[0]}</b><span>{row[1]}</span><em>{row[2]}</em></div>)}</div>;
}

function BasicInfoTab({ mode }: { mode: ProcessMode }) {
  return <section className="pp-simple-tab"><div className="pp-section-title"><div><h3>基本信息</h3><p>餐品生产工艺的基础配置。</p></div><span className={mode === 'edit' ? 'pp-edit-tip' : 'pp-view-tip'}>{mode === 'edit' ? '编辑中' : '只读查看'}</span></div><div className="pp-form-grid"><Field label="餐品SOP名称" value="永川似漂羹SOP" mode={mode} /><Field label="工艺类型" value="A类（仅当天烹饪）" mode={mode} /><Field label="餐品名称" value="永川似漂羹" mode={mode} /><Field label="餐品编号" value="F138" mode={mode} /><Field label="成品重量" value="6666" unit="g" mode={mode} /><Field label="是否启用" value="启用" mode={mode} /></div><div className="pp-enabled-row"><b>工艺状态</b><span className="pp-switch is-on"><i /></span><span className="is-enabled">已启用</span></div></section>;
}

function SimpleInfoTab({ tab }: { tab: Exclude<ProcessTab, 'basic' | 'nutrition'> }) {
  if (tab === 'preprocess') return <InfoTable rows={[['清洗去皮', '原料处理', '按原料验收标准完成'], ['切配称量', '备料', '按 SOP 净料重量执行'], ['分盘备料', '待烹饪', '成品盘数与当日排产一致']]} />;
  if (tab === 'ingredients') return <InfoTable rows={[['主料', '鸡蛋 / 饮用水', '按单盘成品重量换算'], ['辅料', '食用油 / 食盐', '按 SOP 配比录入'], ['来源', '食物成分表', '用于营养素计算']]} />;
  if (tab === 'today') return <InfoTable rows={[['烹饪次数', '1', '当天烹饪次数'], ['容器数量', '1', '主料容器数量'], ['烹饪设备', '烤箱 / 佳斯特6层烤箱', '生产设备']]} />;
  return <InfoTable rows={[['出餐方式', '按盘出餐', '出餐数量与工单联动'], ['成品重量', '6666 g / 盘', '成品规格'], ['状态', '已启用', '当前生产工艺状态']]} />;
}

function NutritionTab({ mode, state }: { mode: ProcessMode; state: NutritionState }) {
  const aiResult = state === 'ai-timeout'
    ? { tone: 'is-error', message: 'AI 生成超时，请重试', action: 'AI 生成营养素' }
    : state === 'no-ingredients'
      ? { tone: 'is-warning', message: '当前无原料，请在当天烹饪中补充原料', action: 'AI 生成营养素' }
      : { tone: 'is-success', message: 'AI 生成成功，营养素数据已更新', action: 'AI 生成营养素' };
  return <section className="pp-nutrition-tab"><div className="pp-section-title"><div><h3>营养素</h3><p>当前餐品每 100g 成品的营养素数据。</p></div></div><section className="pp-subcard"><div className="pp-nutrient-grid">{NUTRITION_ROWS.map(([label, value, unit]) => <Field key={label} label={label} value={value} unit={unit} placeholder={mode === 'edit' ? `请输入${label}` : undefined} mode={mode} />)}</div>{mode === 'edit' ? <div className="pp-ai-actions"><span className={`pp-ai-message ${aiResult.tone}`}><i>{state === 'normal' ? '✓' : '!'}</i>{aiResult.message}</span><button type="button" className="pp-secondary" data-annotation-id="production-process-ai-nutrition">{aiResult.action}</button></div> : null}</section></section>;
}

export function ProductionProcessView({ mode, state = 'normal' }: { mode: ProcessMode; state?: NutritionState }) {
  const title = mode === 'edit' ? '编辑生产工艺' : '查看生产工艺';
  return <div className="pp-shell"><aside className="pp-sidebar"><div className="pp-home">首页</div><div className="pp-side-group"><span>生产管理 <i>⌄</i></span></div><div className="pp-side-group"><span>设备管理 <i>⌄</i></span></div><div className="pp-side-group is-open"><span>工艺管理 <i>⌃</i></span><button type="button" className="is-active">生产工艺</button><button type="button">炒菜机程序</button><button type="button">烤箱程序</button><button type="button">预处理库</button></div><div className="pp-side-group"><span>餐品管理 <i>⌄</i></span></div><div className="pp-side-group"><span>权限管理 <i>⌄</i></span></div><div className="pp-side-group"><span>系统管理 <i>⌄</i></span></div></aside><div className="pp-main"><header className="pp-topbar"><div className="pp-breadcrumb"><b className="pp-menu-icon">☰</b><strong>首页</strong><i>/</i><strong>工艺管理</strong><i>/</i><span>{title}</span></div><div className="pp-canteen">当前食堂：排产测试用 - 自动生成排产计划测试用 <span className="pp-logo-mark">膳<br />食</span><small>⌄</small></div></header><nav className="pp-workspace-tabs"><button type="button">首页</button><button type="button">餐品库 ×</button><button type="button">生产工艺 ×</button><button type="button" className="is-current">● {title} ×</button></nav><main className="pp-content"><h1>{title}</h1><section className="pp-card"><div className="pp-tabs">{PROCESS_TABS.map((tab) => <button type="button" key={tab.id} className={tab.id === 'nutrition' ? 'is-active' : ''} data-annotation-id={tab.id === 'nutrition' ? 'production-process-nutrition-tab' : undefined}>{tab.label}</button>)}</div><div className="pp-panel"><NutritionTab mode={mode} state={state} /></div><div className="pp-form-actions"><button type="button" className="pp-back">返回</button>{mode === 'edit' ? <button type="button" className="pp-primary">保存</button> : null}</div></section></main></div></div>;
}
