import React from 'react';
import './ExceptionReferenceView.css';

export type ExceptionState = 'no-data' | 'load-failed';

function StateIllustration({ state }: { state: ExceptionState }) {
  if (state === 'no-data') {
    return (
      <svg viewBox="0 0 160 160" role="img" aria-label="无数据示意图">
        <circle cx="80" cy="80" r="68" className="uk-exception-orbit" />
        <path d="M45 60h70l-6 55H51l-6-55Z" className="uk-exception-icon-box" />
        <path d="M58 75h44M62 89h36M67 103h26" className="uk-exception-icon-line" />
        <path d="m54 51 8-10h36l8 10" className="uk-exception-icon-accent" />
        <circle cx="117" cy="48" r="12" className="uk-exception-icon-dot" />
        <path d="M114 48h6" className="uk-exception-icon-dot-line" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 160" role="img" aria-label="加载失败示意图">
      <circle cx="80" cy="80" r="68" className="uk-exception-orbit" />
      <path d="M80 37 125 116H35l45-79Z" className="uk-exception-icon-warning" />
      <path d="M80 66v24" className="uk-exception-icon-warning-line" />
      <circle cx="80" cy="103" r="3.5" className="uk-exception-icon-warning-dot" />
    </svg>
  );
}

export function ModuleExceptionState({ state }: { state?: ExceptionState }) {
  if (!state) return null;
  const noData = state === 'no-data';
  return (
    <div className={`uk-module-exception-state is-${state}`} role="status">
      <StateIllustration state={state} />
      <div>
        <strong>{noData ? '暂无数据' : '加载失败'}</strong>
        <p>{noData ? '当前暂无可展示的数据' : '暂时无法获取数据，请稍后重试'}</p>
      </div>
    </div>
  );
}
