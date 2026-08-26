import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Mic } from 'lucide-react';
import { defineHashPageRoute, useHashPage } from '../../common/useHashPage';
import './style.css';
import { AnnotationViewer, type AnnotationSourceDocument } from '@axhub/annotation';
import annotationSourceDocument from './annotation-source.json';
import VersionManagementPage from '../untitled-3/index';
import FlowchartPage from '../untitled-5/index';
import SemanticParsingPage from '../untitled-6/index';
import brandMark from './assets/brand-mark.png';
import assistantChef from './assets/assistant-chef.png';
import schedulingFrame from './assets/scheduling-frame.png';
import { RequirementOverviewDrawer } from './components/RequirementOverviewDrawer';

type Page = 'version' | 'flow' | 'semantic' | 'menu' | 'assistant-menu' | 'assistant-menu-no-meal' | 'assistant-menu-flow' | 'assistant-menu-failure' | 'view-menu' | 'schedule' | 'assistant-schedule' | 'assistant-schedule-no-menu' | 'purchase' | 'list' | 'confirm' | 'success' | 'failure' | 'blank-1' | 'work-order-detail' | 'blank-2' | 'blank-3' | 'blank-4' | 'blank-5' | 'backup-assistant-menu' | 'backup-assistant-menu-flow' | 'backup-assistant-schedule';
type PlanDayStatus = 'started' | 'generated' | 'existing';
type MenuGenerationResult = { status: 'success'; totalCookingMinutes: number; cookingTimeLimit: number } | { status: 'empty'; filters: string[] } | { status: 'insufficient'; shortages: Partial<Record<'大荤' | '小荤' | '素菜', number>> };
function getMenuGenerationResult(matchingDishes: number, required: Record<'大荤' | '小荤' | '素菜', number>, available: Record<'大荤' | '小荤' | '素菜', number>, filters: string[], cookingTimes: number[], cookingTimeLimit: number): MenuGenerationResult {
  if (matchingDishes === 0) return { status: 'empty', filters };
  const shortages = (Object.keys(required) as Array<'大荤' | '小荤' | '素菜'>).reduce<Partial<Record<'大荤' | '小荤' | '素菜', number>>>((result, category) => {
    if (available[category] < required[category]) result[category] = required[category] - available[category];
    return result;
  }, {});
  const totalCookingMinutes = cookingTimes.reduce((total, minutes) => total + minutes, 0);
  if (totalCookingMinutes > cookingTimeLimit) return { status: 'empty', filters: [...filters, '烹饪总时长'] };
  return Object.keys(shortages).length > 0 ? { status: 'insufficient', shortages } : { status: 'success', totalCookingMinutes, cookingTimeLimit };
}
const pageRoute = defineHashPageRoute([
  { id: 'version', title: '版本管理' },
  { id: 'flow', title: '流程图' },
  { id: 'semantic', title: '语义解析' },
  { id: 'menu', title: '每周菜单', group: '菜单' },
  { id: 'assistant-menu', title: '语音生成菜单', group: '菜单' },
  { id: 'assistant-menu-no-meal', title: '语音生成菜单-无餐段', group: '菜单' },
  { id: 'assistant-menu-flow', title: '语音生成菜单-流程中', group: '菜单' },
  { id: 'assistant-menu-failure', title: '语音生成菜单-失败', group: '菜单' },
  { id: 'view-menu', title: '查看菜单', group: '菜单' },
  { id: 'schedule', title: '智能排产 -分批', group: '排产' },
  { id: 'assistant-schedule', title: '语音排产', group: '排产' },
  { id: 'assistant-schedule-no-menu', title: '语音排产-无菜单', group: '排产' },
  { id: 'purchase', title: '订单采购', group: '采购' },
  { id: 'list', title: '采购清单', group: '采购' },
  { id: 'confirm', title: '确认下单', group: '采购' },
  { id: 'success', title: '下单成功', group: '采购' },
  { id: 'failure', title: '下单失败', group: '采购' },
  { id: 'blank-1', title: '生产工单列表', group: '需要增加批次字段的页面' },
  { id: 'work-order-detail', title: '工单详情', group: '需要增加批次字段的页面' },
  { id: 'blank-2', title: '称重加料屏', group: '需要增加批次字段的页面' },
  { id: 'blank-3', title: '备餐屏', group: '需要增加批次字段的页面' },
  { id: 'blank-4', title: '轻量总控屏', group: '需要增加批次字段的页面' },
  { id: 'blank-5', title: '排产后台-每周菜单', group: '需要增加批次字段的页面' },
  { id: 'backup-assistant-menu', title: '语音生成菜单', group: '备用页' },
  { id: 'backup-assistant-menu-flow', title: '语音生成菜单流程中', group: '备用页' },
  { id: 'backup-assistant-schedule', title: '语音排产', group: '备用页' },
], { defaultPageId: 'assistant-menu' });
const weekData = [['本周', '07/13~07/19'], ['下周', '07/20~07/26'], ['第三周', '07/27~08/02'], ['第四周', '08/03~08/09']];
const days = [['周一', '07/13'], ['周二', '07/14'], ['周三', '07/15'], ['周四', '07/16'], ['周五', '07/17'], ['周六', '07/18'], ['周日', '07/19']];
const scheduleWeekData = [['本周', '08/03~08/09'], ['下周', '08/10~08/16'], ['第三周', '08/17~08/23'], ['第四周', '08/24~08/30']];
const scheduleDays = [['周一', '08/03'], ['周二', '08/04'], ['周三', '08/05'], ['周四', '08/06'], ['周五', '08/07'], ['周六', '08/08'], ['周日', '08/09']];
const lunch = ['毛豆雪菜肉丝', '外婆菜炒蛋', '千叶回锅肉', '小炒黄牛肉', '韭菜绿豆芽', '蒜蓉菠菜', '红烧带鱼', '葱油鸡', '百叶结烧肉', '蚝油牛柳'];
const dinner = ['土豆炖牛腩', '香炸翅根', '梅菜扣肉', '西葫芦炒肉片', '番茄炒蛋', '芹菜肉丝', '清炒冬瓜', '手撕包菜'];
const ingredients = ['姜', '带鱼', '红烧汁', '五花肉', '百叶结', '青椒', '洋葱', '牛肉', '蚝油', '三黄鸡', '千叶豆腐', '精肉片', '红椒', '肉丝', '毛豆米'];
const orderItems = ['五花肉', '牛肉', '三黄鸡', '精肉片', '肉丝', '牛肉片', '百叶结', '青椒', '洋葱', '千叶豆腐', '毛豆米', '雪菜', '外婆菜', '线椒', '芹菜', '绿豆芽', '韭菜', '菠菜', '红烧汁'];

function Header({ page, go }: { page: Page; go: (page: Page) => void }) {
  const active = page === 'menu' || page === 'assistant-menu' || page === 'assistant-menu-no-meal' || page === 'assistant-menu-flow' || page === 'assistant-menu-failure' || page === 'backup-assistant-menu' || page === 'backup-assistant-menu-flow' || page === 'view-menu' ? '每周菜单' : page === 'schedule' || page === 'assistant-schedule' || page === 'assistant-schedule-no-menu' || page === 'backup-assistant-schedule' ? '排产计划' : '采购清单';
  return <header className="topbar"><img className="brand-mark-image" src={brandMark} alt="熙香" /><div className="brand-name">备餐屏</div><nav>{[['每周菜单', 'menu'], ['排产计划', 'schedule'], ['采购清单', 'purchase']].map(([label, target]) => <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => go(target as Page)}>{label}</button>)}</nav></header>;
}

function PrototypeSidebar({ page, go, collapsed, onToggle }: { page: Page; go: (page: Page) => void; collapsed: boolean; onToggle: () => void }) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ 菜单: true, 排产: true, 采购: true, 需要增加批次字段的页面: true, 备用页: true });
  const [blank1Expanded, setBlank1Expanded] = useState(true);
  const groups: Array<{ label: string; pages: Array<[string, Page]> }> = [
    { label: '菜单', pages: [['每周菜单', 'menu'], ['语音生成菜单', 'assistant-menu'], ['语音生成菜单-无餐段', 'assistant-menu-no-meal'], ['语音生成菜单-流程中', 'assistant-menu-flow'], ['语音生成菜单-失败', 'assistant-menu-failure'], ['查看菜单', 'view-menu']] },
    { label: '排产', pages: [['智能排产 -分批', 'schedule'], ['语音排产', 'assistant-schedule'], ['语音排产-无菜单', 'assistant-schedule-no-menu']] },
    { label: '采购', pages: [['订单采购', 'purchase'], ['采购清单', 'list'], ['确认下单', 'confirm'], ['下单成功', 'success'], ['下单失败', 'failure']] },
    { label: '需要增加批次字段的页面', pages: [['生产工单列表', 'blank-1'], ['称重加料屏', 'blank-2'], ['备餐屏', 'blank-3'], ['轻量总控屏', 'blank-4'], ['排产后台-每周菜单', 'blank-5']] },
    { label: '备用页', pages: [['语音生成菜单', 'backup-assistant-menu'], ['语音生成菜单流程中', 'backup-assistant-menu-flow'], ['语音排产', 'backup-assistant-schedule']] },
  ];
  const topPages: Array<[string, Page]> = [['版本管理', 'version'], ['流程图', 'flow'], ['语义解析', 'semantic']];
  return <aside className="prototype-sidebar" aria-label="智能体页面导航"><button type="button" className="sidebar-toggle" onClick={onToggle} aria-label={collapsed ? '展开导航栏' : '收起导航栏'}>{collapsed ? '›' : '‹'}</button><div className="prototype-nav-inner"><div className="prototype-nav-top">{topPages.map(([label, target]) => <button key={target} className={page === target ? 'prototype-nav-link active' : 'prototype-nav-link'} onClick={() => go(target)}><i />{label}</button>)}</div><div className={isPlainPage(page) ? 'prototype-sidebar-title' : 'prototype-sidebar-title active'}>智能体</div>{groups.map((group) => <section className="prototype-nav-group" key={group.label}><button type="button" className="prototype-nav-group-title" onClick={() => setExpandedGroups((current) => ({ ...current, [group.label]: !current[group.label] }))}><span>{expandedGroups[group.label] ? '⌄' : '›'}</span>{group.label}</button>{expandedGroups[group.label] && group.pages.map(([label, target]) => target === 'blank-1' ? <React.Fragment key={target}><div className="prototype-nav-parent"><button className={page === target ? 'prototype-nav-link active' : 'prototype-nav-link'} onClick={() => go(target)}><i />{label}</button><button type="button" className="prototype-nav-child-toggle" aria-label={blank1Expanded ? '收起生产工单列表子页面' : '展开生产工单列表子页面'} onClick={() => setBlank1Expanded((value) => !value)}>{blank1Expanded ? '⌄' : '›'}</button></div>{blank1Expanded && <button className={page === 'work-order-detail' ? 'prototype-nav-link prototype-nav-child active' : 'prototype-nav-link prototype-nav-child'} onClick={() => go('work-order-detail')}><i />工单详情</button>}</React.Fragment> : target === 'work-order-detail' ? null : <button key={target} className={page === target ? 'prototype-nav-link active' : 'prototype-nav-link'} onClick={() => go(target)}><i />{label}</button>)}</section>)}</div></aside>;
}

function isPlainPage(page: Page) { return page === 'version' || page === 'flow' || page === 'semantic'; }

function Shell({ page, go, children }: { page: Page; go: (page: Page) => void; children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const shellClass = `app-shell${isPlainPage(page) ? ' plain-app-shell' : ''}${sidebarCollapsed ? ' sidebar-collapsed' : ''}`;
  if (page === 'blank-2' || page === 'blank-3' || page === 'blank-4' || page === 'blank-5') {
    const contentClass = page === 'blank-2' ? 'weighing-app-shell' : page === 'blank-3' ? 'dashboard-app-shell' : page === 'blank-4' ? 'mobile-app-shell' : 'ai-menu-app-shell';
    return <main className={`special-page-app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}><PrototypeSidebar page={page} go={go} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} /><div className={contentClass}>{children}</div></main>;
  }
  if (page === 'blank-1' || page === 'work-order-detail') return <main className={`orders-tree-app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}><PrototypeSidebar page={page} go={go} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} /><div className="orders-app-shell">{children}</div></main>;
  if (page === 'assistant-schedule-no-menu') return <main className={shellClass}><PrototypeSidebar page={page} go={go} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} /><div className="canvas"><Header page={page} go={go} /><div className="screen-frame"><img src={schedulingFrame} alt="" /><div className="screen-content"><AssistantPage key="assistant-schedule-no-menu" type="schedule" noMenu go={go} /></div></div></div></main>;
  if (isPlainPage(page)) return <main className={shellClass}><PrototypeSidebar page={page} go={go} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} /><div className="plain-page-canvas">{children}</div></main>;
  return <main className={shellClass}><PrototypeSidebar page={page} go={go} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} /><div className="canvas"><Header page={page} go={go} /><div className="screen-frame"><img src={schedulingFrame} alt="" /><div className="screen-content">{children}</div></div></div></main>;
}

