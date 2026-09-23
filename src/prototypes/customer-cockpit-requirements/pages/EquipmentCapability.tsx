/**
 * 核心设备与能力。
 *
 * PRD 要点：
 * - 展示候选设备与器具的名称、图片、用途及经确认的能力；型号与数量可缺省。
 * - 区分“设备具有称重能力”和“系统可读取称重数据”，两者不能互相推导。
 * - 容器与层架按器具展示，不默认计为联网设备；数量未知时不显示数量。
 * - 首版优先一页完整展示。
 */
import React from 'react';
import { DeviceGlyph, type DeviceKind } from '../components/DeviceGlyph';
import { DisplayShell } from '../components/DisplayShell';

type ConfirmState = '已确认' | '待确认';

interface Capability {
    label: string;
    state: ConfirmState;
    note?: string;
}

interface EquipmentItem {
    id: string;
    kind: DeviceKind;
    name: string;
    category: '候选设备' | '器具';
    purpose: string;
    capabilities: Capability[];
}

const ITEMS: EquipmentItem[] = [
    {
        id: 'wok',
        kind: 'wok',
        name: '炒菜机',
        category: '候选设备',
        purpose: '按菜品要求完成炒制，是主要的加工节点之一。',
        capabilities: [
            { label: '自动翻炒', state: '待确认' },
            { label: '火力与时间设定', state: '待确认' },
            { label: '设备具有称重能力', state: '待确认', note: '属设备本体能力' },
            { label: '系统可读取称重数据', state: '待确认', note: '属数据接入能力，与上一条不能互相推导' },
        ],
    },
    {
        id: 'arm',
        kind: 'arm',
        name: '机械臂',
        category: '候选设备',
        purpose: '承担设备间搬运与投放；具体搬运对象与连接设备为评审假设。',
        capabilities: [
            { label: '抓取与搬运', state: '待确认' },
            { label: '与炒菜机／烤箱协同', state: '待确认', note: '评审阶段假设关系' },
        ],
    },
    {
        id: 'oven',
        kind: 'oven',
        name: '烤箱',
        category: '候选设备',
        purpose: '完成烘烤类菜品加工，与炒菜机为不同加工路径。',
        capabilities: [
            { label: '温度控制', state: '待确认' },
            { label: '定时与结束提醒', state: '待确认' },
        ],
    },
    {
        id: 'container',
        kind: 'container',
        name: '容器',
        category: '器具',
        purpose: '盛放原料与成品，配合加工与出品分装。',
        capabilities: [
            { label: '不计为联网设备', state: '已确认' },
            { label: '容量与规格', state: '待确认' },
        ],
    },
    {
        id: 'rack',
        kind: 'rack',
        name: '层架',
        category: '器具',
        purpose: '原料与成品的暂存承载，连接备料与出餐环节。',
        capabilities: [
            { label: '不计为联网设备', state: '已确认' },
            { label: '层数与规格', state: '待确认' },
        ],
    },
];

export function EquipmentCapability({ onNavigate }: { onNavigate: (id: string) => void }) {
    return (
        <DisplayShell
            title="核心设备与能力"
            subtitle="候选设备与器具 · 用途与已确认能力"
            current="equipment"
            onNavigate={onNavigate}
        >
            <div className="cc-page-head">
                <div>
                    <h2>核心设备与能力</h2>
                    <p>候选设备与器具清单，用于说明各自用途；能力项标注确认状态，未确认前不作为已交付能力宣传。</p>
                </div>
                <div className="cc-head-tags">
                    <span className="cc-tag-assume">候选清单 ≠ 已部署清单</span>
                    <span className="cc-tag-note">图片为示意图 · 非正式产品图</span>
                </div>
            </div>

            <div className="cc-equip-grid">
                {ITEMS.map((item) => (
                    <article className={item.category === '器具' ? 'cc-equip-card utility' : 'cc-equip-card'} key={item.id}>
                        <div className="cc-equip-head">
                            <span className={item.category === '器具' ? 'cc-equip-cat utility' : 'cc-equip-cat'}>
                                {item.category}
                            </span>
                            <b>{item.name}</b>
                        </div>
                        <div className="cc-equip-figure">
                            <DeviceGlyph kind={item.kind} className="cc-equip-glyph" />
                            <span>示意图</span>
                        </div>
                        <p className="cc-equip-purpose">{item.purpose}</p>
                        <ul className="cc-equip-caps">
                            {item.capabilities.map((capability) => (
                                <li key={capability.label}>
                                    <span className={capability.state === '已确认' ? 'cc-cap-state ok' : 'cc-cap-state pending'}>
                                        {capability.state}
                                    </span>
                                    <span className="cc-cap-label">
                                        {capability.label}
                                        {capability.note && <em>{capability.note}</em>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <dl className="cc-equip-meta">
                            <div>
                                <dt>型号</dt>
                                <dd>—</dd>
                            </div>
                            <div>
                                <dt>数量</dt>
                                <dd>—</dd>
                            </div>
                        </dl>
                    </article>
                ))}
            </div>

            <div className="cc-overview-notes">
                <div className="cc-note-card">
                    <b>称重能力 ≠ 可读取称重数据</b>
                    <p>「设备具有称重能力」是设备本体属性；「系统可读取称重数据」是数据接入能力。两者需分别确认，不能互相推导。</p>
                </div>
                <div className="cc-note-card">
                    <b>器具不默认联网</b>
                    <p>容器与层架按器具展示，不计入联网设备，也不展示在线率或运行状态。</p>
                </div>
                <div className="cc-note-card">
                    <b>型号与数量缺省</b>
                    <p>未确认时统一显示「—」，不填 0，也不推测数量。</p>
                </div>
                <div className="cc-note-card">
                    <b>视频为可选素材</b>
                    <p>有真实可用素材后再定义播放与暂停控制，不是首版必要条件。</p>
                </div>
            </div>
        </DisplayShell>
    );
}
