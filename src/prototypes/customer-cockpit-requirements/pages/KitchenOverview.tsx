/**
 * 厨房总览（默认首页）。
 *
 * PRD 要点：
 * - 主视觉为“设备协同示意图”，不冒充现场还原，不依赖真实三维模型。
 * - 机械臂居中为评审建议布局；连线仅表达已确认关系，评审阶段假设关系必须标注。
 * - 每个节点只展示名称与一句职责，长说明放在设备与能力页。
 * - 首页无需点击即可理解，不强制加入实时指标、数量、运行状态或产能数字。
 */
import React from 'react';
import { DeviceGlyph, type DeviceKind } from '../components/DeviceGlyph';
import { DisplayShell } from '../components/DisplayShell';

interface NodeConfig {
    id: string;
    kind: DeviceKind;
    name: string;
    role: string;
    duty: string;
    /** 在示意图舞台中的百分比位置（节点中心） */
    left: string;
    top: string;
    /** 是否为中枢节点 */
    hub?: boolean;
}

const NODES: NodeConfig[] = [
    { id: 'wok', kind: 'wok', name: '炒菜机', role: '加工节点', duty: '按菜品要求完成炒制', left: '16%', top: '24%' },
    { id: 'oven', kind: 'oven', name: '烤箱', role: '加工节点', duty: '完成烘烤类菜品加工', left: '84%', top: '24%' },
    { id: 'arm', kind: 'arm', name: '机械臂', role: '中枢（评审建议）', duty: '设备间搬运与投放（假设）', left: '50%', top: '50%', hub: true },
    { id: 'container', kind: 'container', name: '容器', role: '器具', duty: '盛放原料与成品', left: '16%', top: '78%' },
    { id: 'rack', kind: 'rack', name: '层架', role: '器具', duty: '原料与成品暂存承载', left: '84%', top: '78%' },
];

/** 连线按舞台坐标系（1120 × 470）绘制，均为中心到中心，被节点卡片遮挡。 */
const CENTER = { x: 560, y: 235 };
const LINKS = NODES.filter((node) => !node.hub).map((node) => ({
    id: node.id,
    x: (Number.parseFloat(node.left) / 100) * 1120,
    y: (Number.parseFloat(node.top) / 100) * 470,
}));

export function KitchenOverview({ onNavigate }: { onNavigate: (id: string) => void }) {
    return (
        <DisplayShell
            title="厨房总览"
            subtitle="设备协同示意 · 设备组成与职责"
            current="overview"
            onNavigate={onNavigate}
        >
            <div className="cc-page-head">
                <div>
                    <h2>设备协同示意</h2>
                    <p>展示无人厨房的设备组成与协作职责，不还原现场空间布局。</p>
                </div>
                <div className="cc-head-tags">
                    <span className="cc-tag-assume">虚线 = 评审阶段假设关系</span>
                    <span className="cc-tag-note">示意图 · 非现场还原</span>
                </div>
            </div>

            <div className="cc-diagram-wrap">
                <div className="cc-diagram">
                    <svg className="cc-diagram-lines" viewBox="0 0 1120 470" preserveAspectRatio="none" aria-hidden="true">
                        <defs>
                            <linearGradient id="cc-link-gradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#0be4f0" stopOpacity="0.15" />
                                <stop offset="50%" stopColor="#0be4f0" stopOpacity="0.85" />
                                <stop offset="100%" stopColor="#0be4f0" stopOpacity="0.15" />
                            </linearGradient>
                        </defs>
                        {LINKS.map((link) => (
                            <line
                                key={link.id}
                                x1={CENTER.x}
                                y1={CENTER.y}
                                x2={link.x}
                                y2={link.y}
                                className="cc-link-line"
                            />
                        ))}
                    </svg>

                    {NODES.map((node) => (
                        <article
                            key={node.id}
                            className={node.hub ? 'cc-node cc-node-hub' : 'cc-node'}
                            style={{ left: node.left, top: node.top }}
                        >
                            <span className={node.hub ? 'cc-node-role hub' : 'cc-node-role'}>{node.role}</span>
                            <DeviceGlyph kind={node.kind} className="cc-node-glyph" />
                            <b>{node.name}</b>
                            <p>{node.duty}</p>
                        </article>
                    ))}
                </div>
            </div>

            <div className="cc-overview-notes">
                <div className="cc-note-card">
                    <b>设备协同示意</b>
                    <p>机械臂居中为评审阶段建议布局，不代表现场位置，也不表示机械臂已负责所有设备间搬运。</p>
                </div>
                <div className="cc-note-card">
                    <b>协作关系待确认</b>
                    <p>图中虚线仅用于说明可能的协作方式，正式交付前需由业务与设备团队核实。</p>
                </div>
                <div className="cc-note-card">
                    <b>候选清单 ≠ 已部署清单</b>
                    <p>炒菜机、机械臂、烤箱、容器、层架为候选设备与器具，型号、数量与用途尚未确认。</p>
                </div>
                <div className="cc-note-card">
                    <b>无实时指标</b>
                    <p>本页不展示称重量、任务进度、设备运行状态或产能数字；显示端连接正常不等于厨房设备正常。</p>
                </div>
            </div>
        </DisplayShell>
    );
}