function PlainPage({ page }: { page: 'version' | 'flow' | 'semantic' }) {
  if (page === 'version') return <VersionManagementPage />;
  if (page === 'flow') return <FlowchartPage />;
  return <SemanticParsingPage />;
}

function WeekTabs({ active, setActive, items = weekData }: { active: number; setActive: (index: number) => void; items?: string[][] }) { return <div className="week-tabs">{items.map(([name, range], index) => <button key={name} className={active === index ? 'period active' : 'period'} onClick={() => setActive(index)}><strong>{name}</strong><span>{range}</span></button>)}</div>; }

function MenuPage({ go }: { go: (page: Page) => void }) {
  const [week, setWeek] = useState(0);
  return <><div className="menu-head"><div></div><button className="wake-card" onClick={() => go('assistant-menu')}><span className="wake-orb"><Mic size={25} /></span><span>说“生成菜单”<br /><strong>唤醒我</strong></span></button></div><WeekTabs active={week} setActive={setWeek} /><div className="menu-grid"><div className="menu-corner">餐段</div>{days.map(([name, date]) => <div className="menu-day" key={date}>{name}<small>{date}</small></div>)}<div className="meal-side">午餐</div>{days.map(([_, date], index) => <button key={`l${date}`} className={index < 3 ? 'menu-cell ready' : 'menu-cell add'} onClick={index < 3 ? () => go('view-menu') : undefined}>{index < 3 ? <>已有菜单<small>10</small></> : '添加菜单'}</button>)}<div className="meal-side">晚餐</div>{days.map(([_, date], index) => <button key={`d${date}`} className={index < 3 ? 'menu-cell ready' : 'menu-cell add'} onClick={index < 3 ? () => go('view-menu') : undefined}>{index < 3 ? <>已有菜单<small>8</small></> : '添加菜单'}</button>)}</div></>;
}

function AssistantPage({ type, noMeal = false, noMenu = false, flow = false, staticDisplay = false, go }: { type: 'menu' | 'schedule'; noMeal?: boolean; noMenu?: boolean; flow?: boolean; staticDisplay?: boolean; go: (page: Page) => void }) {
  const [listening, setListening] = useState(false);
  const [messageIndex, setMessageIndex] = useState(staticDisplay ? Number.MAX_SAFE_INTEGER : 0);
  const [postSuccessIndex, setPostSuccessIndex] = useState(0);
  const [showPlanConfirm, setShowPlanConfirm] = useState(false);
  const [showMenuChoice, setShowMenuChoice] = useState(false);
  const [showScheduleConfirm, setShowScheduleConfirm] = useState(false);
  const [coverExisting, setCoverExisting] = useState<boolean | null>(null);
  const [planScope, setPlanScope] = useState<'single' | 'range'>('single');
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({ '2026年8月3日': true, '2026年8月4日': true });
  const [menuExpanded, setMenuExpanded] = useState(false);
  const schedule = type === 'schedule';
  const menuGenerationResult = getMenuGenerationResult(18, { '大荤': 4, '小荤': 4, '素菜': 2 }, { '大荤': 4, '小荤': 4, '素菜': 2 }, ['菜系', '口味', '烹饪设备'], [4, 3, 4, 3, 3, 3, 4, 3, 4, 3, 3, 3, 3, 2, 3, 3, 3, 2], 60);
  const dialogue = schedule ? [
    { role: 'user', text: '智能排产' },
    { role: 'assistant', text: '我可以帮您生成排产计划，您有什么要求都可以跟我说。', hint: '提示：生成条件包括排产周期、餐段、批次、餐品数量、餐品名称。' },
    { role: 'user', text: '帮我继续8月 3 号到 4 号进行排产' },
    { role: 'assistant', text: '请分别说出需要排产日期中餐段、各个批次的餐品数量及名称', hint: '当前菜单：\n8月3日午餐：毛豆雪菜肉丝、外婆菜炒蛋、红烧带鱼、清炒上海青、香煎鸡腿、鱼香肉丝、蒜蓉西兰花、土豆炖牛腩、番茄炒蛋、干锅花菜、梅菜扣肉、青椒肉丝、清蒸鲈鱼、蚝油生菜、宫保鸡丁、蒜苔炒肉、糖醋排骨、香菇青菜、葱油鸡、肉末茄子、水煮鱼片、白灼菜心、回锅肉、西芹炒虾仁、红烧茄子、小炒黄牛肉、清炒莴笋、香辣鸡翅、冬瓜烧肉、干煸四季豆、豆豉蒸排骨、芹菜香干、醋溜土豆丝、酸菜鱼、蒜香南瓜、木须肉、红烧鸡块、清炒豆芽、香酥鱼排、上汤娃娃菜、葱爆羊肉、家常豆腐、清蒸鸡蛋、口水鸡、素炒三丝、豆角炒肉末、红油藕片、土豆烧鸡、蒜蓉菠菜、紫菜蛋汤。\n8月4日午餐：黑椒牛柳、香辣虾、酱香排骨、清炒油麦菜、蚝油杏鲍菇、麻婆豆腐、豉汁蒸鱼、青笋炒肉片、香煎秋刀鱼、蒜苗回锅肉、红烧狮子头、干锅土豆片、西红柿炖牛腩、清炒芥蓝、椒盐鸡块、肉末粉丝、香菇滑鸡、芥末虾球、三杯鸡、酸辣汤、腊味合蒸、蒜蓉粉丝蒸扇贝、芙蓉蒸蛋、酸豆角炒肉末、清炒菜花、京酱肉丝、椒盐排条、香醋藕片、鱼香茄子、香干炒芹菜、红烧冬瓜、豆豉鲮鱼油麦菜、咖喱鸡块、葱香牛肉、清蒸南瓜、青椒炒蛋、干煸鳝段、白菜炖豆腐、酱爆鸡丁、蒜蓉粉丝蒸娃娃菜、香辣花甲、酱烧鸭块、糖醋里脊、清炒荷兰豆、咸蛋黄焗南瓜、豆腐皮炒肉、豆豉蒸凤爪、酸辣土豆丝、菌菇炒鸡蛋、莲藕排骨汤。' },
    { role: 'user', text: '8月3日，午餐，批次1，2 个菜：毛豆雪菜肉丝、外婆菜炒蛋；批次2，1 个菜：红烧带鱼。8月4日·午餐：批次1，2 个菜：小炒黄牛肉、韭菜绿豆芽；批次2,2个菜：蒜蓉菠菜、葱油鸡。' },
    { role: 'assistant', text: '已预生成排产计划，请查看确认' },
  ] : flow ? [
    { role: 'user', text: '生成菜单' },
    { role: 'assistant', text: '我可以帮您自动生成菜单，您有什么要求都可以跟我说。', hint: '提示：生成条件包括时间周期、餐段、餐品数量、大荤小荤蔬菜比例、菜系、口味、烹饪设备、就餐人数、烹饪时限、设备比例、菜单偏好。' },
    { role: 'user', text: '请帮我生成明天的菜单，午餐 10 个菜，500 人用餐，晚餐 8 个菜，200 人用餐，大荤、小荤、蔬菜的比例是 2 比 2 比 1' },
    { role: 'assistant', text: '好的，请问需要生成多少时间内的菜单？' },
    { role: 'user', text: '烹饪总时长不超过 60 分钟' },
    { role: 'assistant', text: '请问使用炒菜机和烤箱的餐品比例分别是多少？' },
    { role: 'user', text: '午餐 10 个菜' },
    { role: 'assistant', text: '当前菜单生成流程尚未完成，请确认是继续还是开启新对话' },
    { role: 'user', text: '新对话' },
    { role: 'assistant', text: '我可以帮您自动生成菜单，您有什么要求都可以跟我说。' },
  ] : [
    ...(noMeal ? [] : [{ role: 'assistant', text: '请问您是需要生成菜单还是智能排产？' }]),
    { role: 'user', text: '生成菜单' },
    { role: 'assistant', text: '我可以帮您自动生成菜单，您有什么要求都可以跟我说。', hint: '提示：生成条件包括时间周期、餐段、餐品数量、大荤小荤蔬菜比例、菜系、口味、烹饪设备、就餐人数、烹饪时限、设备比例、菜单偏好。' },
    { role: 'user', text: '请帮我生成明天的菜单，午餐 10 个菜，500 人用餐，晚餐 8 个菜，200 人用餐，大荤、小荤、蔬菜的比例是 2 比 2 比 1' },
    { role: 'assistant', text: '好的，请问需要生成多少时间内的菜单？' },
    { role: 'user', text: '烹饪总时长不超过 60 分钟' },
    { role: 'assistant', text: '请问使用炒菜机和烤箱的餐品比例分别是多少？' },
    { role: 'user', text: '炒菜机与烤箱的比例是 3 比 1' },
    { role: 'assistant', text: '好的，正在为您生成菜单，请稍后' },
  ];
  const noMenuMenuHint = noMenu && schedule && 'hint' in dialogue[3] ? dialogue[3].hint : '';
  const noMenuAug4Hint = typeof noMenuMenuHint === 'string' && noMenuMenuHint.includes('\n8月4日午餐：')
    ? `当前菜单：\n8月4日午餐：${noMenuMenuHint.split('\n8月4日午餐：')[1]}`
    : noMenuMenuHint;
  if (noMenu && schedule && 'hint' in dialogue[3]) dialogue[3].hint = '';
  if (noMenu && schedule) { dialogue.splice(4, 2); dialogue.push({ role: 'user', text: '继续' }, { role: 'assistant', text: '请分别说出需要排产日期中餐段、各个批次的餐品数量及名称', hint: noMenuAug4Hint }); }
  const displayMessageIndex = staticDisplay ? dialogue.length : messageIndex;
  const started = displayMessageIndex > 0;
  const advance = () => {
    if (!schedule && !noMeal && !flow && displayMessageIndex >= dialogue.length) {
      setPostSuccessIndex((index) => Math.min(index + 1, postSuccessDialogue.length));
      return;
    }
    if (displayMessageIndex >= dialogue.length) return;
    setListening(messageIndex === 0);
    window.setTimeout(() => {
      setMessageIndex((index) => Math.min(index + 1, dialogue.length));
      setListening(false);
    }, 180);
  };
  const planDays = [['2026年8月3日', '午餐、晚餐', '200人 / 180人'], ['2026年8月4日', '午餐', '200人']];
  const closeModal = () => { setShowPlanConfirm(false); setShowMenuChoice(false); setShowScheduleConfirm(false); setSaved(false); setSubmitted(false); setCoverExisting(null); };
  const dayStatus = (date: string): PlanDayStatus => date === '2026年8月3日' ? 'generated' : 'existing';
  const statusLabel: Record<PlanDayStatus, string> = { started: '计划已经开始，无法生成', generated: '排产已正常预生成', existing: '当前已有排产计划，请确认是否覆盖' };
  const detailDishes = [['黑椒牛仔粒', '3盆', '早餐', '红', '炒菜机', '翻炒', '180℃ · 12分钟'], ['香酥鱼排', '2盆', '早餐', '红', '烤箱', '烘烤', '200℃ · 18分钟'], ['地三鲜', '1盆', '午餐', '黄', '炒菜机', '翻炒', '175℃ · 10分钟'], ['香菇菜心', '2盆', '午餐', '绿', '炒菜机', '翻炒', '165℃ · 8分钟'], ['酸辣藕丁', '3盆', '晚餐', '黄', '炒菜机', '翻炒', '170℃ · 9分钟'], ['番茄炒蛋', '2盆', '晚餐', '绿', '炒菜机', '翻炒', '160℃ · 7分钟']];
  const detailDishPortions = ['20份/盆', '30份/盆', '20份/盆', '20份/盆', '10份/盆', '5kg/盆'];
  const menuResultMessage = menuGenerationResult.status === 'empty'
    ? `没有符合条件的餐品。造成该结果的条件：【${menuGenerationResult.filters.join('、')}】`
    : menuGenerationResult.status === 'insufficient'
      ? `符合条件的餐品不足，${(['大荤', '小荤', '素菜'] as const).filter((category) => menuGenerationResult.shortages[category]).map((category) => `缺少${category} ${menuGenerationResult.shortages[category]} 份`).join('，')}`
      : '已为您生成菜单，请前往查看';
  const postSuccessDialogue = [
    { role: 'user', text: '午餐10 个菜' },
    { role: 'assistant', text: '当前菜单已经生成成功，需否需要生成新菜单' },
    { role: 'user', text: '生成新菜单' },
    { role: 'assistant', text: '我可以帮您自动生成菜单，您有什么要求都可以跟我说' },
  ];
  return <>
    <div className={`assistant-page${noMenu ? ' no-menu-assistant-page' : ''}`} onClick={staticDisplay ? undefined : advance}>
      {started && <div className="conversation">
        {dialogue.slice(0, displayMessageIndex).map((message, index) => ({ message, index })).filter(({ index }) => !(!schedule && !noMeal && !flow && index === 0) && !(noMeal && [4, 5, 6, 7, 8].includes(index))).map(({ message, index }) => { const hasLongMenuHint = schedule && typeof message.hint === 'string' && message.hint.includes('当前菜单'); return <div className={`${message.role}-message${schedule && index === 3 ? ' schedule-menu-question' : ''}${schedule && index === 4 ? ' schedule-batch-question' : ''}${schedule && index === 5 ? ' schedule-batch-details-response' : ''}${!schedule && index === 4 ? ' assistant-menu-time-limit-question' : ''}${!schedule && !flow && index === 6 ? ' assistant-device-ratio-question' : ''}${schedule && index === dialogue.length - 1 ? ' schedule-confirm-trigger' : ''}`} data-annotation-id={schedule && index === 2 ? 'annotation-38' : schedule && index === 3 ? 'annotation-30' : !schedule && !flow && index === 6 ? 'annotation-27' : schedule && index === dialogue.length - 1 ? 'annotation-29' : undefined} key={`${message.text}-${index}`} onClick={(event) => { event.stopPropagation(); if (schedule && index === dialogue.length - 1) setShowScheduleConfirm(true); }}><span className="message-avatar">{message.role === 'assistant' ? <img src={assistantChef} alt="小熙" /> : '我'}</span><span className="message-text">{noMenu && schedule && index === 3 ? '当前 8月 3日缺少菜单，点击按钮生成菜单或者说继续，去除缺少菜单的日期继续排产？' : message.text}{'hint' in message && (hasLongMenuHint ? <span className={`assistant-message-hint schedule-menu-hint${menuExpanded ? ' expanded' : ''}`}><span>{message.hint}</span>{!noMenu && <button type="button" onClick={(event) => { event.stopPropagation(); setMenuExpanded((expanded) => !expanded); }}>{menuExpanded ? '收起内容' : '展开全部'}</button>}</span> : <span className="assistant-message-hint">{message.hint}</span>)}{noMenu && schedule && index === 3 && <button className="primary-link schedule-no-menu-inline-action" onClick={(event) => { event.stopPropagation(); go('assistant-menu'); }}>点击进入生成菜单</button>}</span></div>; })}
        {schedule && !noMenu && displayMessageIndex === dialogue.length && <div className="schedule-success-dialog schedule-plan-dialog" onClick={(event) => event.stopPropagation()}><div className="menu-success-message"><span className="message-avatar"><img src={assistantChef} alt="小熙" /></span><span className="message-text">已成功生成排产计划</span></div><button className="primary-link" onClick={() => go('schedule')}>前往查看排产计划</button></div>}
        {!schedule && !flow && displayMessageIndex === dialogue.length && <div className="schedule-success-dialog menu-success-dialog" onClick={(event) => event.stopPropagation()}><div className="menu-success-message"><span className="message-avatar"><img src={assistantChef} alt="小熙" /></span><span className="message-text">{noMeal ? '当前所需排产日期中X月X日、X月X日无餐段，请重新提供或进入排产后台进行餐段设置后重新生成菜单' : menuResultMessage}</span>{!noMeal && menuGenerationResult.status === 'success' && <button className="primary-link" onClick={() => go('menu')}>查看菜单</button>}</div></div>}
        {!schedule && !noMeal && !flow && displayMessageIndex === dialogue.length && postSuccessDialogue.slice(0, postSuccessIndex).map((message, index) => <div className={`${message.role}-message`} key={`post-success-${message.text}-${index}`}><span className="message-avatar">{message.role === 'assistant' ? <img src={assistantChef} alt="小熙" /> : '我'}</span><span className="message-text">{message.text}</span></div>)}
      </div>}
    </div>
{showScheduleConfirm && <div className="modal-mask" onClick={closeModal}><section className="plan-confirm-modal schedule-confirm-modal" onClick={(event) => event.stopPropagation()}><h2>排产计划确认</h2><div className="plan-summary"><div className="plan-info-grid"><span>排产范围<strong>2026年8月3日、8月4日</strong></span></div><div className="compact-plan-days">{planDays.map(([date, meals, people]) => { const status = dayStatus(date); const canViewDetails = status === 'generated' || (status === 'existing' && coverExisting === true); const mealGroups = meals.includes('晚餐') ? [{ meal: '午餐', batches: [{ label: '批次1', start: 0 }, { label: '批次2', start: 2 }] }, { meal: '晚餐', batches: [{ label: '批次3', start: 4 }] }] : [{ meal: '午餐', batches: [{ label: '批次1', start: 0 }, { label: '批次2', start: 2 }, { label: '批次3', start: 4 }] }]; return <div key={date} className={`compact-plan-day ${status}`}><strong>{date}</strong><span>{meals} · {people}</span><em>{statusLabel[status]}</em>{status === 'existing' && <div className="cover-confirm"><button className={coverExisting === true ? 'selected' : ''} onClick={() => setCoverExisting(true)}>覆盖已有计划</button><button className={coverExisting === false ? 'selected' : ''} onClick={() => setCoverExisting(false)}>保留已有计划</button>{coverExisting !== null && <small>已记录：{coverExisting ? '覆盖已有计划' : '保留已有计划'}</small>}</div>}{canViewDetails && <><button className="day-detail-button" onClick={() => setExpandedDays((current) => ({ ...current, [date]: !current[date] }))}>{expandedDays[date] ? '收起明细' : '查看明细'} <span>{expandedDays[date] ? '⌃' : '⌄'}</span></button>{expandedDays[date] && <div className="plan-day-content"><p className="day-status">{status === 'generated' ? '已生成排产，可按批次查看生产顺序' : '覆盖后将按当前批次生成排产'}</p><div className="meal-batch-groups">{mealGroups.map(({ meal, batches }) => <section className="meal-batch-group" key={meal}><h4>{meal}</h4><div className="batch-detail-list">{batches.map(({ label, start }) => <div className="batch-group" key={label}><h5>{label}</h5><div className="dish-grid">{detailDishes.slice(start, start + 2).map(([name, quantity, , tone, equipment, method, temperature], dishIndex) => <div className={`production-dish-card ${tone === "红" ? "red" : tone === "黄" ? "yellow" : "green"}`} key={`${date}-${name}`}><div className="production-dish-top"><strong>{start + dishIndex + 1}</strong><i /><span>{detailDishPortions[start + dishIndex]}</span></div><div className="production-dish-flags"><b>预</b>{equipment === "炒菜机" && <b>出</b>}</div><div className="production-dish-body"><div className="production-quantity-control"><QuantityStepper initial={Number.parseInt(quantity, 10)} label={`${name}数量`} /><em>盆</em></div><span>{name}</span></div><div className="production-dish-method">{equipment} · {method} · {temperature}</div></div>)}</div></div>)}</div></section>)}</div></div>}</>}</div> })}</div></div><div className="plan-confirm-actions"><button onClick={closeModal}>取消</button><button className="primary" onClick={closeModal}>提交</button></div>{(saved || submitted) && <div className="plan-result">{saved ? '已暂存当前计划' : '已提交当前计划，结果已记录'}</div>}</section></div>}
  </>;
}

