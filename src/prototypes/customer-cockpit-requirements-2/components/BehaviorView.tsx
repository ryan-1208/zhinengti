/**
 * 行为监控视图（驾驶舱内切换页）。
 *
 * 数据口径按 PRD 第 5 节与 AC06／AC07／AC08：
 * - 五类异常：未佩戴口罩、未佩戴帽子、发现老鼠、发现抽烟、发现人员；「发现人员」计入全部异常。
 * - 卡片展示事件类型、发生时间（相对＋绝对，均由时间戳计算）、区域／摄像头、抓拍图与异常标签。
 * - 相对时间不静态写死；缺图或加载失败时保留事件其他信息，页面仍可用。
 * - 演示数据显式标注，不伪装为实时直播；仅展示最近事件摘要。
 * - 周期筛选由 iPad 展示控制页操作，本页只读展示当前周期。
 */
import React, { useState } from 'react';
import { formatAbsolute, formatRelative, getMonitorData, MONITOR_CATEGORIES, type MonitorEvent } from './monitorDemo';
import { ModuleExceptionState, type ExceptionState } from './ExceptionReferenceView';

/** 抓拍图：缺图或加载失败时保留事件其他信息，页面不因此不可用。 */
function CaptureShot({ event }: { event: MonitorEvent }) {
  const [failed, setFailed] = useState(false);
  const missing = !event.image || failed;
  return (
    <div className="uk-mon-shot">
      {missing ? (
        <div className="uk-mon-shot-missing">
          <b>图片暂不可用</b>
        </div>
      ) : (
        <img src={event.image} alt={`${event.area} ${event.type}抓拍`} onError={() => setFailed(true)} />
      )}
      <small>{event.camera}</small>
      <i>{event.type}</i>
    </div>
  );
}

export function BehaviorView({ exceptionState }: { exceptionState?: ExceptionState }) {
  /** 周期切换属 iPad 控制页职责，本页只读展示当前周期（默认最近一天）。 */
  const data = getMonitorData('day');

  return (
    <main className="uk-monitor">
      <div className="uk-mon-head" data-annotation-id="behavior-summary">
        <div>
          <h2>行为监控 · 异常抓拍</h2>
        </div>
        <div className="uk-mon-tags">
          <span className="uk-mon-tag">统计周期：{exceptionState ? '状态参考' : data.periodTitle}</span>
        </div>
      </div>

      {/* ⚠️ uk-exception-summary-host 必须跟 uk-has-exception-state **一起**上，
          不能无条件挂着（2026-10-13 深夜修）：ExceptionReferenceView.css 里有一条
          `.uk-exception-summary-host > :not(.uk-module-exception-state){visibility:hidden !important}`
          —— 它本来是给"异常状态参考页"清空子元素用的，无条件挂上就等于**平时也把这排数字
          全部藏起来**。症状极具迷惑性：数字在 DOM 里、能被鼠标点到、无障碍也能读，
          只是画不出来，所以"看不到"但什么都查不出来（typecheck 干净、console 无报错）。
          同类问题 index.tsx 的出餐数字统计条（.uk-plan-kpis）也一起修了。 */}
      <div className={`uk-mon-stats${exceptionState ? ' uk-exception-summary-host uk-has-exception-state' : ''}`}>
        <div className="uk-mon-stat is-total">
          <b>{data.total}</b>
          <span>全部异常</span>
        </div>
        {MONITOR_CATEGORIES.map((category) => (
          <div className="uk-mon-stat" key={category}>
            <b>{data.counts[category]}</b>
            <span>{category}</span>
          </div>
        ))}
        <ModuleExceptionState state={exceptionState} />
      </div>

      <div className={`uk-mon-grid${exceptionState ? ' uk-has-exception-state' : ''}`} data-annotation-id="behavior-events">
        <ModuleExceptionState state={exceptionState} />
        {data.events.map((event) => (
          <article className="uk-mon-card" key={event.id}>
            <header className="uk-mon-card-head">
              <b>{event.type}</b>
              <span>
                {formatRelative(event.time)} · {formatAbsolute(event.time)}
              </span>
            </header>
            <CaptureShot event={event} />
            <div className="uk-mon-card-meta">
              <span>{event.area}</span>
              <span>{event.id}</span>
            </div>
          </article>
        ))}
      </div>

      {!exceptionState && <div className="uk-mon-foot">
        <span>最近更新 {data.updatedAt}</span>
      </div>}
    </main>
  );
}
