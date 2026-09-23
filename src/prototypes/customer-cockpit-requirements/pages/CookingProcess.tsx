/**
 * 无人烹饪流程。
 *
 * PRD 要点：
 * - 展示环节名称、参与设备、负责事项、输入／输出说明。
 * - 不凭空增加自动备料、精准投料、自动清洗等能力；人工参与环节如实保留。
 * - 不自动推断炒菜机与烤箱串行工作，按并行加工路径呈现。
 * - 不显示虚构的任务百分比、当前批次或剩余时间；动画标注为流程演示。
 */
import React from 'react';
import { DisplayShell } from '../components/DisplayShell';

interface ProcessStep {
    id: string;
    name: string;
    devices: string[];
    duty: string;
    input: string;
    output: string;
    /** 人工参与环节 */
    human?: boolean;
    /** 并行分支环节 */
    parallel?: boolean;
}

const SEQUENCE_HEAD: ProcessStep[] = [
    {
        id: '01',
        name: '原料接收与暂存',
        devices: ['层架', '容器'],
        duty: '验收合格的原料按批次暂存，等待后续处理。',
        input: '验收合格原料',
        output: '待加工原料',
    },
    {
        id: '02',
        name: '人工备料（如有）',
        devices: ['人工', '容器'],
        duty: '需要人工处理的原料在此完成分切、称量与装容器。',
        input: '待加工原料',
        output: '装容器的待加工原料',
        human: true,
    },
];

const PARALLEL_STEPS: ProcessStep[] = [
    {
        id: '03',
        name: '炒菜机加工',
        devices: ['炒菜机'],
        duty: '按菜品要求完成炒制。',
        input: '装容器的待加工原料',
        output: '炒制成品',
        parallel: true,
    },
    {
        id: '04',
        name: '烤箱加工',
        devices: ['烤箱'],
        duty: '完成需要烘烤的菜品加工。',
        input: '待烘烤原料',
        output: '烘烤成品',
        parallel: true,
    },
];

const SEQUENCE_TAIL: ProcessStep[] = [
    {
        id: '05',
        name: '出品分装',
        devices: ['容器'],
        duty: '成品转入容器，准备出餐与暂存。',
        input: '成品菜',
        output: '分装容器',
    },
    {
        id: '06',
        name: '层架暂存与出餐',
        devices: ['层架'],
        duty: '成品在层架暂存，并按出餐节奏转出。',
        input: '分装容器',
        output: '出餐',
    },
];

function StepCard({ step }: { step: ProcessStep }) {
    return (
        <article className={step.parallel ? 'cc-step parallel' : 'cc-step'}>
            <header className="cc-step-head">
                <i>{step.id}</i>
                <b>{step.name}</b>
                {step.human && <span className="cc-step-badge human">人工参与</span>}
                {step.parallel && <span className="cc-step-badge parallel">并行分支</span>}
            </header>
            <div className="cc-step-devices">
                {step.devices.map((device) => (
                    <span key={device}>{device}</span>
                ))}
            </div>
            <p className="cc-step-duty">{step.duty}</p>
            <p className="cc-step-io-line">
                <em>输入</em>{step.input}
                <i>→</i>
                <em>输出</em>{step.output}
            </p>
        </article>
    );
}

function FlowArrow({ label }: { label: string }) {
    return (
        <div className="cc-flow-arrow" aria-hidden="true">
            <span>{label}</span>
            <i />
        </div>
    );
}

export function CookingProcess({ onNavigate }: { onNavigate: (id: string) => void }) {
    return (
        <DisplayShell
            title="无人烹饪流程"
            subtitle="加工环节 · 参与设备与输入输出"
            current="process"
            onNavigate={onNavigate}
        >
            <div className="cc-page-head">
                <div>
                    <h2>无人烹饪流程 · 流程演示</h2>
                    <p>按环节说明加工步骤与参与设备，用于解释无人厨房如何配合，不是现场实时任务进度。</p>
                </div>
                <div className="cc-head-tags">
                    <span className="cc-tag-assume">流程演示 · 环节待业务方确认</span>
                </div>
            </div>

            <div className="cc-flow">
                <div className="cc-flow-lane">
                    {SEQUENCE_HEAD.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <StepCard step={step} />
                            {index < SEQUENCE_HEAD.length - 1 && <FlowArrow label="流程演示" />}
                        </React.Fragment>
                    ))}
                </div>

                <FlowArrow label="分支进入加工" />

                <div className="cc-flow-parallel">
                    <span className="cc-flow-parallel-label">并行加工路径 · 不表示串行</span>
                    <div className="cc-flow-parallel-grid">
                        {PARALLEL_STEPS.map((step) => (
                            <StepCard key={step.id} step={step} />
                        ))}
                    </div>
                </div>

                <FlowArrow label="汇合出品" />

                <div className="cc-flow-lane">
                    {SEQUENCE_TAIL.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <StepCard step={step} />
                            {index < SEQUENCE_TAIL.length - 1 && <FlowArrow label="流程演示" />}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="cc-flow-foot">
                <span>流程演示 · 环节名称与职责为结构示例，需由厨房业务与设备团队补充确认。</span>
                <span>人工参与环节如实保留 · 不展示任务百分比、当前批次或剩余时间</span>
            </div>
        </DisplayShell>
    );
}