function QuantityStepper({ initial, label = '生产数量' }: { initial: number; label?: string }) { const [value, setValue] = useState(initial); return <div className="quantity-stepper"><button type="button" aria-label={`减少${label}`} onClick={() => setValue((current) => Math.max(0, current - 1))}>−</button><input type="number" min="0" value={value} aria-label={label} onChange={(event) => setValue(Math.max(0, Number(event.target.value) || 0))} /><button type="button" aria-label={`增加${label}`} onClick={() => setValue((current) => current + 1)}>＋</button></div>; }

 function ViewMenu({ go }: { go: (page: Page) => void }) { const rows = [...lunch, ...dinner].map((name, i) => [name, i < 4 ? '大荤' : i < 9 ? '小荤' : '蔬菜', i % 2 ? '10kg炒菜机' : '5kg烤箱', i % 3 + 1]); return <><div className="table-title view-menu-title">2026年7月15日 星期三 <span>午餐</span><button className="view-menu-add-button" onClick={() => go('assistant-menu')}>加菜</button></div><div className="table-wrap"><table><thead><tr><th>餐品名称</th><th>餐品分类</th><th>餐品SOP</th><th>烹饪设备</th><th>生产数量(盆)</th><th>操作</th></tr></thead><tbody>{rows.map(([name, cat, sop, qty]) => <tr key={name}><td>{name}</td><td>{cat}</td><td>{sop}</td><td>{String(sop).includes('烤箱') ? '烤箱' : '炒菜机'}</td><td><QuantityStepper initial={Number(qty)} /></td><td><button className="text-action">删除</button></td></tr>)}</tbody></table></div><div className="bottom-actions"><button onClick={() => go('menu')}>返回</button><button className="primary" onClick={() => go('schedule')}>去排产</button></div></>; }

function MealRow({ title, dishes, tone }: { title: string; dishes: string[]; tone: 'gray' | 'cyan' }) { return <section className="meal-row"><div className={`meal-label ${tone}`}>{title}</div><div className="dish-grid">{dishes.map((dish, index) => <button className={`dish-card ${index % 4 === 0 ? 'alert' : ''}`} key={dish}><span>{dish}</span><small>{index % 3 + 1}盆/{index % 3 + 1}盆</small><em>{index % 3 === 1 ? '有余量' : '分配完成'}</em></button>)}</div></section>; }

function ScheduleMenuBoard() { return <><div className="legend"><span className="legend-title">门店菜单</span><span><i className="dot done" />分配完成</span><span><i className="dot surplus" />有余量</span><span><i className="dot manual" />当天预制</span><span><i className="dot manual-production" />手动生产</span></div><section className="schedule-store-menu"><div className="schedule-meal-tabs"><button className="active">早餐 <b>›</b></button><button>午餐</button><button>其他</button><button>晚餐</button><button>宵夜</button></div><div className="schedule-menu-dishes">{['黑椒牛仔粒', '香酥鱼排', '地三鲜', '香菇菜心', '酸辣藕丁'].map((dish, index) => <button className={`dish-card store-dish-card ${index % 3 === 0 ? 'alert' : ''}`} key={dish}><span>{dish}</span><small>{index % 3 + 1}盆/{index % 3 + 1}盆</small><em>{index % 2 === 0 ? '分配完成' : '有余量'}</em></button>)}</div></section></>; }

type ScheduleDishItem = { name: string; quantity?: number; tone?: 'red' | 'yellow' | 'green'; number?: number };

