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

export function BehaviorView() {
  /** 周期切换属 iPad 控制页职责，本页只读展示当前周期（默认最近一天）。 */
  const data = getMonitorData('day');

  return (
    <main className="uk-monitor">
      <div className="uk-mon-head">
        <div>
          <h2>行为监控 · 异常抓拍</h2>
        </div>
        <div className="uk-mon-tags">
          <span className="uk-mon-tag">统计周期：{data.periodTitle}</span>
        </div>
      </div>

      <div className="uk-mon-stats">
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
      </div>

      <div className="uk-mon-grid">
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

      <div className="uk-mon-foot">
        <span>最近更新 {data.updatedAt}</span>
      </div>
    </main>
  );
}
