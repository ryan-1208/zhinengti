/**
 * @name 智能排产业务流程图
 */
import React from 'react';
import './style.css';
import flowImage from './assets/intelligent-scheduling-flow.png';
import businessFlowImage from './assets/business-page-flow.png';

const interactionNotes = [
    '每周菜单页面：每周菜单生成完成后，点击“查看菜单”返回每周菜单页面；已有菜单入口进入对应的菜单内容。',
    '语音排产页面：出现“已预生成排产计划，请查看确认”后弹出“排产计划确认”；点击“前往查看排产计划”直接进入“智能排产”。',
    '排产确认页：可查看/收起批次明细，可选择覆盖或保留已有计划，暂存后进入已保存状态，提交后进入智能排产。',
    '采购流程：订货采购 → 采购清单 → 确认下单 → 下单成功；采购清单和确认下单均支持返回上一步修改。订单采购只有接入公司订购系统显示去结算。',
    '页面辅助跳转：顶部导航可在菜单、排产、采购三个业务主页面之间直接切换；每周菜单中的“去排产”进入智能排产；排产确认中的“前往查看排产计划”进入智能排产。',
];

export default function IntelligentSchedulingFlow() {
    return (
        <main className="flow-image-page" aria-label="智能排产业务流程图">
            <header className="flow-heading">
                <h1>1.业务流程图</h1>
                <h2>1.1 排产流程图</h2>
            </header>
            <img
                className="flow-image flow-image--scheduling"
                src={flowImage}
                alt="智能排产业务流程图：开始后进入智能排产，判断是否输入生产模式，选择批次和批次时间后进行排产并确认计划，最后生成成功"
            />
            <h2 className="section-heading">2. 页面流程图</h2>
            <img
                className="flow-image flow-image--wide"
                src={businessFlowImage}
                alt="页面流程图：顶部导航连接每周菜单、智能排产和订货采购页面"
            />
            <section className="workflow-notes" aria-labelledby="workflow-notes-title">
                <h2 id="workflow-notes-title">2.1 页面交互说明</h2>
                <ul>
                    {interactionNotes.map((note) => <li key={note}>{note}</li>)}
                </ul>
            </section>
        </main>
    );
}