const scheduleMealGroups: { meal: string; batches: { label: string; dishes: ScheduleDishItem[] }[] }[] = [
  { meal: '早餐', batches: [
    { label: '批次1', dishes: [{ name: '黑椒牛仔粒' }, { name: '香酥鱼排' }, { name: '地三鲜' }, { name: '香菇菜心' }, { name: '酸辣藕丁', tone: 'green' }] },
    { label: '批次2', dishes: [{ name: '黑椒牛仔粒', quantity: 12 }, { name: '地三鲜', quantity: 4 }, { name: '香菇菜心', quantity: 8 }] },
  ] },
  { meal: '午餐', batches: [
    { label: '批次1', dishes: [{ name: '小炒黄牛肉', quantity: 10 }, { name: '韭菜绿豆芽', quantity: 8 }] },
    { label: '批次2', dishes: [{ name: '小炒黄牛肉', quantity: 6 }] },
  ] },
  { meal: '其他', batches: [{ label: '批次1', dishes: [{ name: '蒜蓉菠菜', quantity: 5 }] }] },
  { meal: '晚餐', batches: [
    { label: '批次1', dishes: [{ name: '葱油鸡' }] },
    { label: '批次2', dishes: [{ name: '葱油鸡' }] },
  ] },
  { meal: '宵夜', batches: [{ label: '批次1', dishes: [{ name: '酸辣藕丁', quantity: 3, tone: 'green' }] }] },
];

const scheduleDishDetails: Record<string, { quantity: number; capacity: string; method: string; tone: 'red' | 'yellow' | 'green' }> = {
  '黑椒牛仔粒': { quantity: 3, capacity: '17份/盆', method: '黑椒牛仔粒2kg', tone: 'red' },
  '香酥鱼排': { quantity: 2, capacity: '25份/盆', method: '煎烤8分钟180度', tone: 'red' },
  '地三鲜': { quantity: 1, capacity: '50份/盆', method: '地三鲜6kg', tone: 'yellow' },
  '香菇菜心': { quantity: 1, capacity: '25份/盆', method: '蒸煮1分钟100度湿', tone: 'green' },
  '酸辣藕丁': { quantity: 3, capacity: '17份/盆', method: '蒸烤2分钟160度', tone: 'yellow' },
  '毛豆雪菜肉丝': { quantity: 1, capacity: '17份/盆', method: '毛豆雪菜肉丝2kg', tone: 'red' },
  '外婆菜炒蛋': { quantity: 2, capacity: '25份/盆', method: '煎烤8分钟180度', tone: 'yellow' },
  '千叶回锅肉': { quantity: 3, capacity: '50份/盆', method: '千叶回锅肉6kg', tone: 'yellow' },
  '小炒黄牛肉': { quantity: 1, capacity: '25份/盆', method: '炒菜机', tone: 'yellow' },
  '韭菜绿豆芽': { quantity: 2, capacity: '50份/盆', method: '炒菜机', tone: 'red' },
  '蒜蓉菠菜': { quantity: 3, capacity: '25份/盆', method: '炒菜机', tone: 'yellow' },
  '红烧带鱼': { quantity: 1, capacity: '17份/盆', method: '煎烤8分钟180度', tone: 'yellow' },
  '葱油鸡': { quantity: 2, capacity: '25份/盆', method: '蒸煮9分钟180度', tone: 'yellow' },
  '百叶结烧肉': { quantity: 3, capacity: '50份/盆', method: '蒸煮10分钟180度', tone: 'red' },
  '蚝油牛柳': { quantity: 1, capacity: '25份/盆', method: '炒菜机', tone: 'green' },
  '土豆炖牛腩': { quantity: 2, capacity: '25份/盆', method: '蒸煮20分钟180度', tone: 'green' },
  '香炸翅根': { quantity: 2, capacity: '25份/盆', method: '煎烤12分钟180度', tone: 'red' },
  '梅菜扣肉': { quantity: 2, capacity: '25份/盆', method: '蒸煮20分钟100度', tone: 'yellow' },
  '西葫芦炒肉片': { quantity: 2, capacity: '25份/盆', method: '炒菜机', tone: 'green' },
};

function ScheduleProductionBoard() {
  return <section className="schedule-production-board">
    <div className="legend"><span className="legend-title">排产计划</span><span><i className="dot not-started" />未开始</span><span><i className="dot weighing" />称重中</span><span><i className="dot weighed" />称重完成</span><span><i className="dot produced" />生产完成</span></div>
    <div className="schedule-prep-panel">
      <h2>当天预制</h2>
      {scheduleMealGroups.map(({ meal, batches }) => { let mealDishOffset = 0; return <section className="schedule-meal-section" key={meal}>
        <div className="schedule-meal-label">{meal}</div>
        <div className="schedule-batch-list">{batches.map(({ label, dishes }) => { const batchOffset = mealDishOffset; mealDishOffset += dishes.length; return <div className="schedule-batch-group" key={`${meal}-${label}`}>
          <h3>{label}</h3>
          <div className="schedule-batch-grid">{dishes.map((dish, index) => { const detail = scheduleDishDetails[dish.name] ?? { quantity: index % 3 + 1, capacity: '25份/盆', method: '炒菜机', tone: 'green' as const }; const cardNumber = dish.number ?? (meal === '早餐' ? batchOffset + index + 1 : index + 1); return <div className={`schedule-production-card ${dish.tone ?? detail.tone}`} key={`${meal}-${label}-${dish.name}-${index}`}><div className="schedule-card-meta"><strong>{cardNumber}</strong><i /><span>{detail.capacity}</span></div><div className="schedule-card-body"><strong>{dish.quantity ?? detail.quantity}盆</strong><span>{dish.name}</span></div><div className="schedule-card-method">{detail.method}</div></div>; })}</div>
        </div>; })}</div>
      </section>; })}
    </div>
  </section>;
}

type PlanningItem = { name: string; meal: '午餐' | '晚餐'; quantity: number; batch: string };

function EditDishCard({ item, index, onChange, onRemove, onDragStart, onDrop }: { item: PlanningItem; index: number; onChange: (changes: Partial<PlanningItem>) => void; onRemove: () => void; onDragStart: () => void; onDrop: () => void }) { const accent = index % 5 === 0 ? 'red' : index % 5 === 3 ? 'yellow' : 'green'; return <div className="edit-dish-wrap" draggable onDragStart={onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}><div className="edit-dish-meta"><strong>{index + 1}</strong><span className={`meta-dot ${accent}`} /> <span>{(index % 5 + 2) * 10}份/盆</span></div><div className={`edit-dish-card ${accent}`}><div className="edit-dish-flags"><b>预</b><b>出</b><button aria-label={`${item.name}移除`} onClick={onRemove}>×</button></div><div className="edit-qty"><input aria-label={`${item.name}生产数量`} type="number" min="0" value={item.quantity} onChange={(event) => onChange({ quantity: Math.max(0, Number(event.target.value) || 0) })} /><span>盆</span></div><strong>{item.name}</strong><small>番茄炒蛋10kg</small></div><div className="edit-dish-footer"><span>{item.meal}</span><select aria-label={`${item.name}批次`} value={item.batch} onChange={(event) => onChange({ batch: event.target.value })}><option>批次1</option><option>批次2</option><option>批次3</option></select></div></div>; }

function EditPlanningBoard({ detailed, plan, onChange, onRemove, onReorder }: { detailed: boolean; plan: PlanningItem[]; onChange: (index: number, changes: Partial<PlanningItem>) => void; onRemove: (index: number) => void; onReorder: (from: number, to: number) => void }) { const [dragIndex, setDragIndex] = useState<number | null>(null); const batches = Array.from(new Set(plan.map((item) => item.batch))).sort(); return <section className="edit-planning"><div className="planning-heading"><span>排产计划</span><div className="planning-status-legend"><span><i className="planning-dot not-started" />未开始</span><span><i className="planning-dot weighing" />称重中</span><span><i className="planning-dot weighed" />称重完成</span><span><i className="planning-dot produced" />生产完成</span></div></div>{detailed ? <div className="edit-production-panel"><h2>当天预制</h2>{batches.map((batch) => <div className="edit-batch" key={batch}><strong className="edit-batch-title">{batch}</strong><div className="edit-dish-grid">{plan.map((item, index) => item.batch === batch ? <EditDishCard key={item.name} item={item} index={index} onChange={(changes) => onChange(index, changes)} onRemove={() => onRemove(index)} onDragStart={() => setDragIndex(index)} onDrop={() => { if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index); setDragIndex(null); }} /> : null)}</div></div>)}<div className="drop-placeholder">如需添加到最后，请<br />拖动到此处</div></div> : <div className="planning-board"><h3>计划烹饪</h3><div className="drop-placeholder">如需添加到最后，请<br />拖动到此处</div></div>}</section>; }

const onceProductionItems = [
  ['3盆', '手撕包菜', '蒸烤8分钟150度湿30', '15份/盆', 'red', '早餐', false],
  ['6盆', '红枣南瓜', '蒸烤8分钟150度湿30', '42份/盆', 'red', '早餐', false],
  ['1盆', '小炒杏鲍菇肉片', '小炒杏鲍菇肉片', '74份/盆', 'yellow', '早餐', true],
  ['1盆', '荷塘小炒', '荷塘小炒10kg', '83份/盆', 'green', '早餐', false],
  ['1盆', '地三鲜', '地三鲜6kg', '50份/盆', 'yellow', '早餐', false],
  ['1盆', '番茄炒蛋', '番茄炒蛋10kg', '67份/盆', 'yellow', '早餐', true],
  ['2盆', '丝瓜炒蛋', '丝瓜炒蛋10kg', '80份/盆', 'yellow', '早餐', true],
  ['1盆', '茭白炒肉丝', '茭白炒肉丝6kg', '44份/盆', 'yellow', '早餐', true],
  ['3盆', '蒜蓉小油菜', '蒜蓉小油菜6.5kg', '59份/盆', 'green', '早餐', false],
  ['6盆', '验证下载餐品-', '蒸烤2分钟160度湿75', '20份/盆', 'green', '午餐', false],
] as const;

function onceMealClass(meal: string) { return meal === '午餐' ? 'lunch' : meal === '其他' ? 'other' : ''; }

type OnceEditItem = { name: string; quantity: number; meal: string; capacity: string; method: string; tone: 'red' | 'yellow' | 'green'; pre?: boolean };
const onceEditItems: OnceEditItem[] = [
  { name: '黑椒牛仔粒', quantity: 1, meal: '早餐', capacity: '17份/盆', method: '黑椒牛仔粒2kg', tone: 'green' },
  { name: '黑椒牛仔粒', quantity: 12, meal: '午餐', capacity: '17份/盆', method: '黑椒牛仔粒2kg', tone: 'green' },
  { name: '地三鲜', quantity: 4, meal: '午餐', capacity: '50份/盆', method: '地三鲜6kg', tone: 'yellow' },
  { name: '香菇菜心', quantity: 8, meal: '午餐', capacity: '25份/盆', method: '蒸煮1分钟100度湿', tone: 'green' },
  { name: '黑椒牛仔粒', quantity: 1, meal: '午餐', capacity: '17份/盆', method: '黑椒牛仔粒2kg', tone: 'green' },
  { name: '香酥鱼排', quantity: 1, meal: '其他', capacity: '25份/盆', method: '煎烤8分钟180度', tone: 'red', pre: true },
  { name: '地三鲜', quantity: 1, meal: '其他', capacity: '50份/盆', method: '地三鲜6kg', tone: 'yellow' },
  { name: '香菇菜心', quantity: 1, meal: '其他', capacity: '25份/盆', method: '蒸煮1分钟100度湿', tone: 'green' },
  { name: '酸辣藕丁', quantity: 1, meal: '其他', capacity: '17份/盆', method: '蒸烤2分钟160度', tone: 'yellow' },
  { name: '黑椒牛仔粒', quantity: 9, meal: '晚餐', capacity: '17份/盆', method: '黑椒牛仔粒2kg', tone: 'green' },
  { name: '香酥鱼排', quantity: 6, meal: '晚餐', capacity: '25份/盆', method: '煎烤8分钟180度', tone: 'red', pre: true },
  { name: '地三鲜', quantity: 1, meal: '宵夜', capacity: '50份/盆', method: '地三鲜6kg', tone: 'yellow' },
  { name: '地三鲜', quantity: 3, meal: '晚餐', capacity: '50份/盆', method: '地三鲜6kg', tone: 'yellow' },
  { name: '香菇菜心', quantity: 6, meal: '晚餐', capacity: '25份/盆', method: '蒸煮1分钟100度湿', tone: 'green' },
  { name: '酸辣藕丁', quantity: 9, meal: '晚餐', capacity: '17份/盆', method: '蒸烤2分钟160度', tone: 'yellow' },
  { name: '黑椒牛仔粒', quantity: 3, meal: '宵夜', capacity: '17份/盆', method: '黑椒牛仔粒2kg', tone: 'green' },
  { name: '香酥鱼排', quantity: 2, meal: '宵夜', capacity: '25份/盆', method: '煎烤8分钟180度', tone: 'red', pre: true },
  { name: '香菇菜心', quantity: 2, meal: '宵夜', capacity: '25份/盆', method: '蒸煮1分钟100度湿', tone: 'green' },
  { name: '酸辣藕丁', quantity: 3, meal: '宵夜', capacity: '17份/盆', method: '蒸烤2分钟160度', tone: 'yellow' },
  { name: '香菇菜心', quantity: 1, meal: '早餐', capacity: '25份/盆', method: '蒸煮1分钟100度湿', tone: 'green' },
  { name: '香酥鱼排', quantity: 2, meal: '早餐', capacity: '25份/盆', method: '煎烤8分钟180度', tone: 'red', pre: true },
  { name: '地三鲜', quantity: 1, meal: '早餐', capacity: '50份/盆', method: '地三鲜6kg', tone: 'yellow' },
  { name: '香菇菜心', quantity: 1, meal: '早餐', capacity: '25份/盆', method: '蒸煮1分钟100度湿', tone: 'green' },
  { name: '酸辣藕丁', quantity: 3, meal: '早餐', capacity: '17份/盆', method: '蒸烤2分钟160度', tone: 'yellow' },
  { name: '黑椒牛仔粒', quantity: 2, meal: '早餐', capacity: '17份/盆', method: '黑椒牛仔粒2kg', tone: 'green' },
];

