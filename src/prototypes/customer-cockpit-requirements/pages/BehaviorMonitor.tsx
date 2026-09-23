/**
 * 行为监控。
 *
 * PRD 要点：
 * - 复用截图核心结构：项目标识、异常分类统计、抓拍卡片网格。
 * - 五类异常：未佩戴口罩、未佩戴帽子、发现老鼠、发现抽烟、发现人员；“发现人员”计入全部异常。
 * - 卡片展示事件类型、发生时间、区域／摄像头、抓拍图与异常标签，按发生时间倒序。
 * - 相对时间与绝对时间一致，由时间戳计算。
 * - 缺图、加载失败、空数据与未接入时页面仍可用；缺失不等于零。
 * - 演示数据显式标注。
 * - 周期筛选为建议功能，由 iPad 控制页操作，本页只读展示当前周期。
 */
import React, { useState } from 'react';
import { DisplayShell } from '../components/DisplayShell';
import { MONITOR_PERIODS, MONITOR_STATES } from '../components/displaySync';
import {
    formatAbsolute,
    formatRelative,
    getMonitorData,
    MONITOR_CATEGORIES,
} from '../components/monitorDemo';

/** 抓拍图：缺图或加载失败时保留事件其他信息，页面不因此不可用。 */
function CaptureShot({ image, alt, camera, type }: { image?: string; alt: string; camera: string; type: string }) {
    const [failed, setFailed] = useState(false);
    const missing = !image || failed;
    return (
        <div className="cc-mo-shot">
            {missing ? (
                <div className="cc-mo-shot-missing">
                    <b>图片暂不可用</b>
                    <span>{image ? '抓拍图加载失败，已保留事件其他信息' : '该事件未返回抓拍图，已保留事件其他信息'}</span>
                </div>
            ) : (
                <img src={image} alt={alt} onError={() => setFailed(true)} />
            )}
            <small>{camera}</small>
            <i>{type}</i>
        </div>
    );
}

/** 模块级状态提示：仅替换本模块内容，不阻塞其他页面切换。 */
function StateBlock({ title, desc, tone }: { title: string; desc: string; tone: 'info' | 'muted' }) {
    return (
        <div className={tone === 'info' ? 'cc-mo-state info' : 'cc-mo-state'}>
            <b>{title}</b>
            <span>{desc}</span>
        </div>
    );
}

export function BehaviorMonitor({
    period,
    monitorState,
    onNavigate,
}: {
    period: string;
    monitorState: string;
    onNavigate: (id: string) => void;
}) {
    const data = getMonitorData(period);
    const periodTitle = MONITOR_PERIODS.find((item) => item.id === data.periodId)?.title ?? '最近一天';
    const state = monitorState;
    const stateTitle = MONITOR_STATES.find((item) => item.id === state)?.title;
    /** failed 表示获取失败但保留缓存，仍展示缓存内容 */
    const showContent = state === 'ready' || state === 'failed';

    return (
        <DisplayShell
            title="行为监控"
            subtitle="异常分类统计 · 抓拍事件记录"
            current="behavior"
            onNavigate={onNavigate}
            showCockpitNav
            showBottomNav={false}
        >
            <div className="cc-page-head">
                <div>
                    <h2>行为监控 · 异常抓拍</h2>
                    <p>按异常类别汇总统计，并展示最近抓拍事件；展示最近事件摘要，不展示全部历史。</p>
                </div>
                <div className="cc-head-tags">
                    <span className="cc-tag-assume">演示数据 · 去重口径待确认</span>
                    <span className="cc-tag-note">统计周期：{periodTitle}</span>
                    {state !== 'ready' && <span className="cc-tag-note">数据状态：{stateTitle}</span>}
                </div>
            </div>

            {state === 'loading' && (
                <StateBlock
                    tone="info"
                    title="监控数据加载中…"
                    desc="加载提示仅出现在本模块内，不阻塞其他页面切换；统计与卡片待数据返回后更新。"
                />
            )}

            {state === 'empty' && (
                <StateBlock
                    tone="muted"
                    title="所选时段暂无异常记录"
                    desc={`统计周期：${periodTitle}。无事件时各分类不填充零值，也不以其他时段数据替代。`}
                />
            )}

            {state === 'offline' && (
                <StateBlock
                    tone="muted"
                    title="监控数据暂未接入"
                    desc="当前未接入监控数据源。如需评审展示结构，可在 iPad 展示控制页的演示开关中切换为「正常展示」。"
                />
            )}

            {state === 'failed' && (
                <div className="cc-mo-banner">
                    监控数据获取失败，以下为缓存内容，更新时间 {data.updatedAt}。
                </div>
            )}

            {showContent && (
                <>
                    <div className="cc-mo-stats">
                        <div className="cc-mo-stat total">
                            <b>{data.total}</b>
                            <span>全部异常</span>
                            <em>含“发现人员”</em>
                        </div>
                        {MONITOR_CATEGORIES.map((category) => (
                            <div className="cc-mo-stat" key={category}>
                                <b>{data.counts[category]}</b>
                                <span>{category}</span>
                                <em>周期内计数</em>
                            </div>
                        ))}
                    </div>

                    <div className="cc-mo-toolbar">
                        <span className="cc-mo-scope">{data.scopeNote}</span>
                        <span className="cc-mo-scope">去重方式与多标签归类方式待监控方确认；缺失不等于零。</span>
                        <span className="cc-mo-scope right">周期切换请使用 iPad 展示控制页</span>
                    </div>

                    <div className="cc-mo-grid">
                        {data.events.map((event) => (
                            <article className="cc-mo-card" key={event.id}>
                                <header className="cc-mo-card-head">
                                    <b>{event.type}</b>
                                    <span>
                                        {formatRelative(event.time)}
                                        <br />
                                        {formatAbsolute(event.time)}
                                    </span>
                                </header>
                                <CaptureShot
                                    image={event.image}
                                    alt={`${event.area} ${event.type}抓拍`}
                                    camera={event.camera}
                                    type={event.type}
                                />
                                <div className="cc-mo-card-meta">
                                    <span>{event.area}</span>
                                    <span>{event.id}</span>
                                </div>
                            </article>
                        ))}
                    </div>

                    <div className="cc-mo-foot">
                        <span>固定演示数据 · 最近更新 {data.updatedAt}</span>
                        <span>含 1 条缺图事件，用于演示缺失态 · 抓拍图仅为结构示意</span>
                    </div>
                </>
            )}
        </DisplayShell>
    );
}
