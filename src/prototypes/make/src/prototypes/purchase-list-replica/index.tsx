/**
 * @name 智能体
 * @mode axure
 *
 * 页面内容直接使用用户提供的 Axure HTML 导出物，确保视觉、页面树和交互保持源文件一致。
 */
import React, { useMemo, useState } from 'react';
import './style.css';

type DialogStep = 'idle' | 'batch' | 'confirm' | 'conflict' | 'custom' | 'success';

const defaultBatches = [
    '10:00–10:30',
    '10:30–11:00',
    '11:00–11:30',
];

export default function PurchaseListReplica() {
    const [step, setStep] = useState<DialogStep>('idle');
    const [batchMode, setBatchMode] = useState<'single' | 'three'>('single');
    const [mealTime, setMealTime] = useState('11:30');
    const [batchCount, setBatchCount] = useState('3');
    const [batchMinutes, setBatchMinutes] = useState('30');

    const customConflict = useMemo(() => {
        const count = Number(batchCount);
        const minutes = Number(batchMinutes);
        const [hour, minute] = mealTime.split(':').map(Number);
        const endMinutes = hour * 60 + minute;
        const calculatedEnd = 10 * 60 + count * minutes;

        if (!count || count < 1 || count > 3 || !minutes || minutes < 15 || minutes > 60) {
            return '批次数量最多支持 3 批，单批时长需在 15–60 分钟之间。';
        }
        if (!Number.isFinite(endMinutes) || calculatedEnd !== endMinutes) {
            return `批次时间与出餐时间冲突：按 ${count} 批 × ${minutes} 分钟计算，应在 ${String(Math.floor(calculatedEnd / 60)).padStart(2, '0')}:${String(calculatedEnd % 60).padStart(2, '0')} 出餐。`;
        }
        return '';
    }, [batchCount, batchMinutes, mealTime]);

    const startDefaultScheduling = () => {
        setStep(batchMode === 'single' ? 'conflict' : 'success');
    };

    const validateCustomBatches = () => {
        setStep(customConflict ? 'conflict' : 'success');
    };

    return (
        <div className="prototype-shell">
            <iframe
                className="axure-export-frame"
                title="智能体 Axure 原型"
                src="/prototypes/purchase-list-replica/axure/start_with_pages.html"
            />
            <section className="production-dialog" aria-label="智能排产语音交互预览">
                <div className="production-dialog__head">
                    <div>
                        <span className="production-dialog__eyebrow">语音生成菜单 · 对话预览</span>
                        <h1>智能排产</h1>
                    </div>
                    <span className={`production-dialog__status production-dialog__status--${step === 'success' ? 'ready' : 'waiting'}`}>
                        {step === 'success' ? '排产完成' : '等待确认'}
                    </span>
                </div>

                <div className="production-dialog__messages">
                    <div className="chat-bubble chat-bubble--assistant">
                        <strong>AI 助手</strong>
                        <p>我已读取当前菜单。是否进入智能排产？</p>
                        {step === 'idle' && (
                            <button className="primary-button" type="button" onClick={() => setStep('batch')}>
                                进入智能排产
                            </button>
                        )}
                    </div>

                    {step !== 'idle' && (
                        <div className="chat-bubble chat-bubble--user">
                            <strong>你</strong>
                            <p>进入智能排产</p>
                        </div>
                    )}

                    {(step === 'batch' || step === 'confirm') && (
                        <div className="chat-bubble chat-bubble--assistant">
                            <strong>AI 助手</strong>
                            <p>是否按默认批次自动排产？当前可选：</p>
                            <div className="choice-list">
                                <button className={`choice-card ${batchMode === 'single' ? 'is-selected' : ''}`} type="button" onClick={() => { setBatchMode('single'); setStep('confirm'); }}>
                                    <span>一次性排产</span><small>当前默认 · 1 个批次</small>
                                </button>
                                <button className={`choice-card ${batchMode === 'three' ? 'is-selected' : ''}`} type="button" onClick={() => { setBatchMode('three'); setStep('confirm'); }}>
                                    <span>分 3 批排产</span><small>{defaultBatches.join(' · ')}</small>
                                </button>
                            </div>
                            <button className="text-button" type="button" onClick={() => setStep('custom')}>不用默认批次，语音设置</button>
                        </div>
                    )}

                    {step === 'confirm' && (
                        <div className="chat-bubble chat-bubble--assistant chat-bubble--accent">
                            <strong>AI 助手</strong>
                            <p>已选择「{batchMode === 'single' ? '一次性排产' : '分 3 批排产'}」，要按默认规则直接开始排产吗？</p>
                            <button className="primary-button" type="button" onClick={startDefaultScheduling}>按默认规则开始排产</button>
                        </div>
                    )}

                    {step === 'custom' && (
                        <div className="chat-bubble chat-bubble--assistant">
                            <strong>AI 助手</strong>
                            <p>请告诉我出餐时间、出餐批次和每批批次时间，我会先做冲突校验。</p>
                            <div className="voice-form">
                                <label>出餐时间<input value={mealTime} onChange={(event) => setMealTime(event.target.value)} placeholder="11:30" /></label>
                                <label>出餐批次<input value={batchCount} onChange={(event) => setBatchCount(event.target.value)} inputMode="numeric" /></label>
                                <label>批次时间（分钟）<input value={batchMinutes} onChange={(event) => setBatchMinutes(event.target.value)} inputMode="numeric" /></label>
                            </div>
                            <button className="primary-button" type="button" onClick={validateCustomBatches}>校验批次设置</button>
                        </div>
                    )}

                    {step === 'conflict' && (
                        <div className="chat-bubble chat-bubble--assistant chat-bubble--warning">
                            <strong>AI 助手 · 发现冲突</strong>
                            <p>{customConflict || '当前菜单按一次性批次无法合理排产。是否需要 AI 进行批次设置，或者重新修改菜单？'}</p>
                            <p className="question-note">要不要用当前的批次设置去倒推菜单？</p>
                            <div className="action-row">
                                <button className="secondary-button" type="button" disabled>AI 批次设置（待定）</button>
                                <button className="secondary-button" type="button" onClick={() => setStep('custom')}>重新设置批次</button>
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="chat-bubble chat-bubble--assistant chat-bubble--success">
                            <strong>AI 助手 · 校验通过</strong>
                            <p>菜单支持当前批次设置，正在正常排产。</p>
                            <div className="batch-summary">
                                <span>出餐时间 <b>{batchMode === 'three' ? '11:30' : mealTime}</b></span>
                                <span>出餐批次 <b>{batchMode === 'three' ? '3 批' : `${batchCount} 批`}</b></span>
                            </div>
                            <button className="text-button" type="button" onClick={() => setStep('custom')}>人工修改批次后重新校验</button>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