function ScheduleOnceEditBoard({ plan, onChange, onRemove }: { plan: OnceEditItem[]; onChange: (index: number, quantity: number) => void; onRemove: (index: number) => void }) {
  return <section className="edit-planning"><div className="planning-heading"><span>排产计划</span><div className="planning-status-legend"><span><i className="planning-dot not-started" />未开始</span><span><i className="planning-dot weighing" />称重中</span><span><i className="planning-dot weighed" />称重完成</span><span><i className="planning-dot produced" />生产完成</span></div></div><div className="edit-production-panel"><h2>当天预制</h2><div className="edit-batch"><div className="edit-dish-grid">{plan.map((item, index) => <div className="edit-dish-wrap" key={`${item.name}-${index}`}><div className="edit-dish-meta"><strong>1</strong><span className={`meta-dot ${item.tone}`} /> <span>{item.capacity}</span></div><div className={`edit-dish-card ${item.tone}`}><div className="edit-dish-flags">{item.pre && <b>预</b>}<button aria-label={`${item.name}移除`} onClick={() => onRemove(index)}>×</button></div><div className="edit-qty"><input aria-label={`${item.name}生产数量`} type="number" min="0" value={item.quantity} onChange={(event) => onChange(index, Math.max(0, Number(event.target.value) || 0))} /><span>盆</span></div><strong>{item.name}</strong><small>{item.method}</small></div><div className="edit-dish-footer"><span className={onceMealClass(item.meal)}>{item.meal}</span></div></div>)}</div></div><div className="drop-placeholder">点击左侧菜品可加入到最后</div></div></section>;
}

function ScheduleOnceProductionBoard() {
  return <section className="schedule-production-board">
    <div className="legend"><span className="legend-title">排产计划</span><span><i className="dot not-started" />未开始</span><span><i className="dot weighing" />称重中</span><span><i className="dot weighed" />称重完成</span><span><i className="dot produced" />生产完成</span></div>
    <div className="schedule-prep-panel"><h2>当天预制</h2><section className="schedule-meal-section once-meal-section"><div className="schedule-batch-list"><div className="schedule-batch-group"><div className="schedule-batch-grid">{onceProductionItems.map(([quantity, name, method, capacity, tone, meal, pre], index) => <div className={`schedule-production-card ${tone}`} key={`${name}-${index}`}><div className="schedule-card-meta"><strong>{index + 1}</strong><i />{pre && <b>预</b>}<span>{capacity}</span></div><div className="schedule-card-body"><strong>{quantity}</strong><span>{name}</span></div><div className="schedule-card-method">{method}</div><div className={`schedule-card-meal ${onceMealClass(meal)}`}>{meal}</div></div>)}</div></div></div></section></div>
  </section>;
}

function ScheduleOncePage({ go }: { go: (page: Page) => void }) {
  const [week, setWeek] = useState(0);
  const [day, setDay] = useState(0);
  const [editing, setEditing] = useState(false);
  const [plan, setPlan] = useState(onceEditItems);
  const updateQuantity = (index: number, quantity: number) => setPlan((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity } : item));
  const removeItem = (index: number) => setPlan((current) => current.filter((_, itemIndex) => itemIndex !== index));
  return <div className="schedule-page schedule-once-page"><div className="content-head" data-annotation-id="schedule-once-header"><div><h1>排产计划</h1></div>{editing ? <div className="edit-actions"><button className="all-plan-button">全部排产</button><button className="smart-plan-button">AI智能排产</button><button className="save-plan-button" onClick={() => setEditing(false)}>保存</button><button className="return-plan-button" onClick={() => setEditing(false)}>返回</button></div> : <div className="head-actions"><button className="voice-plan-button" onClick={() => go('assistant-schedule')}><Mic size={16} />语音排产</button><button className="edit-button" onClick={() => setEditing(true)}>编辑</button></div>}</div><WeekTabs active={week} setActive={setWeek} items={scheduleWeekData} /><div className="day-tabs">{scheduleDays.map(([name, date], index) => <button key={date} className={day === index ? 'day active' : 'day'} onClick={() => setDay(index)}><strong>{name}（{index < 2 ? (index === 0 ? 23 : 1) : 0}）</strong><span>{date}</span></button>)}</div>{editing ? <><ScheduleMenuBoard /><ScheduleOnceEditBoard plan={plan} onChange={updateQuantity} onRemove={removeItem} /></> : <><ScheduleMenuBoard /><ScheduleOnceProductionBoard /></>}</div>;
}

 function SchedulePage({ go }: { go: (page: Page) => void }) { const [week, setWeek] = useState(0); const [day, setDay] = useState(0); const [editing, setEditing] = useState(false); const [detailed, setDetailed] = useState(false); const initialPlan = useMemo(() => [...lunch.map((name) => ({ name, meal: '午餐' as const })), ...dinner.map((name) => ({ name, meal: '晚餐' as const }))].map((item, index) => ({ ...item, quantity: index % 4 + 1, batch: index < 10 ? '批次1' : '批次2' })), []); const [savedPlan, setSavedPlan] = useState(initialPlan); const [draftPlan, setDraftPlan] = useState(initialPlan); const updatePlan = (index: number, changes: Partial<PlanningItem>) => setDraftPlan((plan) => plan.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item)); const removePlan = (index: number) => setDraftPlan((plan) => plan.filter((_, itemIndex) => itemIndex !== index)); const reorderPlan = (from: number, to: number) => setDraftPlan((plan) => { const next = [...plan]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next; }); const enterEdit = () => { setDraftPlan(savedPlan); setEditing(true); setDetailed(true); }; const leaveEdit = () => { setDraftPlan(savedPlan); setEditing(false); setDetailed(false); }; const runAllPlan = () => setDetailed(true); const runAiPlan = () => setDraftPlan((plan) => plan.map((item, index) => ({ ...item, batch: `批次${index % 3 + 1}` }))); return <div className="schedule-page"><div className="content-head" data-annotation-id="schedule-header"><div><h1>排产计划</h1></div>{editing ? <div className="edit-actions"><button className="all-plan-button" onClick={runAllPlan}>全部排产</button><button className="smart-plan-button" onClick={runAiPlan}>AI智能排产</button><button className="save-plan-button" onClick={() => { setSavedPlan(draftPlan); setEditing(false); setDetailed(false); }}>保存</button><button className="return-plan-button" onClick={leaveEdit}>返回</button></div> : <div className="head-actions"><button className="voice-plan-button" onClick={() => go('assistant-schedule')}><Mic size={16} />智能排产</button><button className="edit-button" onClick={enterEdit}>编辑</button></div>}</div><WeekTabs active={week} setActive={setWeek} items={scheduleWeekData} /><div className="day-tabs">{scheduleDays.map(([name, date], index) => <button key={date} className={day === index ? 'day active' : 'day'} onClick={() => setDay(index)}><strong>{name}（{index < 2 ? (index === 0 ? 23 : 1) : 0}）</strong><span>{date}</span></button>)}</div>{editing ? <><ScheduleMenuBoard /><EditPlanningBoard detailed={detailed} plan={draftPlan} onChange={updatePlan} onRemove={removePlan} onReorder={reorderPlan} /></> : <><ScheduleMenuBoard /><ScheduleProductionBoard /></>}</div>; }

 function PurchasePage({ go }: { go: (page: Page) => void }) { const [saved, setSaved] = useState(false); const [orderQuantities, setOrderQuantities] = useState(() => ingredients.map((_, i) => i % 3 + 1)); const updateOrderQuantities = () => { setOrderQuantities(ingredients.map((_, i) => i % 4 + 1)); setSaved(false); }; return <><div className="purchase-filter"><select defaultValue=""><option value="">本周</option><option>下周</option><option>第三周</option><option>第四周</option></select>{days.map(([name]) => <label key={name}><input type="checkbox" defaultChecked={name === '周三'} />{name}</label>)}<button className="update-order-link" onClick={updateOrderQuantities}>更新需订量</button></div><div className="table-wrap purchase-table"><table><thead><tr><th className="purchase-needed-column">序号</th><th>原料名称</th><th>原料类型</th><th>需订量<br />(重量单位)</th></tr></thead><tbody>{ingredients.map((name, i) => <tr key={name}><td>{2145 + i}</td><td>{name}</td><td>{name === '红烧汁' || name === '蚝油' ? '调料' : '食材'}</td><td>{(i + 1) * 300}g</td></tr>)}</tbody></table></div><div className="bottom-actions"><button className="primary" onClick={() => go('list')}>去采购</button></div>{saved && <div className="purchase-save-status">已暂存当前订货量</div>}</>; }


 function ListPage({ go, deliveryDate, setDeliveryDate }: { go: (page: Page) => void; deliveryDate: string; setDeliveryDate: (date: string) => void }) {
  const [orderType, setOrderType] = useState('正常单');
  const [selectedBeef, setSelectedBeef] = useState('牛肉');
  const [quantities, setQuantities] = useState(() => orderItems.map((_, index) => index % 4 + 1));
  const [removedItems, setRemovedItems] = useState<number[]>([]);
  const categoryOf = (item: string, index: number) => item === '红烧汁' ? '调味料' : index < 6 ? '生肉禽蛋' : '蔬素豆腐';
  const allItems = orderItems.map((item, index) => ({ item, index })).filter(({ index }) => !removedItems.includes(index));
  const multiplierOf = (index: number) => index % 3 + 1;
  const unitPriceOf = (index: number) => index * 13.42 + 15;
  const updateQuantity = (index: number, direction: number) => setQuantities((current) => current.map((quantity, itemIndex) => itemIndex === index ? Math.max(0, quantity + direction * multiplierOf(index)) : quantity));
  const total = allItems.reduce((sum, { index }) => sum + quantities[index] * unitPriceOf(index), 0);
  const quantity = allItems.reduce((sum, { index }) => sum + quantities[index], 0);
  const categories = ['生肉禽蛋', '调味料', '蔬素豆腐'];
  const categorySummaryBase: Record<string, number> = { 生肉禽蛋: 291.30, 调味料: 256.56, 蔬素豆腐: 326.82 };
  const categorySummaryTotal = (category: string) => categorySummaryBase[category] - removedItems.filter((index) => categoryOf(orderItems[index], index) === category).reduce((sum, index) => sum + quantities[index] * unitPriceOf(index), 0);
  const orderTypes = ['正常单', '紧急单', '补单', '强配单'];
return <div className="shopping-list-layout"><div className="shopping-list-scroll">{categories.map((category) => <section className="shopping-category" key={category}><div className="shopping-category-heading"><h2>{category}</h2><b>{allItems.filter(({ item, index }) => categoryOf(item, index) === category).length}件</b></div><div className="shopping-grid">{allItems.filter(({ item, index }) => categoryOf(item, index) === category).map(({ item, index }) => <div className="shopping-item" key={item}><div className="item-name">{item === '牛肉' ? <select className="item-name-select" aria-label="选择牛肉" value={selectedBeef} onChange={(event) => setSelectedBeef(event.target.value)}><option value="牛肉">牛肉</option><option value="牛肉A">牛肉A</option></select> : <strong>{item}</strong>}<small>500g/袋</small></div><strong className="item-unit-price">¥{unitPriceOf(index).toFixed(2)}</strong><div className="item-stepper"><button type="button" onClick={() => updateQuantity(index, -1)}>−</button><b>{quantities[index]}</b><button type="button" onClick={() => updateQuantity(index, 1)}>＋</button></div><span className="item-unit">袋</span><em className="item-order-hint">按{multiplierOf(index)}倍起订</em><strong className="item-price">¥{(quantities[index] * unitPriceOf(index)).toFixed(2)}</strong><button type="button" className="shopping-remove-button" aria-label={`删除${item}`} onClick={() => setRemovedItems((current) => current.includes(index) ? current : [...current, index])}>×</button></div>)}</div></section>)}</div><aside className="order-summary"><h2>采购清单</h2><div className="summary-detail"><small>商品明细</small>{categories.map((category) => <div key={category}><span>•　{category} ×{allItems.filter(({ item, index }) => categoryOf(item, index) === category).length}</span><b>¥{categorySummaryTotal(category).toFixed(2)}</b></div>)}</div><div className="summary-total"><div>商品总数 <b>{quantity} 件</b></div><div>商品小计 <b>¥{total.toFixed(2)}</b></div><hr /><div className="pay-total">应付总额 <strong>¥{total.toFixed(2)}</strong></div></div><div className="order-options"><div className="order-type"><strong>订单类型</strong><div>{orderTypes.map((type) => <label key={type} className={orderType === type ? 'selected' : ''}><input type="radio" name="order-type" value={type} checked={orderType === type} onChange={() => setOrderType(type)} />{type}</label>)}</div></div><label className="delivery-option"><strong>期望送达时间</strong><input type="datetime-local" step="1" aria-label="期望送达时间" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} /></label></div><div className="summary-actions"><button className="primary" onClick={() => go('confirm')}>去结算</button><button onClick={() => go('purchase')}>返回修改</button></div></aside></div>;
 }
function ConfirmPage({ go, deliveryDate }: { go: (page: Page) => void; deliveryDate: string }) { return <><div className="table-title">确认采购清单</div><div className="table-wrap confirm-table"><table><colgroup><col /><col /><col /><col /><col /><col /><col /><col /><col /><col /><col /><col /><col /></colgroup><thead><tr><th>序号</th><th>原料</th><th>分类</th><th>理论需求量</th><th>今日收货</th><th>库存</th><th>实际需求量</th><th>规格</th><th>订货单位</th><th>起订量</th><th>单价</th><th>总价</th><th>操作</th></tr></thead><tbody>{orderItems.map((item, i) => { const quantity = i % 5 + 1; const total = i * 21 + 15; return <tr key={item}><td>{i + 1}</td><td>{item}</td><td>{i < 6 ? '生肉禽蛋' : '蔬素豆腐'}</td><td>{quantity}</td><td>0</td><td>{i % 3}</td><td><QuantityStepper initial={quantity} label={`${item}实际需求量`} /></td><td>1000g/袋</td><td>袋</td><td>1</td><td>{(total / quantity).toFixed(2)}</td><td>{total.toFixed(2)}</td><td><button className="text-action">删除</button></td></tr>; })}</tbody></table></div><div className="delivery"><strong>期望送达时间</strong><span className="delivery-date" aria-label="期望送达日期">{deliveryDate.replace('T', ' ')}</span></div><div className="order-total">总计　1936.47元　总数　71</div><div className="bottom-actions"><button onClick={() => go('list')}>返回修改</button><button className="primary" onClick={() => go('success')}>确认下单</button></div></>; }

function SuccessPage({ go }: { go: (page: Page) => void }) { return <div className="success-page"><div className="success-check">✓</div><h1>您已下单成功</h1><p>预计送达时间为 2026-07-15 06:00:00</p><button className="primary" onClick={() => go('purchase')}>返回订单采购</button></div>; }

function FailurePage({ go }: { go: (page: Page) => void }) { return <div className="success-page"><div className="success-check failure-check">×</div><h1>您已下单失败</h1><button className="primary" onClick={() => go('confirm')}>返回上一步</button></div>; }

const weighingTasks = [
  { id: 'water-fish', state: '称重中', stateClass: 'weighing', dish: '水煮鱼（100份/8盆）', batch: '批次 1', dot: 'green', badges: [['预', 'cyan'], ['称', 'gold']], tags: ['鳗鱼版', '鹌鹑蛋'], meal: '早餐', actions: [['入口', 'entry'], ['跳过', 'skip']] },
  { id: 'frog', state: '待加料', stateClass: 'feeding', dish: '小炒牛蛙（100份/5盆）', batch: '批次 1', dot: 'red', badges: [['预', 'cyan'], ['称', 'gold']], tags: ['鳗鱼版', '鹌鹑蛋', '香干', '鹌鹑蛋', '鳗鱼版', '鹌鹑蛋', '鹌鹑蛋', '鹌鹑蛋', '鹌鹑蛋', '鹌鹑蛋', '甜咸版'], meal: '午餐', actions: [['手动', 'manual'], ['置顶', 'pin']] },
  { id: 'beef-waiting', state: '待称重', stateClass: 'waiting', dish: '土豆牛腩（100份/10盆）', batch: '批次 2', badges: [], tags: ['鳗鱼版', '鹌鹑蛋', '香干', '鹌鹑蛋', '鳗鱼版', '鹌鹑蛋', '鹌鹑蛋', '鹌鹑蛋', '鹌鹑蛋', '鹌鹑蛋', '甜咸版'], meal: '晚餐', actions: [['出口', 'exit'], ['置顶', 'pin']] },
  { id: 'pickled-fish-not-started', state: '未开始', stateClass: 'not-started', dish: '酸菜鱼（100份/8盆）', batch: '批次 2', dot: 'orange', badges: [['称', 'gold']], tags: ['鳗鱼版', '鹌鹑蛋', '香干', '鹌鹑蛋', '鳗鱼版', '鹌鹑蛋'], meal: '宵夜', actions: [['入口', 'entry'], ['跳过', 'skip']] },
  { id: 'beef-invalid', state: '已作废', stateClass: 'invalid', dish: '土豆牛腩（100份/10盆）', batch: '批次 3', badges: [['称', 'gold'], ['出', 'green']], tags: ['鳗鱼版', '鹌鹑蛋', '香干', '鹌鹑蛋', '鳗鱼版', '鹌鹑蛋', '鹌鹑蛋', '鹌鹑蛋', '鹌鹑蛋', '鹌鹑蛋', '甜咸版'], meal: '下午茶', actions: [['手动', 'manual']] },
  { id: 'pickled-fish-complete', state: '已完成', stateClass: 'completed', dish: '酸菜鱼（100份/8盆）', batch: '批次 3', badges: [], tags: ['鳗鱼版', '鹌鹑蛋', '香干', '鹌鹑蛋', '鳗鱼版', '鹌鹑蛋', '鹌鹑蛋'], meal: '晚餐', actions: [] },
];

function WeighingPage({ go }: { go: (page: Page) => void }) {
  const [started, setStarted] = useState(false);
  return <div className="weighing-viewport">
    <div className="weighing-scale">
      <div className="weighing-app">
        <div className="weighing-status-bar"><span className="weighing-wifi" aria-hidden="true" /><time>20:20</time></div>
        <header className="weighing-header">
          <button className="weighing-back" type="button" onClick={() => go('blank-1')}><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M29 18H7M16 8 6 18l10 10" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>返回</button>
          <h1>称重</h1>
        </header>
        <section className="weighing-summary" aria-label="任务状态统计">
          <span className="gray">未开始：6</span><span className="purple">待称重：5</span><span className="blue">称重中：5</span><span className="amber">待加料：5</span><span className="green">已完成：12</span><span className="red">已作废：5</span>
        </section>
        <section className="weighing-task-list" aria-label="称重任务">
          {weighingTasks.map((task) => <article className="weighing-task-row" data-task-id={task.id} key={task.id}>
            <div className={`weighing-task-state ${task.stateClass}`}>{task.state}</div>
            <div className="weighing-task-main">
              <div className={`weighing-dish${task.dot ? '' : ' no-dot'}`}>{task.dot && <i className={`weighing-dot ${task.dot}`} />}<span>{task.dish}</span>{task.batch && <b className="weighing-batch" data-annotation-id={task.batch === '批次 1' ? `annotation-batch-${task.id}` : undefined}>{task.batch}</b>}</div>
              <div className={`weighing-tags${task.dot || task.badges.length ? '' : ' no-dot'}`}>{task.badges.map(([badge, color], index) => <b className={`weighing-mini ${color}`} key={`${badge}-${index}`}>{badge}</b>)}{task.tags.map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}</div>
            </div>
            <div className="weighing-meal">{task.meal}</div>
            <div className="weighing-actions">{task.actions.map(([label, actionClass]) => <button className={`weighing-action ${actionClass}`} type="button" key={label}>{label}</button>)}</div>
          </article>)}
        </section>
        <button className="weighing-start" type="button" onClick={() => setStarted((value) => !value)}>{started ? '进行中' : '开始'}</button>
      </div>
    </div>
  </div>;
}

const dashboardDishes = [
  ['01', '批次1', '青椒香干肉丝', '2盆', ['过油'], '已完成'],
  ['02', '批次1', '芹香水面筋肉丝', '1盆', ['腌制'], '待处理'],
  ['03', '批次2', '肉沫小油片', '1盆', ['腌制'], '已完成'],
  ['04', '批次2', '红烧牛腩', '1盆', ['焯烫', '调制', '蒸煮'], '待处理'],
  ['05', '批次2', '黄焖鸡', '2盆', ['腌制'], '待处理'],
  ['06', '批次2', '绝味鸭腿块', '2盆', ['调制'], '已完成'],
  ['07', '批次3', '咖喱鸡块', '1盆', ['腌制'], '待处理'],
  ['08', '批次3', '油面筋塞肉', '1盆', ['蒸煮'], '已完成'],
  ['09', '批次3', '清炒时蔬', '1盆', [], '已完成'],
] as const;

const dashboardTasks = [
  { kind: '腌制', kindClass: 'red', name: '鸡腿肉块', code: 'GT0210', amount: '8000g', dish: '黄焖鸡', weight: '4000g', season: '盐15g；鸡精15g；白胡椒粉10g；老抽30g；生抽30g；大豆油30g', detail: '腌制30分钟23℃', complete: true, checked: false },
  { kind: '腌制', kindClass: 'red', name: '咖喱鸡块', code: '', amount: '', dish: '咖喱鸡块', weight: '4000g', season: '咖喱粉40g；盐15g；鸡精20g；糖10g；料酒30g；白胡椒粉12g', detail: '腌制30分钟23℃', complete: false, checked: false },
  { kind: '过油', kindClass: 'yellow', name: 'CY精肉丝', code: 'CY000058', amount: '900g', dish: '青椒香干肉丝', weight: '900g', season: '无', detail: '过油1分钟120℃', complete: true, checked: true },
] as const;

const dashboardCooking = [
  { name: '绝味鸭腿块', batch: '批次 1', times: ['08:35', '09:05', '09:15', '09:40'], durations: ['30分钟', '10分钟', '25分钟'], alert: '已晚于 09:15 10分钟，请尽快安排自动生产！' },
  { name: '黄焖鸡', batch: '批次 2', times: ['08:40', '09:05', '09:15', '09:40'], durations: ['25分钟', '10分钟', '25分钟'], alert: '已晚于 09:15 10分钟，请尽快安排自动生产！' },
  { name: '油面筋塞肉', batch: '批次 2', times: ['无', '09:05', '10:00', '10:15'], durations: ['', '10分钟', '15分钟'], alert: '请 10:00 前尽快安排自动生产！' },
  { name: '芹香水面筋肉丝', batch: '批次 3', times: ['10:47', '11:17', '11:27', '11:35'], durations: ['30分钟', '10分钟', '8分钟'], alert: '请 10:25 前尽快安排自动生产！' },
  { name: '红烧牛腩', batch: '批次 3', times: ['完成', '完成', '10:25', '11:55'], durations: ['', '', '25分钟'], alert: '请 10:25 前尽快安排自动生产！' },
] as const;

function DashboardPanel({ title, className, children }: { title: string; className: string; children: React.ReactNode }) {
  return <section className={`dashboard-panel ${className}`}><h2>{title}</h2>{children}</section>;
}

function DashboardPage() {
  return <div className="dashboard-viewport">
    <div className="dashboard-canvas">
      <header className="dashboard-header">
        <span className="dashboard-header-dots" aria-hidden="true"><i /><i /><i /></span>
        <div className="dashboard-logo" aria-label="熙香标识">熙<br />香</div>
        <h1>智能厨房自动生产任务进度监控大屏</h1>
        <i className="dashboard-header-cut" aria-hidden="true" />
        <div className="dashboard-clock"><small>2025年02月22日　星期二</small><strong>◷ 18:36:57</strong></div>
      </header>
      <p className="dashboard-summary">今日 <b>午餐</b> 共需自动生产 <b>9</b> 道菜品，预计备菜时长 <b>2小时49分</b>，为确保 <b>12:00</b> 能够准时出餐，请 <b>08:22</b> 开始备菜</p>
      <DashboardPanel title="工作概览" className="dashboard-overview">
        <div className="dashboard-days"><b>今天⌄</b><b>明天⌄</b></div>
        <div className="dashboard-metrics"><div className="dashboard-icon">♨<small>自动生产菜品</small></div><div><b>12</b><span>总数</span></div><div><b>9</b><span>有预处理任务</span></div><div><b>3</b><span>无预处理任务</span></div></div>
        <div className="dashboard-prep"><div><strong>预处理任务　20↑</strong><p>剩余处理时长　<b>1</b>小时<b>15</b>分钟</p></div><div><span><i />已完成　14↑</span><span><i className="red" />待处理　6↑</span></div></div>
      </DashboardPanel>
      <DashboardPanel title="菜品列表" className="dashboard-dishes">
        <table><thead><tr><th>序号</th><th data-annotation-id="annotation-34">批次</th><th>菜品名称</th><th>生产数量</th><th>预处理任务</th><th>完成情况</th></tr></thead><tbody>{dashboardDishes.map(([id, batch, name, amount, jobs, status]) => <tr key={id}><td>{id}</td><td>{batch}</td><td>{name}<em>今</em><em>午</em><i>10份/盆</i></td><td>{amount}</td><td>{jobs.map((job) => <b className={`dashboard-job ${job}`} key={job}>{job}</b>)}</td><td className={status === '待处理' ? 'warning' : ''}>{status}</td></tr>)}</tbody></table>
      </DashboardPanel>
      <DashboardPanel title="待办任务" className="dashboard-pending">
        <div className="dashboard-filters"><span>请选择完成状态　⌄</span><span>请选择任务类型　⌄</span></div>
        {dashboardTasks.map((task) => <article className="dashboard-task" key={task.dish}><div className="dashboard-task-head"><b className={task.kindClass}>{task.kind}</b><div><small>食材名称</small><strong>{task.name}</strong> <em>（1kg）[{task.code}]</em></div><div><small>食材总重量</small><strong>{task.amount}</strong></div>{task.complete && <button type="button">全部完成</button>}</div><div className="dashboard-task-body"><p className="dashboard-task-alert">请 09:15前开始预处理，09:45前完成预处理!</p><strong>{task.dish}</strong><span>食材重量：{task.weight}</span><span>所需调料：{task.season}</span><span>操作流程：<i>1</i>{task.detail}　<u>查看操作</u></span><span className={`dashboard-check ${task.checked ? 'checked' : ''}`}>完成情况：<i>{task.checked ? '✓' : task.complete ? '' : '⊘'}</i></span></div></article>)}
      </DashboardPanel>
      <DashboardPanel title="烹饪提示" className="dashboard-cooking">
        <b className="dashboard-merge">合并生产</b>{dashboardCooking.map((item) => <article className="dashboard-cooking-row" key={item.name}><div className="dashboard-cooking-name"><strong>{item.name}</strong><b data-annotation-id={item.name === '绝味鸭腿块' ? 'annotation-35' : undefined}>{item.batch}</b></div><p>{item.alert}</p><div>{item.times.map((time, index) => <span key={`${time}-${index}`}>{time}{index < 3 && item.durations[index] && <small>{item.durations[index]}</small>}<i>{['预', '称', '烹', '出'][index]}</i></span>)}</div></article>)}
      </DashboardPanel>
    </div>
  </div>;
}

const productionOrders = [
  ['1756', '2026-08-11', '炒菜机测试', '计划烹饪', '批次 1', '其他', '1', '200', '炒菜机', '取餐完成', '15:05:41', '15:14:23', '15:14:23'],
  ['1757', '2026-08-11', '测试炒萝卜', '计划烹饪', '批次 1', '其他', '1', '133', '炒菜机', '取餐完成', '15:37:08', '15:50:28', '15:50:43'],
  ['1760', '2026-08-11', '烤箱测试', '计划烹饪', '批次 1', '其他', '6', '120', '烤箱', '出餐完成', '16:12:11', '16:35:56', '-'],
  ['1759', '2026-08-11', '炒菜机测试', '计划烹饪', '批次 2', '其他', '2', '400', '炒菜机', '作废', '16:11:10', '-', '-'],
  ['1758', '2026-08-11', '炒菜机测试', '计划烹饪', '批次 2', '其他', '2', '400', '炒菜机', '作废', '16:09:44', '-', '-'],
  ['1755', '2026-08-11', '炒菜机测试', '计划烹饪', '批次 2', '其他', '1', '200', '炒菜机', '作废', '11:42:50', '-', '-'],
] as const;

function ProductionOrdersPage({ go }: { go: (page: Page) => void }) {
  const fields = [['工单ID：', '请输入工单ID'], ['餐品名称：', '请输入餐品名称'], ['模式', '全部'], ['餐段', '全部'], ['状态', '全部'], ['烹饪设备', '全部']];
  const columns = ['ID', '日期', '餐品名称', '模式', '批次', '餐段', '餐品盆数', '餐品份数', '烹饪设备', '状态', '开始时间', '出餐完成时间', '取餐完成时间', '操作'];
  return <div className="orders-viewport">
    <aside className="orders-sidebar"><strong>首页</strong><section><b>生产管理</b><i>⌃</i><button className="active">生产工单</button><button>现场调度</button><button>行为监控</button></section>{['设备管理', '工艺管理', '餐品管理', '权限管理'].map((item) => <button className="orders-menu" key={item}>{item}<i>⌄</i></button>)}</aside>
    <main className="orders-main"><header className="orders-topbar"><div className="orders-crumb"><b>☰</b><strong>首页</strong><span>/</span><strong>生产管理</strong><span>/</span><em>生产工单</em></div><div className="orders-canteen">当前食堂：测试专用 - 中石油陇东 <button>切换食堂　⌄</button><i>熙<br />香</i><span>⌄</span></div></header><div className="orders-tabs"><span>首页</span><b>● 生产工单　×</b></div>
      <section className="orders-filter"><h2>◯筛选</h2><div className="orders-filter-actions"><button>重置</button><button className="primary">搜索</button></div><div className="orders-fields">{fields.map(([label, placeholder], index) => <label key={label} className={`orders-field field-${index}`}><span>{label}</span><div>{placeholder}{index > 1 && <i>⌄</i>}</div></label>)}<label className="orders-date"><span>生产日期：</span><div>▣　　2026-08-11　　至　　2026-08-11</div></label></div></section>
      <section className="orders-list"><header><h2>▣生产工单列表</h2><button>按出餐时间排序　⌄</button></header><table><thead><tr>{columns.map((column) => <th key={column} data-annotation-id={column === '批次' ? 'annotation-37' : undefined}>{column}</th>)}</tr></thead><tbody>{productionOrders.map((row) => <tr key={row[0]}>{row.map((value, index) => <td className={index === 9 ? (value === '作废' ? 'order-invalid' : 'order-finished') : ''} key={`${row[0]}-${index}`}>{value}</td>)}<td><button type="button" className="order-view" onClick={() => go('work-order-detail')}>查看</button></td></tr>)}</tbody></table><footer><span>共 6 条</span><button>20条/页　⌄</button><button disabled>‹</button><button className="current">1</button><button disabled>›</button><span>前往</span><input value="1" readOnly /><span>页</span></footer></section>
    </main>
  </div>;
}

function WorkOrderDetailPage({ go }: { go: (page: Page) => void }) {
  const tabs = ['餐品信息', '称重记录', '加料记录', '摆盆记录', '烹饪记录', '出餐记录'];
  return <div className="work-order-detail-viewport">
    <aside className="orders-sidebar"><strong>首页</strong><section><b>生产管理</b><i>⌃</i><button className="active">生产工单</button><button>现场调度</button><button>行为监控</button></section>{['设备管理', '工艺管理', '餐品管理', '权限管理'].map((item) => <button className="orders-menu" key={item}>{item}<i>⌄</i></button>)}</aside>
    <main className="work-order-detail-main"><header className="orders-topbar"><div className="orders-crumb"><b>☰</b><strong>首页</strong><span>/</span><strong>生产管理</strong><span>/</span><em>工单详情</em></div><div className="orders-canteen">当前食堂：测试专用 - 中石油陇东 <button>切换食堂　⌄</button><i>熙<br />香</i><span>⌄</span></div></header><div className="orders-tabs work-order-detail-top-tabs"><span>首页</span><span>生产工单　×</span><b>● 工单详情　×</b></div>
      <section className="work-order-detail-content"><h1>查看工单</h1><p className="work-order-dish-name">餐品名称： 炒菜机测试</p><div className="work-order-summary"><div><p>工单号： 1756</p><p>餐品生产： 单独生产</p><p>生产日期： 2026-08-11</p><p>批次： 批次 1</p></div><div><p>工单状态： <strong>取餐完成</strong></p><p>烹饪设备： 炒菜机</p><p>开始时间： 15:05:41</p></div><div><p>所用模式： 临时加菜</p><p>餐品盆数： 1</p><p>出餐完成时间： 15:14:23</p></div><div><p>所属餐段： 其他</p><p>餐品份数： 200</p><p>取餐完成时间： 15:14:23</p></div></div>
        <nav className="work-order-detail-tabs">{tabs.map((tab, index) => <button className={index === 0 ? 'active' : ''} type="button" key={tab}>{tab}</button>)}</nav>
        <table className="work-order-detail-table"><thead><tr><th>餐品</th><th>SOP名称</th><th>餐品盆数</th><th>餐品份数</th><th>烹饪流程</th><th>容器</th><th>食材</th><th>调料</th><th>烹饪设备、设备类型<br />和烹饪程序</th></tr></thead><tbody><tr><td rowSpan={2}>炒菜机测试</td><td rowSpan={2}>炒菜机不加调料</td><td rowSpan={2}>1</td><td rowSpan={2}>200</td><td rowSpan={2}>烹饪流程1</td><td>1/1份盆200高</td><td>萝卜5000g</td><td>无需加料</td><td rowSpan={2}>第1次烹饪：炒菜机-<br />隆泽0.8米炒菜机(炒菜<br />机测试)</td></tr><tr><td>1/1份盆200高</td><td>土豆5000g</td><td>无需加料</td></tr></tbody></table>
      </section><button className="work-order-detail-close" type="button" onClick={() => go('blank-1')}>关闭</button>
    </main>
  </div>;
}

function AiMenuPage() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [weeks, setWeeks] = useState([true, true, false, false]);
  const [equipment, setEquipment] = useState([true, true]);
  const [preferences, setPreferences] = useState([false, false]);
  const toggle = (setter: React.Dispatch<React.SetStateAction<boolean[]>>, index: number) => setter((items) => items.map((value, itemIndex) => itemIndex === index ? !value : value));
  const daysOfWeek = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const planDays = ['周一（08/10）', '周二（08/11）', '周三（08/12）', '周四（08/13）', '周五（08/14）', '周六（08/15）', '周日（08/16）'];
  const planMeals = ['早餐', '午餐', '晚餐'];
  const weekRanges = ['08/10~08/16', '08/17~08/23', '08/24~08/30', '08/31~09/06'];
  return <div className="ai-menu-page">
    <header className="ai-menu-topbar"><strong>熙香AI食堂 <i /> 智能管理后台</strong><button>test-验证食堂 <span>⌄</span></button><div><span>♟</span> CXY　⏻</div></header>
    <aside className="ai-menu-side"><section><button>♧　生产管理 <i>⌃</i></button><a>餐段设置</a><a className="active">每周菜单</a><a>排产计划</a><a>原料需订量</a><a>生产设置</a></section>{['食堂订货', '系统管理'].map((item) => <button key={item}>▣　{item}<i>⌄</i></button>)}</aside>
    <main className="ai-menu-content"><header><h1>单品生产计划</h1><div><button className="mint" onClick={() => setOpen(true)}>AI生成菜单</button><button>导出</button><button>编辑</button><button className="blue">复制同周菜单</button></div></header><section className="ai-menu-plan"><nav>{['本周', '下周', '第三周', '第四周'].map((item, index) => <button className={index === 0 ? 'selected' : ''} key={item}>{item}<br /><b>{weekRanges[index]}</b></button>)}</nav><div className="ai-menu-days"><div className="ai-menu-grid-head">{planDays.map((day) => <strong key={day}>{day}</strong>)}</div><div className="ai-menu-grid-row ai-empty-row">{planDays.map((day) => <article key={day}><b>宵夜</b><span>◯<small>无此餐段</small></span></article>)}</div><div className="ai-menu-grid-row ai-empty-row">{planDays.map((day) => <article key={day}><b>其他</b><span>◯<small>无此餐段</small></span></article>)}</div>{planMeals.map((meal) => <div className="ai-menu-grid-row" key={meal}>{planDays.map((day, dayIndex) => <article key={day}>{meal === '早餐' || dayIndex < 4 ? <button className="ai-add-meal"><b>{meal}</b><small>点击添加菜单</small></button> : <div className={`ai-planned-status ${meal === '晚餐' && dayIndex > 4 ? 'orange' : meal === '午餐' && dayIndex > 4 ? 'red' : ''}`}><b>● {meal} ({meal === '晚餐' && dayIndex > 4 ? 8 : 10})</b><small>已有单品生产计划</small></div>}</article>)}</div>)}</div></section></main>
    {open && <div className="ai-menu-mask"><section className="ai-menu-modal" role="dialog" aria-modal="true" aria-label="AI生成菜单"><header><h2>AI生成菜单</h2></header><div className="ai-menu-form">
      <label><span>餐品菜系</span><div className="fake-select"><b>湘菜</b><b>家常菜</b><i>⌄</i></div></label>
      <label><span>餐品口味</span><div className="fake-select"><b>咸鲜</b><b>辣</b><i>⌄</i></div></label>
      <label className="ratio"><span><em>*</em> 荤素比例　大荤：小荤：蔬菜 =</span><div><input placeholder="请输入" />：<input placeholder="请输入" />：<input placeholder="请输入" /></div></label>
      <div className="cycle-row"><span><em>*</em> 生成周期</span>{['本周(04/06~04/12)', '下周(04/13~04/19)', '第三周(04/20~04/26)', '第四周(04/27~05/03)'].map((item, index) => <label key={item}><input type="checkbox" checked={weeks[index]} onChange={() => toggle(setWeeks, index)} /> {item}</label>)}</div>
      <div className="ai-menu-cycle" role="table" aria-label="菜单生成周期"><div className="ai-menu-cycle-row ai-menu-cycle-head" role="row"><span className="cycle-week" /><span className="cycle-meal" />{daysOfWeek.map((day) => <label key={day} role="columnheader"><input type="checkbox" defaultChecked />{day}</label>)}</div>{['本周', '下周'].flatMap((week) => ['午餐', '晚餐'].map((meal, index) => <div className="ai-menu-cycle-row" role="row" key={`${week}-${meal}`}>{index === 0 ? <span className="cycle-week" role="rowheader">{week}</span> : <span className="cycle-week continued" aria-hidden="true" />}<label className="cycle-meal"><input type="checkbox" defaultChecked />{meal}</label>{daysOfWeek.map((day, dayIndex) => <span role="cell" key={day} className={dayIndex > 4 && meal === '晚餐' ? 'disabled' : ''}>{dayIndex === 1 && week === '本周' && meal === '午餐' ? <b>已有菜单　✓</b> : dayIndex > 4 && meal === '晚餐' ? '无此餐段' : '✓'}</span>)}</div>))}</div>
      <div className="diner-count-row" data-annotation-id="annotation-41"><span>就餐人数</span><input placeholder="请输入" /></div>
      <div className="quantity-row"><span><em>*</em> 餐品数量</span>{['宵夜', '其他', '早餐', '午餐', '晚餐'].map((meal, index) => <label className={index < 2 ? 'disabled' : ''} key={meal}>{meal}<input placeholder="请输入" disabled={index < 2} /></label>)}</div>
      <div className="choice-row"><span><em>*</em> 烹饪设备</span>{['烤箱', '炒菜机'].map((item, index) => <label key={item}><input type="checkbox" checked={equipment[index]} onChange={() => toggle(setEquipment, index)} /> {item}</label>)}</div>
      <div className="choice-row"><span><em>*</em> 菜单偏好</span>{['效率最高(生产时间短)', '口味最佳(餐品维度评分最高)'].map((item, index) => <label key={item}><input type="checkbox" checked={preferences[index]} onChange={() => toggle(setPreferences, index)} /> {item}</label>)}</div>
      <div className="setting-row" data-annotation-id="annotation-42"><span>烹饪时限 <i title="输入大于 0 的整数" aria-label="输入大于 0 的整数" data-tooltip="输入大于 0 的整数">?</i></span><label><input type="number" min="1" step="1" /> 分钟</label></div>
      <div className="setting-row" data-annotation-id="annotation-39"><span>设备比例</span><div className="device-ratio-inputs"><input type="number" min="0" aria-label="烤箱比例" />：<input type="number" min="0" aria-label="炒菜机比例" /></div></div>
    </div><footer>{notice && <small>{notice}</small>}<button className="cancel" onClick={() => setOpen(false)}>取消</button><button className="create" onClick={() => setNotice('菜单生成任务已提交')}>AI生成菜单</button></footer></section></div>}
  </div>;
}

function BlankPage({ page, go }: { page: Page; go: (page: Page) => void }) {
  if (page === 'blank-1') return <ProductionOrdersPage go={go} />;
  if (page === 'work-order-detail') return <WorkOrderDetailPage go={go} />;
  if (page === 'blank-2') return <WeighingPage go={go} />;
  if (page === 'blank-3') return <DashboardPage />;
  if (page === 'blank-5') return <AiMenuPage />;
  if (page !== 'blank-4') return <div aria-label="空白页面" />;
  const devices = [
    { name: '移动门', state: '已关门', action: '开门', icon: 'door' },
    { name: '烤箱1号', state: '暂无任务', subState: '已关门', action: '开门', icon: 'oven' },
    { name: '炒菜机1号', state: '暂无任务', action: '', icon: 'wok' },
  ];
  const tasks = [
    { badge: '计划排产', title: '烤肉', status: '预热完成', action: '开门' },
    { badge: '临时加菜', title: '烤肉', status: '摆盆完成', action: '开始预热' },
    { badge: '临时加菜', title: '辣椒炒肉', status: '摆盆完成', action: '开始烹饪' },
  ];
  return <div className="mobile-schedule-page">
    <div className="mobile-phone">
      <div className="mobile-status"><span>12:00</span><span className="mobile-icons"><i /><i /><i /></span></div>
      <section className="mobile-device-card">
        {devices.map((device) => <div className="mobile-device" key={device.name}>
          <div className={`mobile-device-icon ${device.icon}`} />
          <strong>{device.name}</strong>
          <span>{device.state}</span>
          {device.subState && <span>{device.subState}</span>}
          {device.action && <button>{device.action}</button>}
        </div>)}
      </section>
      <div className="mobile-list-head"><h2>今日排产</h2><select defaultValue="早餐" aria-label="餐段"><option>早餐</option></select></div>
      <section className="mobile-task-list">
        {tasks.map((task, index) => <article className="mobile-task-card" key={`${task.title}-${index}`}>
          <div className="mobile-task-photo"><span>{task.badge}</span></div>
          <div className="mobile-task-info"><div className="mobile-task-title-row"><h3>{task.title}</h3>{task.badge === '计划排产' && <span className="mobile-batch-badge" data-annotation-id="annotation-33">批次 1</span>}</div><p>版本：{task.title}300人份</p><p>份量：10KG/300份</p><em>{task.status}</em></div>
          <button>{task.action}</button>
        </article>)}
      </section>
      <nav className="mobile-bottom-nav">
        <button className="active"><span className="calendar-icon" />今日排产</button>
        <button><span className="gear-icon" />设置</button>
      </nav>
      <div className="mobile-home-indicator" />
    </div>
  </div>;
}

function getPageAnnotationSource(page: Page): AnnotationSourceDocument {
  const source = JSON.parse(JSON.stringify(annotationSourceDocument)) as AnnotationSourceDocument;
  if (!source.data) return source;
  const pageNodes = source.data.nodes.filter((node) => Array.isArray(node.pageId) ? node.pageId.includes(page) : node.pageId === page);
  source.data = { ...source.data, pageId: page, nodes: pageNodes.map((node, index) => ({ ...node, index: index + 1 })) };
  return source;
}

  export default function IntelligentScheduling() { const { page: routePage, setPage } = useHashPage(pageRoute); const page = (routePage as Page); const [deliveryDate, setDeliveryDate] = useState('2026-07-15T06:00:00'); const go = (next: Page) => setPage(next); useEffect(() => { window.scrollTo(0, 0); }, [page]); const annotationSource = useMemo(() => getPageAnnotationSource(page), [page]); const content = useMemo(() => { if (page === 'version' || page === 'flow' || page === 'semantic') return <PlainPage page={page} />; if (page === 'blank-1' || page === 'work-order-detail' || page === 'blank-2' || page === 'blank-3' || page === 'blank-4' || page === 'blank-5') return <BlankPage page={page} go={go} />; if (page === 'menu') return <MenuPage go={go} />; if (page === 'assistant-menu-no-meal') return <AssistantPage type="menu" noMeal staticDisplay go={go} />; if (page === 'assistant-menu-flow' || page === 'backup-assistant-menu-flow') return <AssistantPage key={page} type="menu" flow={page === 'assistant-menu-flow'} staticDisplay={page === 'assistant-menu-flow'} go={go} />; if (page === 'assistant-menu' || page === 'assistant-menu-failure' || page === 'backup-assistant-menu') return <AssistantPage key={page} type="menu" staticDisplay={page === 'assistant-menu-failure'} go={go} />; if (page === 'view-menu') return <ViewMenu go={go} />; if (page === 'assistant-schedule' || page === 'backup-assistant-schedule') return <AssistantPage key={page} type="schedule" go={go} />; if (page === 'purchase') return <PurchasePage go={go} />; if (page === 'list') return <ListPage go={go} deliveryDate={deliveryDate} setDeliveryDate={setDeliveryDate} />; if (page === 'confirm') return <ConfirmPage go={go} deliveryDate={deliveryDate} />; if (page === 'success') return <SuccessPage go={go} />; if (page === 'failure') return <FailurePage go={go} />; return <SchedulePage go={go} />; }, [page, deliveryDate]); return <>
  <Shell page={page} go={go}>{content}</Shell>
  <AnnotationViewer
    source={annotationSource}
    options={{
      currentPageId: page,
      toolbarEdge: 'right',
      defaultMarkerIndexVisible: true,
      showToolbar: true,
      showThemeToggle: true,
      showColorFilter: true,
      emptyWhenNoData: true,
    }}
  />
  <RequirementOverviewDrawer source={annotationSource} currentPageId={page} />
</>; }
