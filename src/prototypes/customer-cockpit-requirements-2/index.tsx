/**
 * @name 客户驾驶舱需求 2
 *
 * 数据口径：本页全部为**静态结构演示数据**，未接入任何真实系统。
 * 按 PRD 对齐：
 * - PRD:129 / AC08：演示数据显式标注；无数据源时不显示「实时连接」「设备运行中」等无依据状态。
 * - PRD:189：不显示虚构的任务百分比、当前批次或剩余时间；说明性动画标注为「流程演示」。
 * - PRD:32：未接入数据不显示为实时数据。
 * - PRD:111：数量未知时不显示数量。
 * 今日出餐量采用“演示动态”递增，用于展示实际 / 计划 / 完成率的联动；
 * 增量与料箱到达出口的时刻绑定，现场接入后由真实出餐事件替换。
 *
 * 页内切换：顶部提供「总览 / 营养健康 / 出餐统计 / 行为监控」视图（本页演示讲解用，
 * 与 PRD 中由 iPad 切页的五页体系并行，不替代该体系）。
 * 智厨生产驾驶舱通过 page=overview 进入；旧的 process / equipment 链接会兼容回落到这个合并页。
 * 行为监控视图的数据口径见 ./components/BehaviorView.tsx。
 */
import React, { useEffect, useRef, useState } from 'react';
import { BehaviorView } from './components/BehaviorView';
import './style.css';
import kitchenImage from './assets/realtime-kitchen-generated.png';
import dishMilletPumpkinPorridge from './assets/dish-millet-pumpkin-porridge.png';
import dishSteamedEggCustard from './assets/dish-steamed-egg-custard.png';
import dishShiitakeBokChoy from './assets/dish-shiitake-bok-choy.png';
import dishGreenPepperPork from './assets/dish-green-pepper-pork.png';
import dishTomatoScrambledEgg from './assets/dish-tomato-scrambled-egg.png';
import dishBraisedBeefPotato from './assets/dish-braised-beef-potato.png';
import dishDryPotCauliflower from './assets/dish-dry-pot-cauliflower.png';
import dishStirFriedBeefCelery from './assets/dish-stir-fried-beef-celery.png';
import dishChiveMungBeanSprout from './assets/dish-chive-mung-bean-sprout.png';
import dishOysterSauceBeef from './assets/dish-oyster-sauce-beef.png';
import dietPagoda3d from './assets/diet-pagoda-3d.png';

const DISH_IMAGES: Record<string, string> = {
  小米南瓜粥: dishMilletPumpkinPorridge,
  蒸蛋羹: dishSteamedEggCustard,
  香菇青菜: dishShiitakeBokChoy,
  青椒肉丝: dishGreenPepperPork,
  番茄炒蛋: dishTomatoScrambledEgg,
  土豆烧牛肉: dishBraisedBeefPotato,
  干锅花菜: dishDryPotCauliflower,
  小炒黄牛肉: dishStirFriedBeefCelery,
  韭菜绿豆芽: dishChiveMungBeanSprout,
  蚝油牛柳: dishOysterSauceBeef,
};

type MealSegment = '早餐' | '午餐' | '晚餐' | '宵夜' | '其他';
/** 「颜色建议」用的三色标签（用户口径：只做三种颜色的示例）。
    原本按《中国居民膳食指南》五色食物（白/绿/红/黄/黑）分类，现按需求收敛到三色：
    绿=蔬菜类、黄=蛋类与谷薯、红=畜肉类。
    一道菜只打**一个**色 —— 它要占今日菜单卡上的一行；归类锚点是 `ingredients[0]`（第一主料）。
    自检：绿 4（香菇青菜/番茄炒蛋/干锅花菜/韭菜绿豆芽）、黄 2（小米南瓜粥/蒸蛋羹）、红 4（青椒肉丝/土豆烧牛肉/小炒黄牛肉/蚝油牛柳）；
          「建议频次」不放在这里，而是由颜色推导（见 FOOD_COLOR_ADVICE），避免同一颜色出现两个频次。 */
type FoodColor = '绿' | '黄' | '红';
type Dish = { segment: MealSegment; name: string; done: number; total: number; onTimeDone: number; color: string; device: string; feedKg?: number; productionKg?: number; ingredients: string[]; seasonings: string[]; foodColor: FoodColor; nutrition: { energy: number; protein: number; fat: number; carbs: number; fiber: number; cholesterol: number } };
type Machine = { id: string; dish: string; state: string; color: string; model?: string };
type OutItem = { port: string; dish: string; qty: string; color: string };
type WorkOrderStatus = '未开始' | '待称重' | '称重中' | '待加料' | '加料中' | '称重加料完成' | '待摆盆' | '摆盆中' | '摆盆完成' | '待烹饪' | '预热中' | '烹饪中' | '烹饪完成' | '开始出餐' | '出餐完成' | '取餐中' | '取餐完成' | '已作废';
const LINE_CYCLE_MS = 14_000;

/** feedKg = 称重加料区实测投料量（kg）。演示口径，非客户现场数据。
    自检：合计 82.0 kg ÷ 26 盆 ≈ 3.2 kg/盆，与盆量级吻合。

    device = 这道菜固定的生产设备（整机park：2 台炒菜机 + 1 台烤箱）。
    演示口径：一天内一道菜只在一台设备上分批生产，不换机，所以「生产进度」每行都能给出设备。
    注意：青椒肉丝 / 番茄炒蛋 / 蒸蛋羹的 device 必须与 COCKPIT_MACHINES 里同菜名的 id 一致，
    否则「生产进度」显示的设备会和上方动线动画里托盘停靠的设备对不上。

    ingredients = 主料（品牌公示的名单由它推导，见 INGREDIENT_BRANDS）；
    seasonings  = 调料（只用于「配方示例」口径，不进品牌公示）。
    nutrition  = 熟制成品每100g的估算营养值
                 （能量 kcal / 蛋白质·脂肪·碳水·膳食纤维 g / 胆固醇 mg）；
                 参考《中国食物成分表》单种食材数据，按示例菜谱比例估算，不代表实测。
    自检：能量约等于 4×蛋白质 + 9×脂肪 + 4×碳水；实际值还会随菜谱比例和熟制出成率变化。
    膳食纤维：蔬菜类的「香菇青菜 / 韭菜绿豆芽 / 干锅花菜」明显高一档（1.9~2.2g），蛋奶肉类接近 0；
              这样单品卡上的纤维值才随菜变化，不然 10 道菜这一格全一样，轮播就白播了。
    胆固醇：只有含蛋和畜肉的高（蒸蛋羹 185、番茄炒蛋 152 最高，五花肉/牛肉类 36~56），
            纯蔬菜两道为 0。与「膳食纤维」正好一高一低，两格形成对照。

    foodColor = 「今日菜单」菜品卡上「颜色建议」那一行的色标：只取三种颜色，
    归类锚点是 `ingredients[0]`（第一主料），不看配菜和调料。
    这一行显示的建议频次**不写在这里** —— 它由颜色推导（绿=每餐、黄=每天、红=每周 2-3 次，见 FOOD_COLOR_ADVICE），
    这样同一颜色在 10 张卡上不会出现两个频次。 */
const DISHES: Dish[] = [
  { segment: '早餐', name: '小米南瓜粥', device: '炒菜机 CCJ1', done: 2, total: 2, onTimeDone: 2, color: '#e0a629', feedKg: 9.8, ingredients: ['小米', '南瓜'], seasonings: ['白糖'], foodColor: '黄', nutrition: { energy: 45, protein: 1.1, fat: 0.2, carbs: 9.8, fiber: 0.6, cholesterol: 0 } },
  { segment: '早餐', name: '蒸蛋羹', device: '烤箱 KX1', done: 2, total: 3, onTimeDone: 2, color: '#079f96', feedKg: 5.2, productionKg: 4.8, ingredients: ['鸡蛋', '饮用水'], seasonings: ['盐', '香油'], foodColor: '黄', nutrition: { energy: 57, protein: 5.1, fat: 3.5, carbs: 1.2, fiber: 0, cholesterol: 185 } },
  { segment: '早餐', name: '香菇青菜', device: '炒菜机 CCJ2', done: 3, total: 3, onTimeDone: 3, color: '#e85d75', feedKg: 8.7, ingredients: ['香菇', '青菜'], seasonings: ['食用油', '盐'], foodColor: '绿', nutrition: { energy: 56, protein: 2.0, fat: 3.5, carbs: 4.0, fiber: 2.2, cholesterol: 0 } },
  { segment: '午餐', name: '青椒肉丝', device: '炒菜机 CCJ1', done: 4, total: 4, onTimeDone: 4, color: '#3b8be0', feedKg: 13.2, productionKg: 12.6, ingredients: ['猪肉', '青椒'], seasonings: ['生抽', '料酒', '淀粉'], foodColor: '红', nutrition: { energy: 121, protein: 10.0, fat: 7.0, carbs: 4.5, fiber: 1.0, cholesterol: 48 } },
  { segment: '午餐', name: '番茄炒蛋', device: '炒菜机 CCJ2', done: 4, total: 4, onTimeDone: 4, color: '#42a885', feedKg: 12.8, productionKg: 12.4, ingredients: ['番茄', '鸡蛋'], seasonings: ['食用油', '盐', '糖'], foodColor: '绿', nutrition: { energy: 105, protein: 5.5, fat: 7.3, carbs: 4.4, fiber: 0.7, cholesterol: 152 } },
  { segment: '午餐', name: '土豆烧牛肉', device: '烤箱 KX1', done: 3, total: 4, onTimeDone: 2, color: '#9367d8', feedKg: 9.6, ingredients: ['牛肉', '土豆'], seasonings: ['生抽', '老抽', '八角'], foodColor: '红', nutrition: { energy: 136, protein: 10.5, fat: 7.0, carbs: 8.0, fiber: 0.9, cholesterol: 42 } },
  { segment: '午餐', name: '干锅花菜', device: '炒菜机 CCJ1', done: 3, total: 4, onTimeDone: 3, color: '#f09a4b', feedKg: 8.4, ingredients: ['花菜', '五花肉'], seasonings: ['干锅酱', '辣椒', '大蒜'], foodColor: '绿', nutrition: { energy: 151, protein: 5.5, fat: 11.0, carbs: 7.5, fiber: 2.0, cholesterol: 36 } },
  { segment: '晚餐', name: '小炒黄牛肉', device: '炒菜机 CCJ2', done: 2, total: 3, onTimeDone: 2, color: '#6f8fe8', feedKg: 6.4, ingredients: ['黄牛肉', '辣椒', '芹菜'], seasonings: ['生抽', '蚝油', '豆豉'], foodColor: '红', nutrition: { energy: 147, protein: 13.5, fat: 8.5, carbs: 4.0, fiber: 0.8, cholesterol: 56 } },
  { segment: '晚餐', name: '韭菜绿豆芽', device: '炒菜机 CCJ1', done: 2, total: 3, onTimeDone: 1, color: '#d879b0', feedKg: 4.8, ingredients: ['韭菜', '绿豆芽'], seasonings: ['食用油', '盐'], foodColor: '绿', nutrition: { energy: 50, protein: 2.5, fat: 2.7, carbs: 3.8, fiber: 1.9, cholesterol: 0 } },
  { segment: '晚餐', name: '蚝油牛柳', device: '炒菜机 CCJ2', done: 1, total: 3, onTimeDone: 1, color: '#56a66f', feedKg: 3.1, ingredients: ['牛柳', '青椒'], seasonings: ['蚝油', '生抽', '黑胡椒'], foodColor: '红', nutrition: { energy: 131, protein: 12.0, fat: 7.0, carbs: 5.0, fiber: 0.5, cholesterol: 52 } },
];

/** 每盆约 140 份。内部进度仍以份计，界面按此比例向上取整为整盆。 */
const PORTIONS_PER_TRAY = 140;
const portionsToTrays = (portions: number) => Math.max(0, Math.ceil(portions / PORTIONS_PER_TRAY));
const formatTrays = (portions: number) => portionsToTrays(portions).toLocaleString('zh-CN');
/** 今日计划总份数（演示口径：33 盆 × 140 份 = 4620 份）。
    注意这里仍是**全天**口径 —— 出餐量的推进与出餐率用它；
    「生产进度」面板已改成只统计当前餐段，那三个格子由 segmentDishes 现场加，不读这两个常量。
    今日菜单的「当前已完成」按全天菜品任务的 done 汇总，用于餐品统计图；生产进度面板仍按当前餐段单独统计。 */
const TOTAL_PRODUCTION_TRAYS = DISHES.reduce((sum, dish) => sum + dish.total, 0);
const COMPLETED_PRODUCTION_TRAYS = DISHES.reduce((sum, dish) => sum + dish.done, 0);
const TOTAL_PLAN = TOTAL_PRODUCTION_TRAYS * PORTIONS_PER_TRAY;
const TOTAL_FEED_KG = DISHES.reduce((sum, dish) => sum + (dish.feedKg ?? 0), 0);
const COMPLETED_FEED_KG = DISHES.reduce((sum, dish) => sum + (dish.feedKg ?? 0) * (dish.done / Math.max(dish.total, 1)), 0);
const formatKg = (kg: number) => `${kg.toFixed(1)} kg`;
const formatDishWeight = (dish: Dish) => dish.feedKg == null ? '—' : `${(dish.feedKg * (dish.done / Math.max(dish.total, 1))).toFixed(1)}/${dish.feedKg.toFixed(1)}kg`;
/** 今日出餐初始值（演示口径，随后按动线到达出口的批次递增） */
const SERVED = 3182;
const DEMO_TEMPORARY_ADD_ORDERS = 0;

/* 「烹饪中」菜的实时烹饪信息（已烹饪时长 / 总时长 / 设备温度），随产线时钟实时推进。
   总时长与目标温度按菜写死（现实口径）：炒菜类 ~190℃、烤箱 ~160℃、蒸/粥 ~100℃。
   已烹饪时间随 cookPhase（见组件内）推进；设备温度围绕目标值小幅波动，
   不做单向升温，避免演示画面一直往上加。 */
const COOK_DURATION_SEC: Record<string, number> = {
  小米南瓜粥: 25 * 60, 蒸蛋羹: 12 * 60, 香菇青菜: 6 * 60,
  青椒肉丝: 8 * 60, 番茄炒蛋: 6 * 60, 土豆烧牛肉: 40 * 60, 干锅花菜: 8 * 60,
  小炒黄牛肉: 8 * 60, 韭菜绿豆芽: 4 * 60, 蚝油牛柳: 8 * 60,
};
const COOK_TARGET_TEMP: Record<string, number> = {
  小米南瓜粥: 98, 蒸蛋羹: 100, 香菇青菜: 180,
  青椒肉丝: 190, 番茄炒蛋: 180, 土豆烧牛肉: 160, 干锅花菜: 190,
  小炒黄牛肉: 190, 韭菜绿豆芽: 185, 蚝油牛柳: 190,
};

/** 近 7 天出餐趋势（演示口径）。v = 当日出餐份数，最后一天以当前今日出餐量更新。
    柱高不手写，由 v 按峰值归一化推导——否则「柱子高矮」和「柱顶数字」很容易自相矛盾。
    自检：今日 3182 vs 去年同期 ↑12.4% → 去年同期应为 3182 / 1.124 ≈ 2831，量级吻合。 */
const SPARK_TREND = [
  { label: '09-17', v: 2386 },
  { label: '09-18', v: 2584 },
  { label: '09-19', v: 2287 },
  { label: '09-20', v: 2783 },
  { label: '09-21', v: 2650 },
  { label: '09-22', v: 2915 },
  { label: '09-23', v: SERVED },
];

const SPARK_MAX_H = 70;

const MACHINES: Machine[] = [
  { id: '炒菜机 CCJ1', dish: '青椒肉丝', state: '烹饪中', color: '#3b8be0' },
  { id: '炒菜机 CCJ2', dish: '番茄炒蛋', state: '烹饪中', color: '#42a885' },
  { id: '烤箱 KX1', dish: '蒸蛋羹', state: '待出餐', color: '#079f96' },
];

const COCKPIT_MACHINES: Machine[] = [
  { id: '炒菜机 CCJ1', model: '600', dish: '青椒肉丝', state: '烹饪中', color: '#3b8be0' },
  { id: '炒菜机 CCJ2', model: '800', dish: '番茄炒蛋', state: '烹饪中', color: '#42a885' },
  { id: '烤箱 KX1', dish: '蒸蛋羹', state: '待出餐', color: '#079f96' },
];

const OUTFLOW: OutItem[] = [
  { port: '出口 1', dish: '香菇青菜', qty: '1 盆 / 1kg', color: '#e85d75' },
  { port: '出口 1', dish: '番茄炒蛋', qty: '1 盆 / 2kg', color: '#42a885' },
  { port: '出口 1', dish: '青椒肉丝', qty: '1 盆 / 1kg', color: '#3b8be0' },
  { port: '出口 1', dish: '小米南瓜粥', qty: '1 盆 / 1kg', color: '#e0a629' },
  { port: '出口 1', dish: '蒸蛋羹', qty: '1 盆 / 2kg', color: '#079f96' },
];

/** 原料品牌公示（演示口径）：食堂要在公示屏上亮明主要原料的品牌与供货渠道。
    名单**不写死**，由今日菜品的 ingredients 去重推导（按首次出现顺序）——
    公示的原料必须和「今日菜品营养」里用到的原料是同一批。写死的名单会随菜谱漂移，
    出现「菜谱写着青菜、公示写着小白菜」这种对不上的情况，是评审最容易逮住的不一致。
    品牌值沿用兄弟原型 canteen-digital-twin-cockpit / customer-cockpit-requirements 的公示口径
    （菜类「菜王 · 合作社供应」、猪肉「放心肉业 · 定点供应」），同一批货在不同原型里
    不能换牌子；只有那份公示里没有的新原料才另给品牌。 */
const INGREDIENT_BRAND_LOOKUP: Record<string, { brand: string; supplier: string }> = {
  小米: { brand: '沁州黄', supplier: '杂粮定点供应' },
  南瓜: { brand: '蜜本', supplier: '合作社供应' },
  鸡蛋: { brand: '正大', supplier: '定点供应' },
  香菇: { brand: '菇香源', supplier: '合作社供应' },
  青菜: { brand: '菜王', supplier: '合作社供应' },
  猪肉: { brand: '放心肉业', supplier: '定点供应' },
  青椒: { brand: '绿丰', supplier: '合作社供应' },
  番茄: { brand: '普罗旺斯', supplier: '合作社供应' },
  牛肉: { brand: '放心肉业', supplier: '定点供应' },
  土豆: { brand: '沃土', supplier: '合作社供应' },
  花菜: { brand: '绿丰', supplier: '合作社供应' },
  五花肉: { brand: '放心肉业', supplier: '定点供应' },
  黄牛肉: { brand: '放心肉业', supplier: '定点供应' },
  辣椒: { brand: '辣妹子', supplier: '合作社供应' },
  芹菜: { brand: '菜王', supplier: '合作社供应' },
  韭菜: { brand: '菜王', supplier: '合作社供应' },
  绿豆芽: { brand: '芽苗记', supplier: '自产泡发' },
  牛柳: { brand: '放心肉业', supplier: '定点供应' },
};

/** 不参与公示的原料：饮用水是生产介质，不是需要亮明品牌的主料。 */
const NON_DISCLOSED_INGREDIENTS = ['饮用水'];

const INGREDIENT_BRANDS = [...new Set(DISHES.flatMap((dish) => dish.ingredients))]
  .filter((name) => !NON_DISCLOSED_INGREDIENTS.includes(name))
  .map((name) => ({
    name,
    ...(INGREDIENT_BRAND_LOOKUP[name] ?? { brand: '待定', supplier: '待定' }),
  }));

const MEAL_ORDER: MealSegment[] = ['早餐', '午餐', '晚餐', '宵夜', '其他'];
const DISH_GROUPS = MEAL_ORDER.map((segment) => ({ segment, dishes: DISHES.filter((dish) => dish.segment === segment) })).filter((group) => group.dishes.length > 0);

/** 供餐时段（演示口径，含备餐与收尾）：「生产进度」只显示**现在这一餐**，餐段由页面时钟推导。
    早餐 04:00–10:29 · 午餐 10:30–15:29 · 晚餐 15:30–03:59（跨零点）。
    相邻两餐之间刻意不留空档 —— 现场这个时间本来就在备下一餐；留了空档就会出现
    「15:40 面板不知道该显示哪一餐」的空白，反而要再写一条兜底规则。
    演示菜谱没有宵夜菜（DISH_GROUPS 会把空餐段过滤掉），所以 21:00 之后仍归到晚餐段；
    接入真实排餐表后，这张表替换成按排餐表推导，界面不用动。
    秒级不用管：跨时段边界（如 15:30）时时钟下一跳就会切过去。 */
const MEAL_TIME_WINDOWS: Array<{ segment: MealSegment; start: number; end: number }> = [
  { segment: '早餐', start: 4 * 60, end: 10 * 60 + 29 },
  { segment: '午餐', start: 10 * 60 + 30, end: 15 * 60 + 29 },
  { segment: '晚餐', start: 15 * 60 + 30, end: 4 * 60 - 1 },
];

/** 由「当天第几分钟」推当前餐段。窗口首尾相接覆盖全天，所以一定能命中一个；
    晚餐段跨零点，用 start > end 识别，命中条件改成「或」。 */
function mealSegmentOf(minutesOfDay: number): MealSegment {
  const hit = MEAL_TIME_WINDOWS.find(({ start, end }) =>
    start <= end ? minutesOfDay >= start && minutesOfDay <= end : minutesOfDay >= start || minutesOfDay <= end,
  );
  return hit?.segment ?? '早餐';
}

const WORK_ORDER_STATUS_OPTIONS = ['全部', '未开始', '待称重', '称重中', '待加料', '加料中', '称重加料完成', '待摆盆', '摆盆中', '摆盆完成', '待烹饪', '预热中', '烹饪中', '烹饪完成', '开始出餐', '出餐完成', '取餐中', '取餐完成', '已作废'] as const;
const WORK_ORDER_SEGMENT_OPTIONS = ['全部', '早餐', '午餐', '晚餐', '宵夜', '其他'] as const;
const WORK_ORDER_MODE_OPTIONS = ['全部', '临时加菜', '计划烹饪'] as const;
type WorkOrderStatusFilter = typeof WORK_ORDER_STATUS_OPTIONS[number];
type WorkOrderSegmentFilter = typeof WORK_ORDER_SEGMENT_OPTIONS[number];
type WorkOrderModeFilter = typeof WORK_ORDER_MODE_OPTIONS[number];
const WORK_ORDER_STATUS_GROUPS: Array<{ label: string; options: WorkOrderStatus[] }> = [
  { label: '称重前', options: ['未开始'] },
  { label: '开始称重', options: ['待称重', '称重中', '待加料', '加料中', '称重加料完成'] },
  { label: '开始摆盆', options: ['待摆盆', '摆盆中', '摆盆完成'] },
  { label: '开始烹饪', options: ['待烹饪', '预热中', '烹饪中', '烹饪完成'] },
  { label: '烹饪结束后', options: ['开始出餐', '出餐完成', '取餐中', '取餐完成'] },
  { label: '工单作废', options: ['已作废'] },
];
const STATIC_WORKFLOW_STAGES = [
  { label: '称重前', value: 5, note: '未开始', color: '#70b5ff' },
  { label: '开始称重', value: 8, note: '待称重 / 称重中 / 待加料 / 加料中 / 称重加料完成', color: '#ff9700' },
  { label: '开始摆盆', value: 6, note: '待摆盆 / 摆盆中 / 摆盆完成', color: '#b58aff' },
  { label: '开始烹饪', value: 9, note: '待烹饪 / 预热中 / 烹饪中 / 烹饪完成', color: '#25e0ee' },
  { label: '烹饪结束后', value: 5, note: '开始出餐 / 出餐完成 / 取餐中 / 取餐完成', color: '#4ff0ad' },
] as const;
const STATIC_WORKFLOW_TOTAL = STATIC_WORKFLOW_STAGES.reduce((sum, item) => sum + item.value, 0);
const STATIC_VOID_ORDERS = 0;

/** 产线动线演示：主线到摆盆区后分流到具体设备，再汇入指定出口。
    演示批次只负责表达“路线如何走”，接入现场数据后由设备与出口 ID 替换。 */
const DEVICE_ROUTE_PATHS = [
  'M350 240 C395 240 420 186 458 162',
  'M350 240 C450 240 516 185 566 162',
  'M350 240 C400 240 450 280 510 318',
] as const;

const ACTIVE_ROUTE_PATHS = [
  // 三条路线都从投料区入口通道的**左边缘**（入口 1 x=74）驶入：先经过入口 1 的称重加料队列，
  // 再穿过入口 2 的称重加料等待通道，到岔路口（350,240）分流到各自设备，最后汇入出口 1。
  // 起点必须是通道左边缘 —— 托盘要先「进入入口」再显现，不允许在通道中段凭空冒出。
  // 三条路径长度接近（约 835），统一 14 秒节拍；在对应炒菜机或烤箱位置停留约 2.5 秒。
  // 停留点约束：keyPoints 中间值必须等于「该设备中心（CCJ1=458,162 / CCJ2=566,162 / KX1=510,318）
  // 在这条路径上的弧长比例」，否则托盘会在岔路口或半路停留（表现为「没进设备就出餐」）。
  // 当前值：CCJ1=0.4972、CCJ2=0.6273、KX1=0.5585，均由设备中心在路径上的最近点反算得出。
  // keyTimes 中间两帧 = 弧长比 × (14-2.5)/14、再 +2.5/14，保证托盘全程匀速且停留恒为 2.5 秒。
  // delay 让三段停留均匀错开：约 0s / 4.67s / 9.33s 各停 2.5 秒，任意时刻只有一台设备在烹饪。
  // trayStart/trayEnd = 托盘位于入口 2 通道（x 214~336）的时间区间，用来点亮入口 2 的等待卡片。
  { id: 'route-ccj1-out1', dish: '青椒肉丝', port: '出口 1', increment: 75, path: 'M74 190 C150 190 260 232 350 240 C395 240 420 186 458 162 C520 120 680 130 760 216 C790 240 820 240 850 240', delay: '-1.05s', trayStart: 0.14, trayEnd: 0.2609, pauseStart: 0.4084, pauseEnd: 0.587, keyPoints: '0;0.4972;0.4972;1', keyTimes: '0;0.4084;0.587;1' },
  { id: 'route-ccj2-out1', dish: '番茄炒蛋', port: '出口 1', increment: 75, path: 'M74 240 C160 240 265 240 350 240 C450 240 516 185 566 162 C640 150 710 180 760 220 C790 240 820 240 850 240', delay: '-7.21s', trayStart: 0.1423, trayEnd: 0.2652, pauseStart: 0.5152, pauseEnd: 0.6938, keyPoints: '0;0.6273;0.6273;1', keyTimes: '0;0.5152;0.6938;1' },
  { id: 'route-kx1-out1', dish: '蒸蛋羹', port: '出口 1', increment: 50, path: 'M74 300 C160 320 262 265 350 240 C400 240 450 280 510 318 C600 360 705 320 760 255 C785 240 820 240 850 240', delay: '-11.09s', trayStart: 0.1402, trayEnd: 0.2663, pauseStart: 0.4588, pauseEnd: 0.6374, keyPoints: '0;0.5585;0.5585;1' },
].map((route) => ({
  ...route,
  color: DISHES.find((dish) => dish.name === route.dish)?.color ?? '#10e4f2',
}));

/* 原「平均出餐时长」常量已移除。它是写死的演示值、没有任何计算逻辑，
   也不在 PRD 的运营驾驶舱指标清单里（PRD:194）。移除理由与「日后要放回需先定什么」
   记在 style.css 的 .uk-kpi 注释处。 */

type ViewId = 'cockpit' | 'behavior' | 'nutrition' | 'overview' | 'dish' | 'process' | 'equipment';

function readViewFromLocation(): ViewId {
  if (typeof window === 'undefined') return 'cockpit';
  const page = new URLSearchParams(window.location.search).get('page');
  if (page === 'behavior') return 'behavior';
  if (page === 'nutrition') return 'nutrition';
  if (page === 'dish') return 'dish';
  if (page === 'overview' || page === 'process' || page === 'equipment') return 'overview';
  return 'cockpit';
}

function normalizeViewId(id: string): ViewId {
  if (id === 'behavior') return 'behavior';
  if (id === 'nutrition') return 'nutrition';
  if (id === 'dish') return 'dish';
  if (id === 'overview' || id === 'process' || id === 'equipment') return 'overview';
  return 'cockpit';
}

const TOP_NAV_ITEMS: Array<{ id: ViewId; label: string }> = [
  { id: 'cockpit', label: '生产烹饪' },
  { id: 'nutrition', label: '营养健康' },
  /* 「计划与进度」→「出餐效率」→「计划达成」：这一页的定位改过两次，
     现在它回答的是「哪些批次、哪些菜没按计划」的跨餐段汇总。
     名字必须跟页内 h1 逐字一致，否则点进来看到的大标题跟刚点的词对不上。 */
  { id: 'overview', label: '出餐统计' },
  { id: 'behavior', label: '行为监控' },
];

function PageTopNav({ current, onNavigate }: { current: ViewId; onNavigate: (id: string) => void }) {
  return (
    <nav className="uk-switch uk-page-nav" aria-label="智厨页面切换">
      {TOP_NAV_ITEMS.map((item) => (
        <button
          type="button"
          key={item.id}
          className={current === item.id ? 'active' : ''}
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function TopHeader({ current, clock, onNavigate }: { current: ViewId; clock: string; onNavigate: (id: string) => void }) {
  return (
    <header className="uk-top">
      <div className="uk-brand">
        <div className="uk-logo">智</div>
        <div>
          <h1>智慧厨房驾驶舱</h1>
        </div>
      </div>
      <PageTopNav current={current} onNavigate={onNavigate} />
      <div className="uk-meta">
        <span className="uk-clock">{clock}</span>
      </div>
    </header>
  );
}

type CockpitModuleProps = {
  current: ViewId;
  clock: string;
  onNavigate: (id: string) => void;
  children: React.ReactNode;
};

function CockpitModuleShell({ current, clock, onNavigate, children }: CockpitModuleProps) {
  return (
    <div className="uk-module-page">
      <TopHeader current={current} clock={clock} onNavigate={onNavigate} />
      {children}
    </div>
  );
}

function ModuleKpi({ label, value, sideValue, note, meta, tone = '' }: { label: string; value: string; sideValue?: string; note?: string; meta?: React.ReactNode; tone?: string }) {
  return (
    <div className={`uk-module-kpi ${tone}`.trim()}>
      <span>{label}</span>
      <div className="uk-module-kpi-value-row">
        <b>{value}</b>
        {sideValue ? <strong>{sideValue}</strong> : null}
      </div>
      {meta ? <div className="uk-module-kpi-meta">{meta}</div> : note ? <small>{note}</small> : null}
    </div>
  );
}

type MultiSelectGroup = { label?: string; options: readonly string[] };

function MultiSelectFilter({ label, selected, groups, onChange }: { label: string; selected: readonly string[]; groups: readonly MultiSelectGroup[]; onChange: (values: string[]) => void }) {
  const isAllSelected = selected.includes('全部');
  const summary = isAllSelected ? '全部' : selected.length === 1 ? selected[0] : `${selected.length} 项已选`;
  const toggle = (value: string) => {
    if (value === '全部') {
      onChange(['全部']);
      return;
    }
    if (isAllSelected) {
      onChange([value]);
      return;
    }
    const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    onChange(next.length ? next : ['全部']);
  };
  return (
    <div className="uk-multi-filter">
      <span>{label}</span>
      <details>
        <summary>{summary}<b>⌄</b></summary>
        <div className="uk-multi-filter-menu">
          <label><input type="checkbox" checked={isAllSelected} onChange={() => toggle('全部')} />全部</label>
          {groups.map((group) => (
            <fieldset key={group.label ?? group.options.join('-')}>
              {group.label && <legend>{group.label}</legend>}
              {group.options.map((option) => <label key={option}><input type="checkbox" checked={!isAllSelected && selected.includes(option)} onChange={() => toggle(option)} />{option}</label>)}
            </fieldset>
          ))}
        </div>
      </details>
    </div>
  );
}

type ModuleSharedData = {
  servedNow: number;
  totalPlan: number;
  serveRate: number;
  dishes: Dish[];
  machines: Machine[];
  trend: Array<{ label: string; v: number }>;
  outflow: OutItem[];
  dishState: (dish: Dish) => string;
  workOrderStatus: (dish: Dish) => WorkOrderStatus;
};

/* ============ 计划完成率趋势：区间切换 + 日期切换 ============ */

const TREND_RANGES = [
  { id: 'today', label: '今日', note: '按小时' },
  { id: 'week', label: '近 7 日', note: '按日' },
  { id: 'month', label: '近一个月', note: '按日' },
  { id: 'year', label: '近一年', note: '按月' },
] as const;
type TrendRangeId = (typeof TREND_RANGES)[number]['id'];

type TrendPoint = { label: string; value: number };

/* 趋势图坐标系（viewBox 单位）。三个 Y 常量必须一起改。
   ⚠️ viewBox 的**宽高比**必须贴近容器宽高比，否则 SVG 会等比缩放留白
   （容器 718×215 → 比例 3.34，所以这里用 720×215）。 */
const TREND_VB_W = 720;
const TREND_VB_H = 215;
const TREND_X_L = 70;      // 首点 x（左侧留给刻度值）
const TREND_X_R = 670;     // 末点 x
const TREND_Y_TOP = 32;    // 轴顶（最高刻度）
const TREND_Y_BOT = 170;   // 轴底（最低刻度）
const TREND_Y_LABEL = 200; // 日期标签基线

const pad2 = (n: number) => String(n).padStart(2, '0');
const toISODate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const shiftDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** 32 位字符串哈希（FNV-1a）→ 0~1 的稳定伪随机数 */
function hashUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** 演示完成率 = **平滑基线** + **小幅抖动**。
    基线按「序号」用两条正弦缓慢漂移（周期 9.2 / 23.7），让相邻日期彼此接近；
    抖动来自哈希噪声（±3.5）。

    三个「为什么」：
    ① **基线要以当日真实完成率为中心**（center），不能写死一个数。
       写死 82 而当日实际是 78.8 时，历史均值会比末点高 6~8 个点，
       看上去就成了「今天突然变差」—— 而这是我们编出来的，不是真的。
       center 也做上下限保护：筛选筛选到没有工单时 completionRate 会是 0，
       不保护的话整条历史会被压到地板值上变成一条平线。
    ② 不能只用纯哈希噪声 —— 相邻两天毫无关联，画出来是尖锯齿，
       不像真实的完成率（现实里好日子连着好、差日子连着差）。
    ③ 不能用 Math.random() —— 同一日期必须每次算出同一个值，否则重渲染、切区间、刷新就变，
       截图汇报两张图对不上，还会出现「同一日期昨天 82%、今天 71%」（AC05 / AC13）。

    ordinal 的单位随区间而变：日 = 天序号；小时 = 天序号×24 + 时；月 = 年×12 + 月。
    这样同一天的各小时、同一月的各天都会落在相近的基线上，只有抖动在变。 */
function demoRate(seed: string, ordinal: number, center: number): number {
  const base = Math.min(90, Math.max(74, center));
  const baseline = base + Math.sin(ordinal / 9.2) * 4.5 + Math.sin(ordinal / 23.7) * 2.5;
  const value = baseline + (hashUnit(seed) - 0.5) * 7;
  return Math.round(Math.min(96, Math.max(66, value)) * 10) / 10;
}

const dayOrdinalOf = (d: Date) => Math.round(d.getTime() / 86_400_000);

/* ---- 单个「桶」的完成率：趋势图与 KPI 卡片**共用同一套算法** ----
   为什么要把这两行抽出来：KPI 卡片加了区间之后，同一屏上会出现
   「卡片写近 7 日 81.5%、趋势图脚注写近 7 日均值 81.5%」这种**必须逐字相同**的数字。
   两处各写一份 demoRate 调用，早晚会因为只改了一处而错开一位小数，
   到时候查起来极难 —— 所以「某一天的完成率」「某个月的完成率」只从这里出。 */
function dayBucketRate(d: Date, todayISO: string, todayRate: number): number {
  const iso = toISODate(d);
  return iso === todayISO ? todayRate : demoRate(iso, dayOrdinalOf(d), todayRate);
}

function monthBucketRate(d: Date, todayISO: string, todayRate: number): number {
  const key = `M${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  return key === `M${todayISO.slice(0, 7)}` ? todayRate : demoRate(key, d.getFullYear() * 12 + d.getMonth(), todayRate);
}

/** 「及时完成率」的演示序列。
    不能直接套 demoRate —— 它的基线夹在 74~90，而及时完成率常态在 92% 上下，
    套进去会被 90 顶格压平，看去像「历史上一次都没及时过」。
    做法与 demoRate 完全一致（确定性哈希 + 平滑基线，中心挂当日真实值），
    只是换了量纲、周期和上下限 —— 别为了省一个函数把它硬塞进 demoRate。 */
function demoOnTimeRate(seed: string, ordinal: number, center: number): number {
  const base = Math.min(96, Math.max(84, center));
  const baseline = base + Math.sin(ordinal / 11.3) * 2.4 + Math.sin(ordinal / 29.1) * 1.5;
  const value = baseline + (hashUnit(seed) - 0.5) * 3.6;
  return Math.round(Math.min(99, Math.max(76, value)) * 10) / 10;
}

/** 按区间与锚定日期生成趋势序列。
    锚定日期 = 窗口的**结束日**；选「今日」表示看该日的分时曲线。
    锚定到当天时，最后一点用页面真实完成率（与顶部 KPI 同源），其余点走演示值 ——
    否则同屏会出现「KPI 说 78.8%、趋势图末尾说 82%」这种对不上账的情况。 */
function buildTrendSeries(
  range: TrendRangeId,
  anchorISO: string,
  todayISO: string,
  todayRate: number,
  nowHour: number,
): TrendPoint[] {
  const isToday = anchorISO === todayISO;
  const anchor = new Date(`${anchorISO}T00:00:00`);
  const points: TrendPoint[] = [];

  if (range === 'today') {
    // 当天只画到**当前小时**为止：显示 24:00 等于编造尚未发生的数据（PRD:189 的精神）
    const lastHour = isToday ? Math.max(7, nowHour) : 20;
    const dayOrdinal = dayOrdinalOf(anchor);
    for (let h = 6; h <= lastHour; h += 1) {
      points.push({
        label: `${pad2(h)}:00`,
        value: isToday && h === lastHour ? todayRate : demoRate(`${anchorISO}T${pad2(h)}`, dayOrdinal * 24 + h, todayRate),
      });
    }
    return points;
  }

  if (range === 'week' || range === 'month') {
    const days = range === 'week' ? 7 : 30;
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = shiftDays(anchor, -i);
      // 走 dayBucketRate：KPI 卡片算区间总量时用的是同一个函数，两边不会错开
      points.push({ label: toISODate(d).slice(5), value: dayBucketRate(d, todayISO, todayRate) });
    }
    return points;
  }

  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    points.push({ label: `${d.getMonth() + 1}月`, value: monthBucketRate(d, todayISO, todayRate) });
  }
  return points;
}

/* ============ KPI 卡片行：区间切换 ============ */

type KpiRangeTotals = {
  planned: number;
  completed: number;
  onTime: number;
  completionRate: number;
  timelyRate: number;
  bucketCount: number;
  unit: string;
};

/** 把「每天的率」聚合成区间总量。口径三条，都是为了让卡片和趋势图对得上账：
    ① **计划量 = 当日筛选后的计划工单量 × 天数** —— 不给历史编造每日计划波动。
       多一个凭空的数字，就多一个客户会问「这数怎么来的、算法是什么」的问题。
    ② **完成率直接取各桶率的算术均值** —— 与趋势图脚注那个「均值」是同一个数，
       逐字相同。若改成 Σ完成/Σ计划，四舍五入会差出 0.2 个点，同屏两个值又要解释。
    ③ **完成量由该均值反推**（而不是先算每天的完成量再求和）——
       这样「完成量 ÷ 计划量」也同时成立，卡片自己的注解不会打自己的脸。 */
function aggregateKpiRange(planneds: number[], rates: number[], timelyRates: number[], unit: string): KpiRangeTotals {
  const mean = (xs: number[]) => xs.reduce((sum, v) => sum + v, 0) / (xs.length || 1);
  const planned = Math.round(planneds.reduce((sum, v) => sum + v, 0));
  const completionRate = Math.round(mean(rates) * 10) / 10;
  const timelyRate = Math.round(mean(timelyRates) * 10) / 10;
  const completed = Math.round((planned * completionRate) / 100);
  const onTime = Math.round((completed * timelyRate) / 100);
  return { planned, completed, onTime, completionRate, timelyRate, bucketCount: rates.length, unit };
}

/** KPI 卡片的区间总量。
    - 区间与锚定日期的定义与趋势图**完全一致**（锚定日 = 窗口结束日）。
    - 但两处是**各自独立的控件**：卡片默认「今日」、趋势图默认「近 7 日」，
      因为卡片的默认视角就是今天这一班，切区间是「回头看看」而不是默认视角。 */
function buildKpiRangeTotals(
  range: TrendRangeId,
  anchorISO: string,
  todayISO: string,
  base: { planned: number; completed: number; onTime: number },
): KpiRangeTotals {
  const anchor = new Date(`${anchorISO}T00:00:00`);
  const empty: KpiRangeTotals = { planned: 0, completed: 0, onTime: 0, completionRate: 0, timelyRate: 0, bucketCount: 0, unit: '天' };
  /* 当日筛选后没有工单（例如只勾了「宵夜」，而宵夜本来就没有菜品）→
     整个区间也不该凭空生出数字。不加这道闸，卡片会显示 0、而趋势图仍画着 80% 一条线。 */
  if (!base.planned) return empty;

  const completionCenter = Math.round((base.completed / base.planned) * 1000) / 10;
  const timelyCenter = base.completed ? Math.round((base.onTime / base.completed) * 1000) / 10 : 0;
  const dailyPlan = base.planned;

  if (range === 'today') {
    if (anchorISO === todayISO) {
      return {
        planned: base.planned,
        completed: base.completed,
        onTime: base.onTime,
        completionRate: completionCenter,
        timelyRate: timelyCenter,
        bucketCount: 1,
        unit: '天',
      };
    }
    /* 历史某一天：取该日当天值的**全天口径**（不按小时切，KPI 是日总量）。
       这里刻意用 `${iso}T20` 这个 seed 与序号 20 时 —— 与趋势图选「今日」看历史某天时
       分时曲线的**末点**同一个值，保证那时卡片和折线末尾对得上。 */
    const rate = demoRate(`${anchorISO}T20`, dayOrdinalOf(anchor) * 24 + 20, completionCenter);
    const timely = demoOnTimeRate(`${anchorISO}T20-ontime`, dayOrdinalOf(anchor) * 24 + 20, timelyCenter);
    return aggregateKpiRange([dailyPlan], [rate], [timely], '天');
  }

  if (range === 'week' || range === 'month') {
    const bucketCount = range === 'week' ? 7 : 30;
    const planneds: number[] = [];
    const rates: number[] = [];
    const timelyRates: number[] = [];
    for (let i = bucketCount - 1; i >= 0; i -= 1) {
      const d = shiftDays(anchor, -i);
      const iso = toISODate(d);
      planneds.push(dailyPlan);
      // 与趋势图逐点同源（dayBucketRate），所以卡片的「完成率」= 趋势图脚注的「均值」
      rates.push(dayBucketRate(d, todayISO, completionCenter));
      timelyRates.push(iso === todayISO ? timelyCenter : demoOnTimeRate(`${iso}-ontime`, dayOrdinalOf(d), timelyCenter));
    }
    return aggregateKpiRange(planneds, rates, timelyRates, '天');
  }

  /* 近一年：按**月**聚合（与趋势图的月度视图同粒度）。
     月度计划量 = 当月天数 × 日计划量 —— 别的月份该有多少工单我们并不知道，
     但「天数×日均」至少是个能当面解释清楚的算法。 */
  const planneds: number[] = [];
  const rates: number[] = [];
  const timelyRates: number[] = [];
  const currentMonthKey = `M${todayISO.slice(0, 7)}`;
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const key = `M${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    planneds.push(dailyPlan * daysInMonth);
    rates.push(monthBucketRate(d, todayISO, completionCenter));
    timelyRates.push(key === currentMonthKey ? timelyCenter : demoOnTimeRate(`${key}-ontime`, d.getFullYear() * 12 + d.getMonth(), timelyCenter));
  }
  return aggregateKpiRange(planneds, rates, timelyRates, '个月');
}

function ProductionOverviewModule({ data, clock, onNavigate }: { data: ModuleSharedData; clock: string; onNavigate: (id: string) => void }) {
  const [statusFilters, setStatusFilters] = useState<WorkOrderStatusFilter[]>(['全部']);
  const [segmentFilters, setSegmentFilters] = useState<WorkOrderSegmentFilter[]>(['全部']);
  const [modeFilters, setModeFilters] = useState<WorkOrderModeFilter[]>(['全部']);
  const statusFilterIsAll = statusFilters.includes('全部');
  const segmentFilterIsAll = segmentFilters.includes('全部');
  const modeFilterIsAll = modeFilters.includes('全部');
  const modeHasDemoRows = modeFilterIsAll || modeFilters.includes('计划烹饪');
  const filteredDishes = data.dishes.filter((dish) => {
    const matchesSegment = segmentFilterIsAll || segmentFilters.includes(dish.segment);
    const matchesStatus = statusFilterIsAll || statusFilters.includes(data.workOrderStatus(dish));
    return matchesSegment && matchesStatus && modeHasDemoRows;
  });
  const mealSegments = segmentFilterIsAll ? MEAL_ORDER : MEAL_ORDER.filter((segment) => segmentFilters.includes(segment));
  const mealPlan = mealSegments.map((segment) => {
    const dishes = filteredDishes.filter((dish) => dish.segment === segment);
    const planned = dishes.reduce((sum, dish) => sum + dish.total, 0);
    const completed = dishes.reduce((sum, dish) => sum + dish.done, 0);
    return { segment, dishes: dishes.length, planned, completed, pending: Math.max(0, planned - completed) };
  });
  const totalPlanned = mealPlan.reduce((sum, meal) => sum + meal.planned, 0);
  const totalCompleted = mealPlan.reduce((sum, meal) => sum + meal.completed, 0);
  const totalPending = Math.max(0, totalPlanned - totalCompleted);
  const maxPlanned = Math.max(...mealPlan.map((meal) => meal.planned), 1);
  const completionRate = totalPlanned ? (totalCompleted / totalPlanned) * 100 : 0;
  const hasVisibleWorkOrders = filteredDishes.length > 0;
  const onTimeCompleted = filteredDishes.reduce((sum, dish) => sum + dish.onTimeDone, 0);
  /* 原「及时完成率」「计划烹饪数量」两个单值常量已并入下面的 kpiTotals：
     卡片区间化之后，它们都要跟着窗口变，单独留一份「今日」口径的常量只会悄悄跑偏。
     口径等价性：modeFilters 只剩「临时加菜」时 filteredDishes 为空 → totalPlanned 为 0，
     kpiTotals 同样走 0 分支，所以「计划烹饪数量」= kpiTotals.planned 与原逻辑一致。 */
  const temporaryAddCount = modeFilters.includes('临时加菜') ? DEMO_TEMPORARY_ADD_ORDERS : 0;
  // ---- 计划完成率趋势：区间 / 日期切换 ----
  const todayISO = toISODate(new Date());
  const [trendRange, setTrendRange] = useState<TrendRangeId>('week');
  const [trendAnchor, setTrendAnchor] = useState(todayISO);
  const trendSeries = buildTrendSeries(trendRange, trendAnchor, todayISO, Math.round(completionRate * 10) / 10, new Date().getHours());
  const trendCount = trendSeries.length;
  const trendValues = trendSeries.map((point) => point.value);
  const trendAvg = trendValues.reduce((sum, v) => sum + v, 0) / trendCount;

  /* 纵轴范围由数据推出来，不写死 60~100：换到「今日」「近一年」后数据区间会变，
     写死的轴要么把点顶出画面，要么把波动压平。取整到 10 的倍数 + 上下各留 3 个点余量；
     跨度不足 20 时撑到 20，避免几个点的正常抖动被放大成悬崖。 */
  let axisMin = Math.max(0, Math.floor((Math.min(...trendValues) - 3) / 10) * 10);
  let axisMax = Math.min(100, Math.ceil((Math.max(...trendValues) + 3) / 10) * 10);
  if (axisMax - axisMin < 20) {
    axisMin = Math.max(0, axisMax - 20);
    axisMax = Math.min(100, axisMin + 20);
  }
  const axisSpan = Math.max(10, axisMax - axisMin);
  const axisTicks: number[] = [];
  for (let v = axisMax; v >= axisMin; v -= 10) axisTicks.push(v);
  /* 刻度线与折线共用 yOf()：两套各算各的，迟早出现「线画在一处、刻度标在另一处」 */
  const yOf = (v: number) => TREND_Y_BOT - ((v - axisMin) / axisSpan) * (TREND_Y_BOT - TREND_Y_TOP);
  /* 点的个数随区间变（今日 9~15、近 7 日 7、近一月 30、近一年 12），
     所以 x 必须按个数均匀铺开，不能再来回写死步长。 */
  const xOf = (i: number) => (trendCount <= 1 ? (TREND_X_L + TREND_X_R) / 2 : TREND_X_L + (i * (TREND_X_R - TREND_X_L)) / (trendCount - 1));
  const trendPoints = trendSeries.map((point, i) => `${xOf(i).toFixed(1)},${yOf(point.value).toFixed(1)}`).join(' ');
  /* 点多时抽稀标签，否则日期会叠成一团；末点始终显示。
     数值标签只在点少时给——30 个点全标数字必然糊成一片，此时纵向刻度已能表达量级。 */
  const labelStep = Math.max(1, Math.ceil(trendCount / 7));
  const showTick = (i: number) => i % labelStep === 0 || i === trendCount - 1;
  const showValues = trendCount <= 16;
  const trendMeta = TREND_RANGES.find((item) => item.id === trendRange) ?? TREND_RANGES[1];

  // ---- KPI 卡片行：区间 / 日期切换（默认「今日」）----
  //      与趋势图共用同一组区间定义，但**状态各自独立**：
  //      趋势图默认「近 7 日」（看走势），卡片默认「今日」（看今天这一班）。
  //      两处各自标注自己的口径，所以同屏出现不同的窗口不算矛盾；
  //      若日后想让一处切换带动两处，把这个 state 提到壳层传下去即可。
  const [kpiRange, setKpiRange] = useState<TrendRangeId>('today');
  const [kpiAnchor, setKpiAnchor] = useState(todayISO);
  const kpiRangeMeta = TREND_RANGES.find((item) => item.id === kpiRange) ?? TREND_RANGES[0];
  const kpiTotals = buildKpiRangeTotals(kpiRange, kpiAnchor, todayISO, {
    planned: totalPlanned,
    completed: totalCompleted,
    onTime: onTimeCompleted,
  });
  /* 卡片上的「计划工单」要带窗口前缀，否则切到近 7 日后标题还写着「今日」。
     锚定日不是今天时不能叫「今日」（那个词会撒谎），退回中性的「当日」。 */
  const kpiScopeLabel = kpiRange === 'today'
    ? (kpiAnchor === todayISO ? '今日' : '当日')
    : kpiRangeMeta.label;
  const kpiPending = Math.max(0, kpiTotals.planned - kpiTotals.completed);

  return (
    <CockpitModuleShell current="overview" clock={clock} onNavigate={onNavigate}>
      {/* KPI 卡片行的区间控件。选项与「计划完成率趋势」一致，但**默认「今日」**：
          卡片的默认视角就是今天这一班，切区间是「回头看看」，不是默认视角。
          控件复用趋势图那套 .uk-range-switch / .uk-date-switch ——
          同一屏上两个同类控件必须长得一样，否则读者会以为是两种东西。
          卡片文案不重复写区间：标题已经写成「近 7 日计划工单」，说明行只用来说算法。 */}
      <div className="uk-kpi-toolbar">
        <span className="uk-kpi-toolbar-label">统计区间</span>
        <div className="uk-range-switch" role="group" aria-label="卡片统计区间">
          {TREND_RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={kpiRange === item.id ? 'active' : ''}
              onClick={() => setKpiRange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {/* 日期 = 窗口**结束日**（与趋势图同一套语义）；max = 今天，不让选未来 */}
        <label className="uk-date-switch">
          <span>日期</span>
          <input type="date" value={kpiAnchor} max={todayISO} onChange={(event) => setKpiAnchor(event.target.value || todayISO)} />
        </label>
      </div>

      <div className="uk-module-kpis">
        <ModuleKpi label={`${kpiScopeLabel}计划工单`} value={`${kpiTotals.planned}`} />
        <ModuleKpi label="已完成工单" value={`${kpiTotals.completed}`} tone="green" />
        <ModuleKpi label="待完成工单" value={`${kpiPending}`} tone="amber" />
        {/* 完成率与趋势图脚注的「均值」是同一个数（都出自 aggregateKpiRange 的算术均值），
            切到近 7 日时两处会显示完全相同的 81.5% —— 这是刻意的，别改成两套算法 */}
        <ModuleKpi label="完成率" value={`${kpiTotals.completionRate.toFixed(1)}%`} note="已完成 / 计划" tone="green" />
        <ModuleKpi label="及时完成率" value={`${kpiTotals.timelyRate.toFixed(1)}%`} note="按时完成 / 已完成" tone="cyan" />
        <ModuleKpi label="计划烹饪数量" value={`${kpiTotals.planned}`} tone="blue" />
        <ModuleKpi label="临时加菜数量" value={`${temporaryAddCount}`} tone="amber" />
      </div>

      <div className="uk-module-grid uk-module-grid-main uk-overview-main">
        <section className="uk-module-panel uk-plan-chart-panel"><div className="uk-module-panel-head"><div><h2>餐段计划 / 完成对比</h2><p>按餐段看计划工单与已完成工单</p></div></div>
          {/* 筛选条从页面级（KPI 与图表之间那条独立带）搬进本面板内部：
              它只筛工单维度，影响的是这一屏的全部图表，放在图表旁比单独占一条带更贴近对象。 */}
          <div className="uk-workorder-filters" aria-label="工单筛选">
        <MultiSelectFilter label="状态" selected={statusFilters} groups={WORK_ORDER_STATUS_GROUPS} onChange={(values) => setStatusFilters(values as WorkOrderStatusFilter[])} />
        <MultiSelectFilter label="餐段" selected={segmentFilters} groups={[{ options: WORK_ORDER_SEGMENT_OPTIONS.slice(1) }]} onChange={(values) => setSegmentFilters(values as WorkOrderSegmentFilter[])} />
        <MultiSelectFilter label="模式" selected={modeFilters} groups={[{ options: WORK_ORDER_MODE_OPTIONS.slice(1) }]} onChange={(values) => setModeFilters(values as WorkOrderModeFilter[])} />
          </div>
        <div className="uk-chart-legend"><span><i className="planned" />计划工单</span><span><i className="completed" />已完成工单</span></div>{hasVisibleWorkOrders ? <div className="uk-plan-chart">{mealPlan.map((item) => <div className="uk-plan-chart-group" key={item.segment}><div className="uk-plan-bars"><i className="uk-plan-bar planned" style={{ '--bar-height': `${(item.planned / maxPlanned) * 100}%` } as React.CSSProperties}><b>{item.planned}</b></i><i className="uk-plan-bar completed" style={{ '--bar-height': `${(item.completed / maxPlanned) * 100}%` } as React.CSSProperties}><b>{item.completed}</b></i></div><strong>{item.segment}</strong><span>{item.planned === 0 ? '暂无工单' : item.pending > 0 ? `待完成 ${item.pending}` : '已完成'}</span></div>)}</div> : <div className="uk-filter-empty">暂无工单</div>}<div className="uk-chart-footnote"><span>合计 {totalPlanned} 计划工单</span><strong>已完成 {totalCompleted}</strong></div></section>
        {/* 「近 7 日计划完成率趋势」原挂在「待完成工单分布」面板的下半部分，
            把那个面板撑到 546px；而柱状图面板独占一整行（1852px），
            5 个分组里每组只用到 78px / 336px —— 宵夜、其他还是空分组。
            拆出来并排后：柱状图宽度减半、不再稀疏散开，趋势图也把宽度吃满
            （原先 SVG 声明 540×140 而容器 885×140，等比例缩放后只画了 61% 宽，
             两侧 39% 是空的 —— 这次把 viewBox 与容器比例对齐修掉了）。 */}
        <section className="uk-module-panel uk-trend-panel">
          <div className="uk-module-panel-head">
            <div>
              <h2>计划完成率趋势</h2>
              <p>{trendMeta.note}统计的计划工单完成率</p>
            </div>
          </div>

          <div className="uk-trend-toolbar">
            <div className="uk-range-switch" role="group" aria-label="统计区间">
              {TREND_RANGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={trendRange === item.id ? 'active' : ''}
                  onClick={() => setTrendRange(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="uk-date-switch">
              <span>日期</span>
              {/* max = 今天：不让选未来日期（未来没有「已完成」这回事）。
                  日期是窗口**结束日**，往前推 区间长度 得到起点。 */}
              <input type="date" value={trendAnchor} max={todayISO} onChange={(event) => setTrendAnchor(event.target.value || todayISO)} />
            </label>
          </div>

          <div className="uk-rate-trend">
            {/* 筛选把工单筛空时不能照画 —— completionRate 会是 0，而 demoRate 的基线
                下限是 74，折线反而会画出一条 80% 上下的曲线，和左边卡片上的一排 0 直接打架。
                这是把 KPI 卡片也做成「可切区间」之后暴露出来的（读者开始把两者的数字对读）。 */}
            {hasVisibleWorkOrders ? (
            <svg viewBox={`0 0 ${TREND_VB_W} ${TREND_VB_H}`} role="img" aria-label={`${trendMeta.label}计划完成率趋势`}>
              {/* 刻度线、刻度值、折线共用上面同一套 yOf() 映射 */}
              {axisTicks.map((v) => (
                <g key={v}>
                  <path className="uk-rate-trend-grid" d={`M44 ${yOf(v).toFixed(1)}H700`} />
                  <text className="uk-rate-trend-axis" x="32" y={yOf(v).toFixed(1)} textAnchor="end" dominantBaseline="middle">{v}%</text>
                </g>
              ))}
              <polyline className="uk-rate-trend-line" points={trendPoints} />
              {trendSeries.map((point, i) => {
                const x = xOf(i);
                const y = yOf(point.value);
                return (
                  <g key={`${point.label}-${i}`}>
                    <circle className="uk-rate-trend-dot" cx={x.toFixed(1)} cy={y.toFixed(1)} r={trendCount > 16 ? 2.6 : 4.5} />
                    {showValues && showTick(i) ? (
                      <text className="uk-rate-trend-value" x={x.toFixed(1)} y={(y - 13).toFixed(1)} textAnchor="middle">{point.value.toFixed(1)}%</text>
                    ) : null}
                    {showTick(i) ? (
                      <text className="uk-rate-trend-label" x={x.toFixed(1)} y={TREND_Y_LABEL} textAnchor="middle">{point.label}</text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
            ) : (
              <div className="uk-filter-empty">暂无工单</div>
            )}
          </div>
          {hasVisibleWorkOrders ? (
          <div className="uk-chart-footnote">
            {/* 一位小数，与顶部「完成率」KPI 的精度对齐 —— 否则会出现
                「KPI 78.8%、趋势末点 79%」这种同屏两个值（纯四舍五入造成的，但客户会问）。
                切到近 7 日时，这个「均值」与顶部卡片「完成率」是同一个数（同出 aggregateKpiRange）。 */}
            <span>{trendMeta.label}均值 {trendAvg.toFixed(1)}%</span>
            <strong>最新 {trendValues[trendCount - 1].toFixed(1)}%</strong>
          </div>
          ) : null}
        </section>
      </div>

      <div className="uk-module-grid uk-module-grid-bottom uk-chart-grid-bottom">
        <section className="uk-module-panel uk-pending-panel"><div className="uk-module-panel-head"><div><h2>待完成工单分布</h2></div></div>{hasVisibleWorkOrders ? <div className="uk-pending-chart">{mealPlan.map((item) => <div className="uk-pending-row" key={item.segment}><div><b>{item.segment}</b><span>{item.dishes} 道菜</span></div><div className="uk-pending-track"><i style={{ width: `${totalPending ? (item.pending / totalPending) * 100 : 0}%` }} /><span>{item.pending}</span></div></div>)}</div> : <div className="uk-filter-empty">暂无工单</div>}</section>
        <section className="uk-module-panel uk-focus-panel"><div className="uk-module-panel-head"><div><h2>工单阶段分布</h2></div></div><div className="uk-stage-list">{STATIC_WORKFLOW_STAGES.map((item, index) => <div className="uk-stage-row" key={item.label}><span className="uk-stage-index">{String(index + 1).padStart(2, '0')}</span><div className="uk-stage-name"><b>{item.label}</b><small>{item.note}</small></div><div className="uk-stage-rail"><i style={{ width: `${(item.value / STATIC_WORKFLOW_TOTAL) * 100}%`, background: item.color }} /></div><strong>{item.value}</strong></div>)}</div><div className="uk-status-exception"><i /><span>工单作废 · 已作废</span><b>{STATIC_VOID_ORDERS}</b></div></section>
      </div>
    </CockpitModuleShell>
  );
}

function MealAssuranceModule({ data, clock, onNavigate }: { data: ModuleSharedData; clock: string; onNavigate: (id: string) => void }) {
  const mealSegments: MealSegment[] = ['早餐', '午餐', '晚餐'];
  const mealSummaries = mealSegments.map((segment) => {
    const dishes = data.dishes.filter((dish) => dish.segment === segment);
    const planned = dishes.reduce((sum, dish) => sum + dish.total, 0);
    const completed = dishes.reduce((sum, dish) => sum + dish.done, 0);
    return {
      segment,
      planned,
      completed,
      pending: Math.max(0, planned - completed),
      rate: planned ? (completed / planned) * 100 : 0,
    };
  });
  const currentMeal = mealSummaries.find((meal) => meal.segment === '午餐') ?? mealSummaries[0];
  const currentPendingDishes = data.dishes.filter((dish) => dish.segment === currentMeal.segment && dish.done < dish.total);
  const currentState = currentMeal.rate >= 80 ? '按计划推进' : '需要关注';
  const currentTone = currentMeal.rate >= 80 ? 'ok' : 'warn';
  const flowStages = [
    { label: '计划确认', note: `${currentMeal.planned} 批计划`, status: '已完成', tone: 'done' },
    { label: '称重加料', note: '核对投料任务', status: currentMeal.rate >= 35 ? '进行中' : '待开始', tone: currentMeal.rate >= 35 ? 'active' : 'idle' },
    { label: '烹饪加工', note: '关注未完成菜品', status: currentMeal.rate >= 65 ? '进行中' : '待开始', tone: currentMeal.rate >= 65 ? 'active' : 'idle' },
    { label: '出餐保障', note: currentMeal.pending ? `还剩 ${currentMeal.pending} 批` : '当前餐段已完成', status: currentMeal.pending ? '待保障' : '已完成', tone: currentMeal.pending ? 'warn' : 'done' },
  ];

  return (
    <CockpitModuleShell current="overview" clock={clock} onNavigate={onNavigate}>
      <main className="uk-assurance">
        <section className="uk-assurance-hero">
          <div>
            <span className="uk-assurance-kicker">当前餐段 · 结构演示</span>
            <h2>{currentMeal.segment} · {currentState}</h2>
            <p>先判断当前餐段能否按计划完成，再定位需要关注的菜品和环节。</p>
          </div>
          <div className={`uk-assurance-badge ${currentTone}`}><i />{currentState}</div>
        </section>

        <div className="uk-module-kpis uk-assurance-kpis">
          <ModuleKpi label="当前餐段计划" value={`${currentMeal.planned} 批`} note={currentMeal.segment} />
          <ModuleKpi label="已完成" value={`${currentMeal.completed} 批`} note="已进入完成统计" tone="green" />
          <ModuleKpi label="待完成" value={`${currentMeal.pending} 批`} note="需要持续关注" tone="amber" />
          <ModuleKpi label="餐段完成率" value={`${currentMeal.rate.toFixed(1)}%`} note="已完成 / 计划" tone="cyan" />
          <ModuleKpi label="待关注菜品" value={`${currentPendingDishes.length} 道`} note="当前餐段" tone="blue" />
        </div>

        <div className="uk-assurance-main">
          <section className="uk-module-panel uk-assurance-panel">
            <div className="uk-module-panel-head">
              <div><h2>餐段完成情况</h2><p>先看哪个餐段需要关注</p></div>
            </div>
            <div className="uk-assurance-meals">
              {mealSummaries.map((meal) => {
                const state = meal.pending === 0 ? '已完成' : meal.rate >= 80 ? '进行中' : '需关注';
                const tone = meal.pending === 0 ? 'done' : meal.rate >= 80 ? 'active' : 'warn';
                return (
                  <div className="uk-assurance-meal" key={meal.segment}>
                    <div className="uk-assurance-meal-head"><b>{meal.segment}</b><span className={tone}>{state}</span></div>
                    <div className="uk-assurance-meal-track"><i className={tone} style={{ width: `${meal.rate}%` }} /></div>
                    <div className="uk-assurance-meal-meta"><span>已完成 {meal.completed} / {meal.planned} 批</span><strong>{meal.rate.toFixed(1)}%</strong></div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="uk-module-panel uk-assurance-panel">
            <div className="uk-module-panel-head">
              <div><h2>当前保障判断</h2><p>基于计划与完成进度的结构演示</p></div>
            </div>
            <div className={`uk-assurance-judgement ${currentTone}`}>
              <strong>{currentMeal.segment}餐段{currentState}</strong>
              <span>{currentMeal.pending ? `已完成 ${currentMeal.completed} 批，仍有 ${currentMeal.pending} 批待完成` : '当前餐段计划已完成'}</span>
            </div>
            <div className="uk-assurance-checks">
              <div><i className="done" /><span>计划任务已建立</span><b>已确认</b></div>
              <div><i className={currentPendingDishes.length ? 'warn' : 'done'} /><span>待完成菜品</span><b>{currentPendingDishes.length ? `${currentPendingDishes.length} 道` : '无'}</b></div>
              <div><i className="info" /><span>下一关注点</span><b>{currentPendingDishes[0]?.name ?? '出餐确认'}</b></div>
            </div>
          </section>
        </div>

        <div className="uk-assurance-bottom">
          <section className="uk-module-panel uk-assurance-panel">
            <div className="uk-module-panel-head">
              <div><h2>生产链路</h2><p>从计划到出餐的关键节点</p></div>
            </div>
            <div className="uk-assurance-flow">
              {flowStages.map((stage, index) => (
                <React.Fragment key={stage.label}>
                  <div className={`uk-assurance-flow-item ${stage.tone}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <b>{stage.label}</b>
                    <small>{stage.note}</small>
                    <em>{stage.status}</em>
                  </div>
                  {index < flowStages.length - 1 ? <i className="uk-assurance-flow-arrow">→</i> : null}
                </React.Fragment>
              ))}
            </div>
          </section>

          <section className="uk-module-panel uk-assurance-panel">
            <div className="uk-module-panel-head">
              <div><h2>重点关注</h2><p>当前餐段仍未完成的菜品</p></div>
            </div>
            <div className="uk-assurance-attention">
              {currentPendingDishes.length ? currentPendingDishes.map((dish) => (
                <div className="uk-assurance-attention-row" key={dish.name}>
                  <div><b>{dish.name}</b><span>{dish.segment} · 已完成 {dish.done} / {dish.total} 批</span></div>
                  <strong>待完成 {dish.total - dish.done} 批</strong>
                </div>
              )) : <div className="uk-assurance-empty">当前餐段暂无待完成菜品</div>}
            </div>
          </section>
        </div>
      </main>
    </CockpitModuleShell>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   计划达成复盘（导航「计划达成」）

   这一页只回答两个问题，别的都不回答：
     ① 每个餐段有哪些**批次**没按计划
     ② 每个餐段有哪些**菜**没按计划
   所以它是**跨餐段的汇总页**，不做单批次的逐菜时间线 —— 那是明细，已撤。

   ── 判定口径（改口径前先读这一段）───────────────────────────────
   · 「按计划」= 时间与数量**都**达标。
   · **批次**是否按计划 = 只看**出餐时间**：该批最后一道菜的出餐时刻晚于
     **本批次自己的计划出餐时刻**（`batch.dueAt`），这个批次才算没按计划。
     批内个别菜晚出**不影响**批次达标 —— 菜是一道一道做的，中间被前一道挤掉
     几分钟是常态。
     ⚠️ 这个时刻是**每个批次各自**的，不是餐段共用一个。共用是错的：
       一个餐段只有**一个**截止时刻时，同餐段里越早的批次「提前量」必然越大，
       折线图上会出现「早两个小时」这种没有度量意义的点，把真正的信号压成细缝。
       （踩过：见 MEAL_ACHIEVEMENTS 上方那段注释。）
   · **菜**是否按计划 = 时间与数量**任一**不满足即算。一道菜只归一类：
     少做优先于晚出，避免同一道菜被计两次（既少又晚时，「少做」更该被看见）。
   · ⚠️ **计划外的临时加菜不在任何批次内**：它不参与批次达标判定，也不进
     「没按计划的菜」，只作为事实单独统计（它确实占了设备时间）。
     上一版把加菜算进了批次的时间口径，是错的，已按用户要求剔除。
   ══════════════════════════════════════════════════════════════════════ */

/** 一道菜的结果。三态互斥，`short` 优先于 `late`。 */
type DishOutcome = 'ontime' | 'late' | 'short';

type BatchDish = {
  name: string;
  /** 计划出餐量（盆） */
  planTrays: number;
  /** 实际出餐量（盆） */
  actualTrays: number;
  /** 备餐提醒：系统按批次节奏提醒「该出这道菜了」的时刻 */
  remindAt: string;
  /** 实际出餐时刻 */
  actualOut: string;
};

type MealBatch = {
  /** 批次号，从 1 开始 */
  no: number;
  /** 本批次的计划出餐时刻（**批次级判据**：这批菜必须在这个时刻前全部出完，
      晚一分钟就算这批没按计划）。取值须 ≥ 本批最后一道菜的备餐提醒时刻 ——
      排产计划给的时刻如果早于自己发的提醒，就是「照着提醒做也必然不达标」。 */
  dueAt: string;
  dishes: BatchDish[];
};

type MealAchievement = {
  id: string;
  label: string;
  /** 餐段窗口，如 07:00—09:30 */
  window: string;
  /* ⚠️ 这里**故意没有** dueAt。上一版有一个餐段级的截止时刻，被批次级 dueAt 取代了：
     留着两个「截止」就是两个真相源，迟早有一处忘了改。餐段的时间边界由 window 表达。 */
  batches: MealBatch[];
};

/* 四个餐段共 6 个批次：**早餐 1 批 / 午餐 2 批 / 晚餐 2 批 / 夜宵 1 批**。

   ── 批次怎么分（这决定了折线图好不好看）────────────────────────────
   ⚠️ 上一版是「早餐 3 批 / 午餐 1 / 晚餐 1 / 夜宵 1」——**那个分配把口径的毛病暴露成了常态**：
   当时批次判据挂的是**餐段级**截止时刻（= 餐段窗口结束），一个餐段只有**一个**截止时刻，
   那么同一餐段里越早的批次「提前量」必然越大。早餐拆 3 批时，前两批必然早两个多小时出齐，
   折线图上就是「−114 / −70」这种**没有度量意义**的数字把纵轴撑爆（真正的信号 +8/+17 被压成细缝）。
   真实的食堂反过来：**早餐是一次性出齐的一轮，午晚两餐才是分两轮补菜**。
   → 教训：图表不好看时，先回头看**数据模型本身合不合理**，别急着在渲染层打补丁。

   ── 每个批次各自的计划出餐时刻（dueAt）怎么定 ─────────────────────
   一条规则就能把下面六个值**精确**推出来，不是手挑的：
     · 一个餐段的**最后一个批次**（含只有一批的餐段）→ 取**餐段窗口结束**。
       道理：收餐前必须出完，这是这个餐段最硬的那条时间线。
     · 其余批次（= 多批次餐段的**前面**那几批）→ 取**本批末道菜提醒 + 10 分钟**，
       再向上取到 5 分整。
     · 两个约束：必须 ≥ 本批末道菜的备餐提醒（否则「照着提醒做也必然不达标」，
       那不是评价执行，是判据自相矛盾）；且不超过餐段窗口结束。
   逐个验算：
     | 批次        | 末道菜提醒 | 规则      | 计划 dueAt | 实际出餐 | 偏差  |
     | 早餐·批次1  | 09:12     | 唯一批→窗末 | 09:30     | 09:38    | +8  ✗ |
     | 午餐·批次1  | 12:34     | +10→取5整  | 12:45     | 12:34    | −11 ✓ |
     | 午餐·批次2  | 13:10     | 末批→窗末  | 13:30     | 13:47    | +17 ✗ |
     | 晚餐·批次1  | 19:01     | +10→取5整  | 19:15     | 19:01    | −14 ✓ |
     | 晚餐·批次2  | 19:22     | 末批→窗末  | 19:30     | 19:24    | −6  ✓ |
     | 夜宵·批次1  | 22:18     | 唯一批→窗末 | 22:30     | 22:26    | −4  ✓ |

   偏差落 −14 ~ +17，两侧都有界、零线落在中间，折线图红/绿两带高度相当。
   （跨所有日期：上界 +20、下界 −27，见折线图的纵轴注释。）

   ⚠️ 这条规则有个**可预期的后果**：4/6 的批次拿的是餐段窗口结束，那通常离末道菜提醒
      还有 8~20 分钟缓冲 —— 所以**历史日期上大多数批次都达标**（点全在零线下面）。
      这不是 bug，是「批次级判据本来就比菜品级判据宽」的必然结果：
      菜品级问「哪道菜晚了」（一批里只要有一道晚就算），
      批次级问「这批有没有拖过承诺的出餐时刻」（十几道菜挤几分钟不影响承诺）。
      想让批次级判据更常咬人，就调小上面那个 10 分钟缓冲 —— 但别调到 ±1 分钟，
      那种「超 1 分」会落在零线上、读不出真假。

   两个批次未达标，成因**故意不同**，这样一眼能看出图是按「出餐时间」判批次：
     · 早餐·批次1 —— 末道菜「手撕包」晚了 26 分，把整批拖过计划 8 分；
     · 午餐·批次2 —— 末道菜「清蒸鲈鱼」晚了 37 分，直接拖过计划 17 分。

   反过来，**单菜晚出不等于批次不达标**。本案特意留了反例，用来体现两套口径各答各的问题：
     · 晚餐·批次2「蒜蓉菠菜」晚 2 分，整批仍比计划早 6 分出齐 → 菜延迟、批次达标；
     · 夜宵·批次1「凉拌黄瓜」晚 8 分，整批仍早 4 分出齐，同理；
     · 晚餐·批次1「韭菜炒香干」少做 1 盆（数量缺口），出餐时刻没问题 → 菜少做、批次达标。

   ⚠️ 每道菜的 name / planTrays / remindAt / actualOut **一个都没动**（只换分组、只加批次 dueAt），
      所以四个状态的合计（92 / 81 / 10 / 1）与那 5 个异常点（手撕包、清蒸鲈鱼、
      韭菜炒香干、蒜蓉菠菜、凉拌黄瓜）和上一版完全一致。 */
const MEAL_ACHIEVEMENTS: MealAchievement[] = [
  {
    id: 'breakfast', label: '早餐', window: '07:00—09:30',
    batches: [
      { no: 1, dueAt: '09:30', dishes: [
        { name: '小米粥', planTrays: 4, actualTrays: 4, remindAt: '07:12', actualOut: '07:12' },
        { name: '奶黄包', planTrays: 4, actualTrays: 4, remindAt: '07:20', actualOut: '07:20' },
        { name: '白煮蛋', planTrays: 3, actualTrays: 3, remindAt: '07:28', actualOut: '07:27' },
        { name: '凉拌豆芽', planTrays: 3, actualTrays: 3, remindAt: '07:36', actualOut: '07:36' },
        { name: '现磨豆浆', planTrays: 4, actualTrays: 4, remindAt: '07:50', actualOut: '07:50' },
        { name: '葱油饼', planTrays: 4, actualTrays: 4, remindAt: '08:00', actualOut: '08:00' },
        { name: '清炒时蔬', planTrays: 3, actualTrays: 3, remindAt: '08:10', actualOut: '08:09' },
        { name: '原味酸奶', planTrays: 3, actualTrays: 3, remindAt: '08:20', actualOut: '08:20' },
        { name: '阳春面', planTrays: 4, actualTrays: 4, remindAt: '08:40', actualOut: '08:40' },
        { name: '白粥', planTrays: 3, actualTrays: 3, remindAt: '08:52', actualOut: '08:52' },
        { name: '卤蛋', planTrays: 3, actualTrays: 3, remindAt: '09:02', actualOut: '09:02' },
        { name: '手撕包', planTrays: 3, actualTrays: 3, remindAt: '09:12', actualOut: '09:38' },
      ] },
    ],
  },
  {
    id: 'lunch', label: '午餐', window: '11:00—13:30',
    batches: [
      { no: 1, dueAt: '12:45', dishes: [
        { name: '红烧肉', planTrays: 4, actualTrays: 4, remindAt: '12:10', actualOut: '12:10' },
        { name: '番茄炒蛋', planTrays: 4, actualTrays: 4, remindAt: '12:22', actualOut: '12:22' },
        { name: '蒜蓉西兰花', planTrays: 3, actualTrays: 3, remindAt: '12:34', actualOut: '12:34' },
      ] },
      { no: 2, dueAt: '13:30', dishes: [
        { name: '小米南瓜粥', planTrays: 3, actualTrays: 3, remindAt: '12:46', actualOut: '12:45' },
        { name: '香米饭', planTrays: 5, actualTrays: 5, remindAt: '12:58', actualOut: '12:58' },
        { name: '清蒸鲈鱼', planTrays: 3, actualTrays: 3, remindAt: '13:10', actualOut: '13:47' },
      ] },
    ],
  },
  {
    id: 'dinner', label: '晚餐', window: '17:30—19:30',
    batches: [
      { no: 1, dueAt: '19:15', dishes: [
        { name: '小炒鸡胗肉', planTrays: 4, actualTrays: 4, remindAt: '18:17', actualOut: '18:17' },
        { name: '丝瓜炒蛋', planTrays: 4, actualTrays: 4, remindAt: '18:33', actualOut: '18:33' },
        { name: '韭菜炒香干', planTrays: 4, actualTrays: 3, remindAt: '19:01', actualOut: '19:01' },
      ] },
      { no: 2, dueAt: '19:30', dishes: [
        { name: '清炒豆皮', planTrays: 3, actualTrays: 3, remindAt: '19:13', actualOut: '19:12' },
        { name: '蒜蓉菠菜', planTrays: 2, actualTrays: 2, remindAt: '19:22', actualOut: '19:24' },
      ] },
    ],
  },
  {
    id: 'late-night', label: '夜宵', window: '21:00—22:30',
    batches: [
      { no: 1, dueAt: '22:30', dishes: [
        { name: '三丝炒面', planTrays: 4, actualTrays: 4, remindAt: '21:40', actualOut: '21:40' },
        { name: '卤味拼盘', planTrays: 3, actualTrays: 3, remindAt: '21:55', actualOut: '21:55' },
        { name: '皮蛋瘦肉粥', planTrays: 3, actualTrays: 3, remindAt: '22:08', actualOut: '22:08' },
        { name: '凉拌黄瓜', planTrays: 2, actualTrays: 2, remindAt: '22:18', actualOut: '22:26' },
      ] },
    ],
  },
];

/** 计划外的临时加菜：**不在任何批次内**，不参与任何判定，只作为事实统计。 */
const OFF_PLAN_ADDS = [
  { meal: '晚餐', name: '小炒杏鲍菇肉片', trays: 3, remindAt: '18:49', actualOut: '18:55', reason: '临时接待加菜' },
];

/* ══ 日期筛选：当天用上面那套写死的数据，其它日期用**确定性**演示数据 ══════════
   菜单结构（菜名 / 计划量 / 备餐提醒时刻）对应「排产计划」，每天一样，所以直接沿用；
   随日期变的只有**实际执行结果**：实际出餐量、实际出餐时刻。
   ——这也让「计划 / 未完成 / 及时 / 延迟」四状态的对比在任意一天都成立。

   两条硬规矩（本项目在 demoRate 上方已经踩过，照抄同样的做法）：
   ① **不能用 Math.random()** —— 同一日期必须每次算出同一个值。否则重渲染、切日期再切回来、
      刷新页面都会变，截图汇报两张图对不上（AC05 / AC13）。
   ② **不能只用纯哈希噪声** —— 那样相邻两天毫无关联，切日期时整套数据整体跳变、看着像换了家食堂。
      所以「当天整体出餐水平」走低频正弦漂移（周期 5.7 / 13.3 天），
      哈希只负责每道菜的小幅抖动。好日子连着好、差日子连着差。 */
/* ══ 出餐明细的自动滚动 ══════════════════════════════════════════════════
   明细区是这一页唯一允许滚动的地方，而"全部餐段"下装着 926px 的内容、
   只露出 300px —— 大屏是**无人值守**的，不会有人去拖那根 6px 的滚动条，
   看不见的那 626px 等于不存在。所以让它自己滚：6 个批次挨个送到读者眼前。
   一轮 ≈ 25 秒（下 21s + 停在底部 2.5s + 跳回顶部 + 停在顶部 1.2s）。

   四处必须做对：
   ① ⚠️ **不能监听 `scroll` 事件来判定"用户动了"**。自己滚出来的也触发 `scroll`，
      监听它等于每滚一帧就把自己判成"用户操作"→ 第一次滚动后就永久暂停。
      只认**输入意图**：`wheel` / `touchstart` / `pointerdown`。
   ② **内容一变就回顶并重新判定**（靠 `resetKey`）。停在旧的 `scrollTop` 上，
      轻则停在半截、重则直接空白（新内容比旧的短）。
   ③ **不溢出就一点都不滚**。早餐/午餐/晚餐/夜宵都放得下，这时候绝不能让画面
      慢慢往下漂一两像素 —— 那是最像 bug 的一种表现。判据留 2px 给子像素舍入。
   ④ **`prefers-reduced-motion` 下直接不启动**。这和大屏的"无人值守"不冲突：
      它是一条无障碍底线，而且开了这个开关的人本来就不想看自动动画。

   ⚠️ **"鼠标在面板上"不能当成暂停条件**，只能"鼠标在面板上**动**"才算。
      用 `pointerenter` 暂停的话，墙屏上刚好有人把鼠标遗留在明细区，
      这块就**再也不会滚**了 —— 对一个无人值守的页面来说是致命的。
      所以做成"动过之后 4 秒内不滚，4 秒不动（人走了）自动接着滚"。

   ⚠️ **只向下滚，不回滚**。滚到底停一下，然后**直接回到顶部**再继续向下。
      早先做成"反向滚回顶部（3 倍速）"，看着像录像倒放 —— 读者的眼睛会跟着往上追，
      而且"顺着读一遍"和"上下往复"是两种节奏，前者才像"翻页"。
      代价是回顶那一瞬间是**跳变**，所以两头都要停顿：到底停够（让人看完最后一组），
      回顶也停一下（让人重新认出"这是第一组"），不然连读两遍会分不清轮次。
   ⚠️ `dt` 要钳在 100ms：标签页切到后台再切回来时 `rAF` 的时间差会是几十秒，
      不钳的话画面会"咻"地跳到最后。 */
const AUTO_SCROLL = {
  speed: 30,          // 向下滚 px/s。行高 36px ⇒ 约 0.83 行/秒，够读完一行小注
  holdBottom: 2500,   // 滚到底停多久（ms）—— 留够时间看最后一个批次
  holdTop: 1200,      // 跳回顶之后停多久（ms）—— 让人认出"这是第一组"
  resumeDelay: 3000,  // 用户手动滚过之后多久恢复自动（ms）
  hoverPark: 4000,    // 鼠标在面板里动过之后，多久不动就认为"人走了"（ms）
  hoverLeave: 600,    // 鼠标移出面板之后多久恢复（ms）
};

function useAutoScroll(ref: React.RefObject<HTMLDivElement | null>, resetKey: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    let raf = 0;
    let last = 0;
    let waitUntil = 0;      // 停在两端的截止时间戳
    let manualUntil = 0;    // 用户手动滚动的截止时间戳
    let hoverUntil = 0;     // 鼠标在面板里动过的截止时间戳（到点就认为人走了）
    /* 到底之后要**分两步**：先在底部停 `holdBottom`，再跳回顶停 `holdTop`。
       用一个标志位记住"现在处于'已到底、等着回顶'这一步"。 */
    let pendingReset = false;

    /* 内容变了 → 回到顶部、重新来过。 */
    el.scrollTop = 0;
    waitUntil = 0;
    pendingReset = false;

    const markManual = () => { manualUntil = performance.now() + AUTO_SCROLL.resumeDelay; };
    const markHover = () => { hoverUntil = performance.now() + AUTO_SCROLL.hoverPark; };
    const onLeave = () => {
      hoverUntil = 0;
      manualUntil = performance.now() + AUTO_SCROLL.hoverLeave;
    };

    el.addEventListener('wheel', markManual, { passive: true });
    el.addEventListener('touchstart', markManual, { passive: true });
    el.addEventListener('pointerdown', markManual);
    el.addEventListener('pointermove', markHover, { passive: true });
    el.addEventListener('pointerenter', markHover);
    el.addEventListener('pointerleave', onLeave);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!last) { last = now; return; }
      const dt = Math.min(now - last, 100) / 1000;
      last = now;

      const max = el.scrollHeight - el.clientHeight;
      if (max <= 2) {                    // ③ 放得下：一点都不滚，顺手把位置归零
        if (el.scrollTop !== 0) el.scrollTop = 0;
        pendingReset = false;
        return;
      }
      if (now < hoverUntil || now < manualUntil) return;

      if (pendingReset) {                // 底部那一停结束 → 回顶，再停一下
        if (now < waitUntil) return;
        el.scrollTop = 0;
        pendingReset = false;
        waitUntil = now + AUTO_SCROLL.holdTop;
        return;
      }
      if (now < waitUntil) return;

      const next = el.scrollTop + AUTO_SCROLL.speed * dt;
      if (next >= max) {
        el.scrollTop = max;
        pendingReset = true;
        waitUntil = now + AUTO_SCROLL.holdBottom;
      } else {
        el.scrollTop = next;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('wheel', markManual);
      el.removeEventListener('touchstart', markManual);
      el.removeEventListener('pointerdown', markManual);
      el.removeEventListener('pointermove', markHover);
      el.removeEventListener('pointerenter', markHover);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [ref, resetKey]);
}

const parseClock = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

/** 分钟数 → "HH:MM"，并夹在 06:00~23:59 内（偏移可能把时刻推出当天）。 */
const formatClock = (total: number) => {
  const clamped = Math.max(6 * 60, Math.min(23 * 60 + 59, total));
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
};

/** 某天的整体出餐水平，约 −1.4 ~ +1.4（负 = 整体偏早，正 = 整体偏晚）。相邻日期彼此接近。 */
const dayLevel = (dateISO: string) => {
  const ordinal = dayOrdinalOf(new Date(`${dateISO}T00:00:00`));
  return Math.sin(ordinal / 5.7) * 0.62
    + Math.sin(ordinal / 13.3) * 0.34
    + (hashUnit(`level|${dateISO}`) - 0.5) * 0.9;
};

/** 按日期生成当天的实际执行结果。

    ⚠️ 偏移量**不能是「整体水平 + 均匀抖动」**。第一版写的是
   `level*6.5 + (hash-0.5)*16`（±17 分），而菜与菜之间的备餐提醒只隔 8~12 分钟 ——
   抖动跟间隔同量级时，「这道菜晚没晚」就变成了掷硬币，算出来及时率在 40%~85% 之间乱跳，
   比当天的 88% 差一大截，看着像「历史全都很糟」。**真实情况恰恰相反：大多数菜是准时的。**

   ⚠️ 第二版又错了一次：「准时」分支写成 `-5 + roll*7`（−5 ~ **+2**），
   上界 +2 分钟**已经晚于备餐提醒**了，于是那 34% 的「准时」菜被算成延迟，
   及时率只有 59%~80%。**判据是「actualOut ≤ remindAt」，所以准时分支必须严格 ≤ 0。**

   最终改成两个明确的量：
   ① 先按概率决定这道菜晚不晚 —— `lateChance` 由当日整体水平决定
      （好日子 0、坏日子约 17%），「好日子连着好、差日子连着差」的趋势仍然平滑；
   ② 晚了的菜取一个幅度（2~28 分），准时的菜则**严格落在提醒时刻之前** 0~7 分钟。
   结果及时率稳定在 83%~100%，且每天不同 —— 这才像一家正常运转的食堂。 */
const buildDemoDay = (dateISO: string): MealAchievement[] => {
  const lateChance = Math.max(0, 0.08 + dayLevel(dateISO) * 0.062);
  return MEAL_ACHIEVEMENTS.map((meal) => ({
    ...meal,
    batches: meal.batches.map((batch) => ({
      /* ⚠️ `...batch` 把批次号和 `dueAt` 整份带过来 —— **这是故意的**：
         批次的计划出餐时刻属于「排产计划」，每天一样，不能随日期重新生成。
         随日期变的只有下面 dishes 里的实际执行结果（实际出餐量、实际出餐时刻）。
         如果哪天给 dueAt 也套上一个「按日期抖动」，那「偏差」就不再是「执行 vs 计划」，
         而是「计划 vs 计划」—— 指标会彻底失去意义。 */
      ...batch,
      dishes: batch.dishes.map((dish) => {
        const roll = hashUnit(`out|${dateISO}|${dish.name}`);
        const magnitude = hashUnit(`mag|${dateISO}|${dish.name}`);
        const offset = roll < lateChance
          ? 2 + Math.pow(magnitude, 1.3) * 26   // 晚 2~28 分
          : -magnitude * 7;                     // 提前 0~7 分（严格 ≤ 0，必定按时）
        const trayRoll = hashUnit(`tray|${dateISO}|${dish.name}`);
        const drop = dish.planTrays > 1 && trayRoll < 0.06 ? (trayRoll < 0.012 ? 2 : 1) : 0;
        return {
          ...dish,
          actualTrays: Math.max(dish.planTrays - drop, 0),
          actualOut: formatClock(parseClock(dish.remindAt) + Math.round(offset)),
        };
      }),
    })),
  }));
};

function MealPlanModule({ clock, onNavigate }: { clock: string; onNavigate: (id: string) => void }) {
  const toMinutes = (value: string) => {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  };

  /* 统计日期，默认当天。
     ⚠️ 当天走**写死的那套**数据（故事完整、每个数字都核对过），其它日期才走 buildDemoDay
        生成的值 —— 这样「打开就是一份讲得通的样板」，点别的日期又能看到数据真的在变。
     ⚠️ 日期必须真的驱动数据。挂一个日期框但数字纹丝不动，是最容易被当场试穿的假控件。 */
  const todayISO = toISODate(new Date());
  const [statDate, setStatDate] = useState(todayISO);
  /* ══ 餐段范围 ══════════════════════════════════════════════════════════
     用户的实际情况是「**大概率单餐段单批次，偶尔多餐段多批次**」，所以两种形态
     必须在**同一页**里都能走到：范围选到某一段 → 单餐段形态；选「全部」→ 多餐段形态。
     ⚠️ **不做成两套页面**（"单批版页面 + 多批版页面"）。两份迟早长得不一样，
        而且口径会分叉。
     ⚠️ 这个控件必须**真的改数**（KPI、明细、环形图、折线全部跟着变），
        挂一个不生效的范围选择器是最容易被当场试穿的假控件 —— 和日期筛选同一条规矩。 */
  const [mealScope, setMealScope] = useState<string>('all');
  /* ══ 批次筛选 ══════════════════════════════════════════════════════════
     主面板做成「按批次分组的明细」之后，"看哪个批次"就成了一个独立的入口。
     ⚠️ 批次筛选**必须和餐段筛选一样驱动整页**（KPI / 环形图 / 折线 / 明细），
        不能只筛明细 —— 只筛明细的话，KPI 说 92 盆、明细只列批次1 的 34 盆，
        同一屏两组数打架，读者第一个问题就是"哪个对"。
     ⚠️ 切餐段时要把它**重置回全部**：选项是按餐段联动生成的（早餐只有批次1），
        不重置会留下一个"当前餐段里不存在"的值，明细直接空掉。 */
  const [batchScope, setBatchScope] = useState<string>('all');
  /* 明细区的自动滚动（见上方的 `useAutoScroll`）。
     `resetKey` 只放**决定内容的那三个筛选**，不放 `clock` —— 时钟每秒 tick 一次，
     放进去会每秒把明细拽回顶部。 */
  const detailBodyRef = useRef<HTMLDivElement | null>(null);
  useAutoScroll(detailBodyRef, `${statDate}|${mealScope}|${batchScope}`);
  const dayMeals = statDate === todayISO ? MEAL_ACHIEVEMENTS : buildDemoDay(statDate);
  const sourceMeals = mealScope === 'all'
    ? dayMeals
    : dayMeals.filter((meal) => meal.id === mealScope);
  const scopeLabel = mealScope === 'all'
    ? '全部餐段'
    : (dayMeals.find((meal) => meal.id === mealScope)?.label ?? '全部餐段');
  /* 批次下拉的选项**按餐段联动生成**：早餐只有批次1，就不该让读者选到批次2 再看到空明细。 */
  const batchNos = Array.from(new Set(sourceMeals.flatMap((meal) => meal.batches.map((batch) => batch.no))))
    .sort((a, b) => a - b);
  const nowMinutes = clock ? toMinutes(clock.slice(-8, -3)) : new Date().getHours() * 60 + new Date().getMinutes();
  /* 已经过**本批计划出餐时刻**的批次不能再显示「未完成」：演示里把短缺量归入延迟出餐，
     只有还没到计划时刻的批次才保留未完成，避免出现「早餐还差 1 盆」这种不合业务的画面。
     选择历史日期时，整天都视为已结束，同样不保留未完成。
     ⚠️ 判据必须跟着**批次**走（`batch.dueAt`）。用原来那个餐段级截止时刻，
        午餐两个批次（计划 12:45 / 13:30）会共用 13:30 —— 第一批判定要硬等到 13:30 才生效，
        跟上面三栏、折线用的批次级判据不是同一个口径。
     ⚠️ 这段改写只把实际出餐时刻往**后**推（`max(actualOut, remindAt + 1)`），
        所以它只会让批次更接近「超时」、绝不会让它变早。前提是每个 `dueAt` 都比本批
        末道菜的备餐提醒晚至少 8 分钟（见 MEAL_ACHIEVEMENTS 的取值规则）——
        否则补这 1 分钟就可能把一批从达标翻成未达标，而**达标与否不该受当前时钟影响**。 */
  const activeMeals = sourceMeals.map((meal) => ({
    ...meal,
    /* ⚠️ 批次筛选用**过滤**（不是把某一批提到最前）：筛掉之后整页只剩这一个批次，
        餐段名照旧、批次号照旧 —— 明细的组头、KPI、环形图、折线全都自然跟着走，
        不需要任何一处单独改口径。 */
    batches: meal.batches
      .filter((batch) => batchScope === 'all' || String(batch.no) === batchScope)
      .map((batch) => {
        const batchHasPassed = statDate !== todayISO || nowMinutes >= toMinutes(batch.dueAt);
        if (!batchHasPassed) return batch;
        return {
          ...batch,
          dishes: batch.dishes.map((dish) => {
            if (dish.actualTrays >= dish.planTrays) return dish;
            const lateOut = Math.max(toMinutes(dish.actualOut), toMinutes(dish.remindAt) + 1);
            return { ...dish, actualTrays: dish.planTrays, actualOut: formatClock(lateOut) };
          }),
        };
      }),
  }));

  const allDishes = activeMeals.flatMap((meal) => meal.batches.flatMap((batch) => batch.dishes));
  const allBatches = activeMeals.flatMap((meal) => meal.batches);

  /* ══════════════════════════════════════════════════════════════════════
     一套四状态分解，三个维度都套用同一套：

         计划出餐量  =  已完成·及时  +  已完成·延迟  +  未完成

     ── 为什么这四个状态能严格加和 ─────────────────────────────────────
     计数单位统一用**盆**（不是道）。一道菜计划 4 盆、实出 3 盆：
         未完成 = 4 − 3 = 1 盆；已完成 = 3 盆，这 3 盆再按出餐时刻落进「及时」或「延迟」。
     于是每一盆都有唯一归属，三个维度各自求和都等于计划量 ——
     餐段 = Σ批次 = Σ菜，读者可以任意交叉核对，不会出现两处对不上账。
     （上一版按「道数」判、且一道菜只归一类，「晚出 3 道 + 少做 1 道」并不等于总数，
       既做不了加和校验，也没法在三个粒度上保持一致。）

     ── 三个状态的定义 ───────────────────────────────────────────────
     · 已完成·及时 = 实际出餐时刻**不晚于**备餐提醒、且数量足额的那部分盆数
     · 已完成·延迟 = 实际出餐时刻晚于备餐提醒、但数量足额的那部分盆数
     · 未完成     = 计划量 − 实际出餐量（没做出来的那部分）
     ⚠️ 一道菜「既少又晚」时：少的那部分算未完成、做到的那部分算延迟 —— 两部分各归其位，
        不像上一版那样整道菜只归一类、把信息压扁。
     ⚠️ 计划外的临时加菜**不进这四个状态里的任何一个**，只作为事实单独统计。

     ── 图表为什么这么排 ─────────────────────────────────────────────
     要求是「计划 / 未完成 / 及时完成 / 延迟完成 在图表里**体现对比**」，维度有菜品 / 批次 / 餐段。
     所以主图是**三栏并排的 100% 堆叠横向柱**：
       每栏 = 一个维度，每根条 = 该维度的一个对象，条内三段 = 三个状态，
       条长按计划量归一到 100%，右侧标出绝对计划量。
     这样两个方向的对比同时成立：**同一栏内不同对象之间**（哪个餐段/批次/菜更差），
     以及**同一根条内三个状态之间**（到底是没做完还是做晚了）。
     ══════════════════════════════════════════════════════════════════════ */

  type TraySplit = { plan: number; ontime: number; late: number; undone: number };
  const EMPTY_SPLIT: TraySplit = { plan: 0, ontime: 0, late: 0, undone: 0 };

  /** 一道菜的盆数分解。**三段之和恒等于 plan** —— 这是全页所有数字能对上的前提。 */
  const splitOfDish = (dish: BatchDish): TraySplit => {
    const done = Math.max(Math.min(dish.actualTrays, dish.planTrays), 0);
    const isLate = toMinutes(dish.actualOut) > toMinutes(dish.remindAt);
    return {
      plan: dish.planTrays,
      ontime: isLate ? 0 : done,
      late: isLate ? done : 0,
      undone: Math.max(dish.planTrays - done, 0),
    };
  };
  const addSplit = (a: TraySplit, b: TraySplit): TraySplit => ({
    plan: a.plan + b.plan,
    ontime: a.ontime + b.ontime,
    late: a.late + b.late,
    undone: a.undone + b.undone,
  });
  const sumSplits = (list: TraySplit[]) => list.reduce(addSplit, EMPTY_SPLIT);

  /* 批次的达标判定看**出餐时间**，基准是**本批次自己的计划出餐时刻** `batch.dueAt`。
     两套口径各答各的问题，互不替代：
       四状态回答「这一盆做没做出来、及不及时」（基准 = 单菜的备餐提醒）；
       批次达标回答「这一批有没有在本批计划时刻前全部出完」（基准 = 批次的计划时刻）。
     ⚠️ 基准必须是 `batch.dueAt` 而不是餐段窗口结束。用餐段窗口会让同餐段里
        越早的批次「提前量」越大（结构性假信号），细节见 MEAL_ACHIEVEMENTS 上方注释。 */
  const finishOf = (batch: MealBatch) => batch.dishes.reduce(
    (latest, dish) => (toMinutes(dish.actualOut) > toMinutes(latest.actualOut) ? dish : latest),
    batch.dishes[0],
  );
  const batchOver = (batch: MealBatch) =>
    toMinutes(finishOf(batch).actualOut) - toMinutes(batch.dueAt);
  const formatOver = (over: number) => (over > 0 ? `超 ${over} 分` : `提前 ${-over} 分`);

  /* ══ 明细：按批次分组的逐道菜清单 ═════════════════════════════════════
     主面板的形态从「三栏并列对比」改成「筛选 + 明细」：
       · 对比（谁比谁多、谁比谁晚）交给环形图和折线图 —— 图本来就该干这个；
       · 面板只负责**把当前范围里的每一道菜摊开**，读者要核对哪一行都查得到。
     这不是"把三栏删掉降级"，而是分工归位：原来那张 100% 堆叠条既想说比例
     又想说对比，结果两件事都只说了一半。

     ⚠️ 分组依据是**批次**，不是餐段：批次才是"没按计划"的判定单位（判据是
        `batch.dueAt`），也是四状态里唯一自带"计划时刻"的那一级。餐段名挂在
        组头标签里（`早餐·批次1`），所以筛到具体餐段时上下文也不会丢。
     ⚠️ 菜品行的 note 是**菜级**口径：`提醒 07:12 → 出餐 07:12 · 超 2 分`。
        基准是**这道菜自己的备餐提醒**，不是批次计划时刻 ——
        同一批的菜本来就错开一两小时出，拿批次的时刻当基准会让前面每道菜
        都显示"提前两小时"，那就是结构性假信号（详见折线图上方注释）。 */
  const detailGroups = activeMeals.flatMap((meal) => meal.batches.map((batch) => {
    const over = batchOver(batch);
    return {
      key: `${meal.id}-${batch.no}`,
      label: `${meal.label}·批次${batch.no}`,
      /* 组头就是原来那条「结论带」的内容，一个字没改 —— 批次的三段时间必须显示出来，
         不然读者没法核对「超 17 分」是怎么来的，只能凭信任接受。 */
      note: `计划 ${batch.dueAt} · 实际 ${finishOf(batch).actualOut} · ${formatOver(over)}`,
      bad: over > 0,
      dishes: batch.dishes.map((dish) => {
        const dishOver = toMinutes(dish.actualOut) - toMinutes(dish.remindAt);
        const split = splitOfDish(dish);
        return {
          key: `${meal.id}-${batch.no}-${dish.name}`,
          name: dish.name,
          note: `提醒 ${dish.remindAt} → 出餐 ${dish.actualOut} · ${
            dishOver > 0 ? `超 ${dishOver} 分` : dishOver < 0 ? `提前 ${-dishOver} 分` : '准时'
          }`,
          /* 高亮的判据是「这一道有没有偏差」，**不是**「晚没晚」：
             少做 1 盆但准点出餐的菜也要标出来（它的条里有红段，行名却不红就是自相矛盾）。 */
          bad: split.late > 0 || split.undone > 0,
          split,
        };
      }),
    };
  }));

  /* ⚠️ KPI 和环形图必须**从明细反推**（`detailGroups`），不能再各自 flatMap 一遍 ——
        两个来源看着一样，但只要有一处改了筛选条件就会分叉，而分叉的现象是
        "KPI 说 92 盆、明细只有 34 盆"这种一眼可见的矛盾。单一来源最省心。 */
  const detailDishCount = detailGroups.reduce((total, group) => total + group.dishes.length, 0);
  const daySplit = sumSplits(detailGroups.flatMap((group) => group.dishes.map((dish) => dish.split)));
  const ontimeRate = daySplit.plan ? (daySplit.ontime / daySplit.plan) * 100 : 0;

  /* 计划外的临时加菜：不进四状态、不进任何判定，也不进明细（用户明确要求不要）。
     只作为事实留在 KPI 里。 */
  const offPlanTrays = OFF_PLAN_ADDS.reduce((sum, add) => sum + add.trays, 0);

  /* ══ 折线图：不换图表类型，换「把哪个维度摊到 x 轴上」═══════════════════
     x 轴上的维度只有 1 个值就画不出线。单餐段单批次时「批次」维度只有 1 个值，
     所以**换一个对象数 ≥ 2 的维度继续用折线** —— 不改成柱子、不改成一行数字。

     ⚠️ 换 x 轴的同时**必须换基准**：
        · 批次视图：y = 批次出齐时刻 − **本批次自己的计划出餐时刻**；
        · 逐菜视图：y = 该菜出餐时刻 − **该菜自己的备餐提醒时刻**。
        逐菜视图**绝不能**用"批次计划时刻"当基准 —— 同一批的菜本来就按顺序错开一两小时出，
        拿批次的时刻当基准，前面每道菜都会显示"提前两小时"，正是那个结构性假信号。
        ⇒ 通用版：**换到更细的粒度时，基准也要一起下沉到那个粒度自己的承诺时刻。**
     ⚠️ 逐菜视图的 y 口径正好和 KPI 的「已完成·延迟」是同一条判据（都看备餐提醒），
        所以折线和 KPI 天然对得上账，这也顺带解决了之前「同屏两套基准看着打架」的问题。

     ⚠️ 阈值取 3 不取 2：一条折线至少要 3 个点才成立，2 个点只是一根线段（等价于柱状图）。
        2 个批次时退回逐菜视图，信息更多（6 道菜 > 2 个批次），
        而且批次级的对比本来就已经由批次栏承担了，没有信息损失。

     ⚠️ 必须取 `activeMeals`（而不是 `MEAL_ACHIEVEMENTS`）。写成固定数据时，切日期只改
        上面的 KPI 和三栏、折线纹丝不动 —— 会出现「KPI 说延迟 14 盆、折线只有 2 个批次超时」
        这种自相矛盾的画面。加了日期筛选/餐段范围之后，凡是从日期或范围派生的东西都要一起换源。 */
  const lineMode: 'batch' | 'dish' = allBatches.length >= 3 ? 'batch' : 'dish';
  const linePoints = lineMode === 'batch'
    ? activeMeals
      .flatMap((meal) => meal.batches.map((batch) => ({
        key: `${meal.label}-${batch.no}`,
        label: meal.batches.length > 1 ? `${meal.label}${batch.no}` : meal.label,
        dueAt: batch.dueAt,
        finish: finishOf(batch).actualOut,
        over: batchOver(batch),
      })))
      /* 批次视图按出餐先后排 —— 折线要读"这一餐是怎么一步步做完的"（时间序）。 */
      .sort((a, b) => toMinutes(a.finish) - toMinutes(b.finish))
    /* 逐菜视图**不排序**：数据本身就是按备餐提醒的先后排的，那就是生产顺序，
       按偏差大小重排会把时间序打乱，反而看不出"是从哪一道开始崩的"。 */
    : allDishes.map((dish) => ({
      key: dish.name,
      label: dish.name,
      dueAt: dish.remindAt,
      finish: dish.actualOut,
      over: toMinutes(dish.actualOut) - toMinutes(dish.remindAt),
    }));

  const pct = (value: number) => (daySplit.plan ? (value / daySplit.plan) * 100 : 0);

  /** 一根 100% 堆叠横条。三段用 flexGrow 分配宽度，和为 0 的段自然宽 0。 */
  const SplitBar = ({ split, bad }: { split: TraySplit; bad?: boolean }) => (
    <div className={`uk-detail-track${bad ? ' bad' : ''}`} aria-label={`及时 ${split.ontime} 盆，延迟 ${split.late} 盆，未完成 ${split.undone} 盆`}>
      <i className="ontime" style={{ flexGrow: split.ontime }}>{split.ontime > 0 ? <b>{split.ontime}</b> : null}</i>
      <i className="late" style={{ flexGrow: split.late }}>{split.late > 0 ? <b>{split.late}</b> : null}</i>
      <i className="undone" style={{ flexGrow: split.undone }}>{split.undone > 0 ? <b>{split.undone}</b> : null}</i>
    </div>
  );

  return (
    <CockpitModuleShell current="overview" clock={clock} onNavigate={onNavigate}>
      <main className="uk-plan-page">
        <div className="uk-plan-kpi-row">
          {/* 页面级控件：统计日期 + 餐段范围 + 批次。它们共同决定"这一屏统计的是哪一段"，
              所以 KPI 行、环形图、折线图、明细全都跟着变。 */}
          <div className="uk-plan-controls">
            <label className="uk-date-switch">
              <span>统计日期</span>
              <input
                type="date"
                value={statDate}
                max={todayISO}
                onChange={(event) => setStatDate(event.target.value || todayISO)}
              />
            </label>
            <label className="uk-date-switch">
              <span>餐段范围</span>
              <select
                value={mealScope}
                /* ⚠️ 切餐段要**顺便把批次重置回全部**：批次选项是按餐段联动生成的
                   （早餐只有批次1），不重置会留下一个当前餐段里不存在的值，
                   明细直接空掉、KPI 全是 0 —— 而控件看上去一切正常，最难查的那种 bug。 */
                onChange={(event) => {
                  setMealScope(event.target.value);
                  setBatchScope('all');
                }}
              >
                <option value="all">全部餐段</option>
                {dayMeals.map((meal) => (
                  <option key={meal.id} value={meal.id}>{meal.label}</option>
                ))}
              </select>
            </label>
            <label className="uk-date-switch">
              <span>批次</span>
              <select value={batchScope} onChange={(event) => setBatchScope(event.target.value)}>
                <option value="all">全部批次</option>
                {batchNos.map((no) => (
                  <option key={no} value={String(no)}>批次{no}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="uk-module-kpis uk-plan-kpis">
            <ModuleKpi
              label="计划出餐"
              value={`${daySplit.plan} 盆`}
              meta={
                <>
                  <span><i>{allDishes.length}</i> 道菜</span>
                  <span><i>{allBatches.length}</i> 个批次</span>
                </>
              }
            />
            <ModuleKpi label="已完成 · 及时" value={`${daySplit.ontime} 盆`} sideValue={`${pct(daySplit.ontime).toFixed(1)}%`} tone="green" />
            <ModuleKpi label="已完成 · 延迟" value={`${daySplit.late} 盆`} sideValue={`${pct(daySplit.late).toFixed(1)}%`} tone="amber" />
            <ModuleKpi label="未完成" value={`${daySplit.undone} 盆`} sideValue={`${pct(daySplit.undone).toFixed(1)}%`} tone="red" />
            <ModuleKpi label="临时加菜" value={`${offPlanTrays} 盆`} tone="blue" />
          </div>
        </div>

        <section className="uk-module-panel uk-detail-panel">
          <div className="uk-module-panel-head">
            <div>
              <h2>出餐明细</h2>
              {/* 副标题把「这一屏看的是哪一段的账」写一遍，顺带交代明细的规模
                  （几个批次、几道菜、多少盆）。 */}
              <p>
                {scopeLabel}{batchScope === 'all' ? '' : ` · 批次${batchScope}`}
                {' · '}{detailGroups.length} 个批次 · {detailDishCount} 道菜 · 计划 {daySplit.plan} 盆
              </p>
            </div>
          </div>

          <div className="uk-detail-legend">
            <span><i className="ontime" />已完成 · 及时</span>
            <span><i className="late" />已完成 · 延迟</span>
            <span><i className="undone" />未完成</span>
            {/* 尾列写的是 `3 / 4` 这种紧凑写法，不给标签一定会被读反（详见该行的注释），
                所以在图例里统一交代一次，比每行都写一遍省地方。
                ⚠️ 这里的顺序必须和尾列的 JSX 保持一致 —— 图例说反了比不说更糟。 */}
            <em>条长 = 计划量（100%） · 尾列 = 已完成 / 计划 盆</em>
          </div>

          {/* ⚠️ 明细区**允许内部滚动**。这是这一版唯一一处滚动，而且是有意的：
              全部餐段下有 6 个批次、27 道菜，任何排版都塞不进 300px，
              硬压只能变成 20px 高的行或砍掉大部分菜 —— 那就不是"明细"了。
              筛到具体餐段/批次之后（用户说的"大概率"情形）基本一屏放得下。
              ⚠️ 溢出时**自己滚**（`useAutoScroll`）：大屏无人值守，没人会去拖滚动条。 */}
          <div className="uk-detail-body" ref={detailBodyRef}>
            {detailGroups.map((group) => (
              <div className="uk-detail-group" key={group.key}>
                {/* 组头 = 原来那条「结论带」的内容，一个字没改。批次的三段时间必须显示，
                    否则读者没法核对「超 17 分」是怎么来的。 */}
                <div className={`uk-detail-grouphead${group.bad ? ' bad' : ''}`}>
                  <b>{group.label}</b>
                  <span>{group.note}</span>
                  {/* ⚠️ 这里是**批次级**判据（基准 = 本批 dueAt），和图例里菜品级的
                      「已完成·及时 / 已完成·延迟」是两套口径、共用一对词。别把它们当同一个数：
                      早餐·批次1 组头是「延迟」（末菜超 8 分），组内 11 道菜却都是及时的。 */}
                  <em>{group.bad ? '延迟' : '及时'}</em>
                </div>
                {/* ⚠️ 组内排**两列**。单栏全宽实测 1822px，一行里的条会长到 1600px ——
                    一根 100% 堆叠条拉到这么长，段与段的**长度对比**就失效了
                    （读者只能靠条里的数字读比例，等于把条画废）。
                    两列之后每列约 890px、条约 500px，回到可读区间。 */}
                <div className="uk-detail-rows">
                  {group.dishes.map((dish) => (
                    <div className={`uk-detail-row${dish.bad ? ' bad' : ''}`} key={dish.key}>
                      <div className="uk-detail-name">
                        <b>{dish.name}</b>
                        <small>{dish.note}</small>
                      </div>
                      <SplitBar split={dish.split} bad={dish.bad} />
                      <div className="uk-detail-tail">
                        {/* ⚠️ 顺序是**已完成 / 计划**，不是"计划 / 已完成"。别改回去：
                            早先写的是"计划在前"（`4 / 3` = 计划 4、完成 3），用户一眼看成
                            "做了 4 盆但只计划 3 盆"（超产），当场问"这个是不是反了"。
                            根因不是数字错，是这个写法**不自证**：27 行里 **26 行两数相等**
                            （4/4、3/3），两种读法都自洽 —— 唯一能暴露"谁在前"的就是那唯一
                            不等的一行，于是它看起来像写错的，而不是像异常数据。
                            斜杠 `/` 不携带方向，所以顺序必须挑**读者默认就会这么读**的那个：
                            "做了 3 盆、本来要 4 盆" ⇒ **已完成在前**。
                            已完成 = plan − undone（没做出来的那部分才是缺口）。 */}
                        <b>{dish.split.plan - dish.split.undone} / {dish.split.plan}</b>
                        <small>盆</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {/* 空态给一句实话，不要留一片空白让读者以为是加载失败。 */}
            {detailGroups.length === 0
              ? <p className="uk-detail-empty">这个范围里没有批次。</p>
              : null}
          </div>
        </section>

        <div className="uk-plan-bottom">
          <section className="uk-module-panel uk-donut-card">
            {/* 标题改用**和「出餐统计」逐字相同**的 `.uk-module-panel-head > h2` 结构。
                不手写一套「18px + #eaf7ff + 下边线」的样式去"模仿"——那样等上面那张卡
                调了字号/颜色/间距，这里不会跟着变，两张卡迟早长得不一样。 */}
            <div className="uk-module-panel-head">
              <div><h2>出餐情况占比</h2></div>
            </div>
            <div className="uk-donut-wrap">
              {(() => {
                const radius = 44;
                const circumference = 2 * Math.PI * radius;
                const segments = [
                  { cls: 'ontime', value: daySplit.ontime },
                  { cls: 'late', value: daySplit.late },
                  { cls: 'undone', value: daySplit.undone },
                ];
                let cursor = 0;
                return (
                  <div className="uk-cht-donut">
                    <svg viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r={radius} fill="none" stroke="#123c5e" strokeWidth="12" />
                      {segments.map((segment) => {
                        const fraction = daySplit.plan ? segment.value / daySplit.plan : 0;
                        const dash = `${(circumference * fraction).toFixed(1)} ${(circumference * (1 - fraction)).toFixed(1)}`;
                        const offset = (-circumference * cursor).toFixed(1);
                        cursor += fraction;
                        return (
                          <circle
                            key={segment.cls}
                            className={`uk-donut-seg ${segment.cls}`}
                            cx="50" cy="50" r={radius} fill="none" strokeWidth="12"
                            strokeDasharray={dash} strokeDashoffset={offset}
                            transform="rotate(-90 50 50)"
                          />
                        );
                      })}
                    </svg>
                    <div className="uk-cht-donut-c">
                      <b>{ontimeRate.toFixed(1)}%</b>
                      <small>按时完成</small>
                    </div>
                  </div>
                );
              })()}
              <div className="uk-donut-legend">
                {[
                  { cls: 'ontime', label: '及时', value: daySplit.ontime },
                  { cls: 'late', label: '延迟', value: daySplit.late },
                  { cls: 'undone', label: '未完成', value: daySplit.undone },
                ].map((item) => (
                  <div className={`uk-donut-item ${item.cls}`} key={item.cls}>
                    <i />
                    <b>{item.value} 盆</b>
                    <small>{item.label} {pct(item.value).toFixed(1)}%</small>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="uk-module-panel uk-line-card">
            <div className="uk-module-panel-head">
              <div>
                {/* ⚠️ 标题和图例**一起跟着 `lineMode` 换文案**，不能只换一半：
                    x 轴换成「菜」之后，图例还写「本批计划」的话，读者会拿两条不同的
                    基准去读同一张图。标题说"哪根轴"、图例说"基准是谁"，两个都得对。 */}
                <h2>{lineMode === 'batch' ? '各批次出餐偏差（分钟）' : '各道菜出餐偏差（分钟）'}</h2>
              </div>
            </div>
            {/* 图例从标题里**搬出来单独一行**，放在标题下面。
                原因：标题升到 18px 之后，`<em>` 再挂在同一行会跟标题抢视觉权重，
                而且标题变长时图例会先被挤到换行、把标题和图的间距搞乱。
                ⚠️ 标题升字号会让这一栏的**垂直空间净增约 40px**，下排卡的行高
                   （`.uk-plan-bottom` 的 flex-basis）必须同步加高，否则 SVG 会被压矮、
                   viewBox 的宽高比失配 → 折线图左右两侧留白（详见 style.css 的注释）。 */}
            <div className="uk-cht-legend">
              {lineMode === 'batch' ? (
                <>
                  <span><i className="bad" />超时 · 晚于本批计划</span>
                  <span><i className="ok" />提前 · 早于本批计划</span>
                </>
              ) : (
                <>
                  <span><i className="bad" />超时 · 晚于本菜备餐提醒</span>
                  <span><i className="ok" />提前 · 早于本菜备餐提醒</span>
                </>
              )}
            </div>
            <svg className="uk-cht-line" viewBox="0 0 1200 240">
              {(() => {
                /* ⚠️ 六条被实测逼出来的规矩，改这张图前先读完：

                   ① **y 恒等于「实际出餐时刻 − 该对象自己的承诺时刻」**（负值 = 提前），
                      承诺时刻是**哪一级**由 `lineMode` 决定，两套模式各一个基准：

                      · `batch` 模式：y = 批次出齐时刻 − **本批次自己的计划出餐时刻**
                        （`batch.dueAt`），不是餐段窗口结束 —— 这条最要紧。
                        上一版用的是餐段级截止时刻，而一个餐段只有**一个**截止时刻，
                        于是同餐段里越早的批次「提前量」必然越大，出现「早两个小时」这种
                        **没有度量意义**的数字（早餐拆 3 批时纵轴被 −114/−70 撑爆，
                        真正要看的 +8/+17 被压成一条细缝）。下沉到批次级之后偏差落到 −14~+17。
                      · `dish` 模式：y = 该菜出餐时刻 − **该菜自己的备餐提醒时刻**。
                        **绝不能**在图例/实现里偷偷用「批次计划时刻」当基准 ——
                        同一批的菜本来就按顺序错开一两小时出，拿批次的时刻当基准，
                        前面每道菜都会显示"提前两小时"，是结构性假信号。
                      ⇒ 通用版：**对象的粒度决定了基准取谁的承诺时刻，换 x 轴必须同时换基准。**
                        两个基准的区别只写在标题和图例里（`lineMode` 一起切），SVG 内不重复。

                      → 教训：图表不好看时，先回头看**数据模型本身合不合理**，
                        别急着在渲染层打补丁（当时打过一版「负半轴 ×0.16 压缩」的补丁，
                          模型改对之后整个删掉了）。

                   ② 纵轴写死，**不做自适应**。写死才能横向比不同日期 —— 一天一个刻度，
                      「今天偏差比昨天大」这种结论根本读不出来。
                      取值范围要**罩得住所有日期**，否则会被夹成一条平线（这个坑踩过两次：
                      先试过夹到下限、又试过压缩负半轴，都是因为模型错、范围取不出来）。
                      ⚠️ 写死的是**每一套模式各自一套**，不是全局一套：两套模式的基准不同、
                        数据分布完全不同（批次最多 +20，单道菜能到 +37），
                        硬凑一套刻度只会让其中一套永远贴边。它们也**永远不会同屏出现**，
                        所以"各自写死"并不违反"可比"这条 —— 可比性要求的是**同模式、跨日期**可比。

                      · `batch` 模式写死 **+25 / −30**：
                        上界：每道菜的偏移最多 +28 分，批次的出齐时刻取批内最晚，
                          所以 `over_max = 末道菜提醒 + 28 − dueAt`，六个批次里最大 = 晚2 的 +20；
                        下界：所有菜都提前 7 分时出齐时刻取「最晚那道提醒 − 7」，
                          最小 = 午2 的 −27。
                        即跨所有日期 over ∈ [−27, +20]，+25/−30 两侧都留了余量，**永远不会夹到**。
                        零线落在 45% 高度处（不是正中），红/绿两带高度接近，读起来对称。
                      · `dish` 模式写死 **+45 / −15**：
                        上界：demo 日的单菜偏移最多 +28（`2 + mag^1.3 × 26`），
                          但当天写死那套里**清蒸鲈鱼 13:10 → 13:47 = +37** 是全量最大，
                          所以取 +45（不是 +40 —— +40 时那个点的数值标注会顶到绘图区上沿）；
                        下界：准时分支严格落在提醒之前 0~7 分，最小 = −7，取 −15。
                        即跨所有日期 over ∈ [−7, +37]，两侧都留了余量。
                        零线落在 75% 高度处（比批次模式低）—— 这是**被数据逼的、不是画歪了**：
                          单菜偏差天然"绝大多数准点、少数几道晚半小时以上"，
                          要让那根 +37 的尖峰进得来，零线就只能压在下面。
                          代价是绿色带（提前侧）只有 42px 高 —— 但提前侧本来就只有 −7 的幅度，
                          真正要读的是"哪几道晚、晚了多少"，那条信息全在红带里。
                      `offScale` 的空心点分支保留着兜底，正常日期走不到。

                   ③ SVG 里的字号会被缩放。viewBox 是 1200 宽、卡片实际不到 1200，
                      缩放比 ≈0.87 —— 声明 9px 只有 **7.9px**，大屏上根本看不清。
                      这里的字号都比直觉大一号（`.uk-cht-pt` 声明 15 → 实际约 13）。

                   ④ 数值标注一律放在点的**上方**（py − 13）。原来写的是
                      「超时放上方、提前放下方」（py + 20），最低那个点的标注落在 y=180.4，
                      和 X 轴标注（y=182）**直接叠在一起**，第一个点的数值永远读不出来。

                   ⑤ 说明文字全部搬到 SVG **外面**（标题下面那行图例），SVG 内只留一个 "0"。
                      原因是零线位置随数据走，红带高度有限，
                      塞不下「超时 · 晚于本批计划 / 计划线 0 / 提前出餐」三行 12px 文字
                      （会互相压）。**HTML 文字是 1:1 的、SVG 文字要乘 0.87** ——
                      能搬出 SVG 的说明就搬出去。
                      ⚠️ 这一条同时也是「模式切换必须在 HTML 层做」的理由：
                        SVG 里的文字要跟着 `lineMode` 换说法的话，三处文案（标题/图例/SVG 内）
                        会分散在两个渲染层，改一处漏一处的概率大幅上升。

                   ⑥ y 值必须来自 `activeMeals`（见上面 linePoints 的注释），否则切日期时
                      这条折线不跟着变，和 KPI 自相矛盾。

                   ⚠️ viewBox 的**宽高比要和卡片接近**（1200:240 = 5.0），
                      否则 SVG 按 meet 等比缩放会左右留白（第一版 620×190 只用了中间 700px）。 */
                const viewW = 1200;
                /* 纵轴写死，但**两套模式各一套**（见规矩 ②）。
                   批次 over ∈ [−27, +20] ⇒ +25/−30；单菜 over ∈ [−7, +37] ⇒ +45/−15。 */
                const isBatchMode = lineMode === 'batch';
                const maxOver = isBatchMode ? 25 : 45;
                const minOver = isBatchMode ? -30 : -15;
                /* 基准叫什么，只在原生 tooltip 里用一次 —— 图例已经写清了，这里不重复占版面。 */
                const dueWord = isBatchMode ? '计划出餐' : '备餐提醒';
                const topPad = 34;
                const plotH = 170;
                const plotBottom = topPad + plotH;
                const axisY = 232;
                /* 左侧只留一个 "0" 刻度，所以 90 够 —— 第一个数据点的数值标注
                   （居中在 x=90、宽约 35）从 72 起，不会碰到 x=6 那个 "0"。 */
                const leftPad = 90;
                const px = (index: number) => leftPad + ((viewW - leftPad - 40) / Math.max(linePoints.length - 1, 1)) * index;
                const py = (over: number) => topPad
                  + ((maxOver - Math.max(minOver, Math.min(maxOver, over))) / (maxOver - minOver)) * plotH;
                const zeroY = py(0);
                const path = linePoints
                  .map((point, index) => `${index === 0 ? 'M' : 'L'} ${px(index).toFixed(1)} ${py(point.over).toFixed(1)}`)
                  .join(' ');
                return (
                  <g>
                    <rect x="0" y={topPad} width={viewW} height={(zeroY - topPad).toFixed(1)} className="uk-cht-zone-bad" />
                    <rect x="0" y={zeroY.toFixed(1)} width={viewW} height={(plotBottom - zeroY).toFixed(1)} className="uk-cht-zone-ok" />
                    <text x="6" y={(zeroY - 7).toFixed(1)} className="uk-cht-zero-t">0</text>
                    <line x1="0" y1={zeroY.toFixed(1)} x2={viewW} y2={zeroY.toFixed(1)} className="uk-cht-zero" />
                    <path d={path} className="uk-cht-poly" />
                    {linePoints.map((point, index) => {
                      const cy = py(point.over);
                      const offScale = point.over < minOver || point.over > maxOver;
                      return (
                        <g key={point.key}>
                          {/* 原生 tooltip：图上只有一个偏差数字，读者想核对「这几分钟是从哪个时刻
                              算出来的」时不用切回上面的栏。`dueWord` 负责按模式换基准的说法。 */}
                          <title>{`${point.label} ｜ ${dueWord} ${point.dueAt} ｜ 实际出餐 ${point.finish} ｜ ${point.over > 0 ? `超 ${point.over} 分` : point.over < 0 ? `提前 ${-point.over} 分` : '准点'}`}</title>
                          <circle
                            cx={px(index).toFixed(1)} cy={cy.toFixed(1)} r="5.5"
                            className={`${point.over > 0 ? 'bad' : 'ok'}${offScale ? ' clamped' : ''}`}
                          />
                          <text
                            x={px(index).toFixed(1)}
                            y={(cy - 13).toFixed(1)}
                            className={point.over > 0 ? 'uk-cht-pt bad' : 'uk-cht-pt ok'}
                            textAnchor="middle"
                          >
                            {point.over > 0 ? `+${point.over}` : point.over}
                          </text>
                          <text x={px(index).toFixed(1)} y={axisY} className="uk-cht-xt" textAnchor="middle">{point.label}</text>
                        </g>
                      );
                    })}
                  </g>
                );
              })()}
            </svg>
          </section>
        </div>
      </main>
    </CockpitModuleShell>
  );
}

function DishStatsModule({ clock, onNavigate }: { clock: string; onNavigate: (id: string) => void }) {
  const todayISO = toISODate(new Date());
  const [statDate, setStatDate] = useState(todayISO);
  const sourceMeals = statDate === todayISO ? MEAL_ACHIEVEMENTS : buildDemoDay(statDate);
  const nowMinutes = clock ? parseClock(clock.slice(-8, -3)) : new Date().getHours() * 60 + new Date().getMinutes();
  const activeMeals = sourceMeals.map((meal) => ({
    ...meal,
    batches: meal.batches.map((batch) => {
      const batchHasPassed = statDate !== todayISO || nowMinutes >= parseClock(batch.dueAt);
      if (!batchHasPassed) return batch;
      return {
        ...batch,
        dishes: batch.dishes.map((dish) => {
          if (dish.actualTrays >= dish.planTrays) return dish;
          const lateOut = Math.max(parseClock(dish.actualOut), parseClock(dish.remindAt) + 1);
          return { ...dish, actualTrays: dish.planTrays, actualOut: formatClock(lateOut) };
        }),
      };
    }),
  }));

  type DishRollup = {
    key: string;
    name: string;
    segments: Set<string>;
    color: string;
    taskCount: number;
    batchKeys: Set<string>;
    planTrays: number;
    actualTrays: number;
    doneTasks: number;
    pendingTasks: number;
    lateTasks: number;
  };
  const rollups = new Map<string, DishRollup>();
  activeMeals.forEach((meal) => meal.batches.forEach((batch) => batch.dishes.forEach((dish) => {
    const key = dish.name;
    const current = rollups.get(key) ?? {
      key,
      name: dish.name,
      segments: new Set<string>(),
      color: DISHES.find((item) => item.name === dish.name)?.color ?? '#25e0ee',
      taskCount: 0,
      batchKeys: new Set<string>(),
      planTrays: 0,
      actualTrays: 0,
      doneTasks: 0,
      pendingTasks: 0,
      lateTasks: 0,
    };
    const done = dish.actualTrays >= dish.planTrays;
    current.segments.add(meal.label);
    current.taskCount += 1;
    current.batchKeys.add(`${meal.id}-${batch.no}`);
    current.planTrays += dish.planTrays;
    current.actualTrays += Math.min(dish.actualTrays, dish.planTrays);
    if (done) {
      current.doneTasks += 1;
      if (parseClock(dish.actualOut) > parseClock(dish.remindAt)) current.lateTasks += 1;
    } else {
      current.pendingTasks += 1;
    }
    rollups.set(key, current);
  })));

  const dishRows = Array.from(rollups.values());
  const statusOf = (dish: DishRollup) => dish.pendingTasks === 0 ? '已完成' : dish.doneTasks === 0 ? '未完成' : '部分完成';
  const statusClass = (status: string) => status === '已完成' ? 'done' : status === '部分完成' ? 'partial' : 'pending';
  const doneDishes = dishRows.filter((dish) => statusOf(dish) === '已完成').length;
  const partialDishes = dishRows.filter((dish) => statusOf(dish) === '部分完成').length;
  const pendingDishes = dishRows.filter((dish) => statusOf(dish) === '未完成').length;
  const segmentRows = MEAL_ORDER.map((segment) => {
    const items = dishRows.filter((dish) => dish.segments.has(segment));
    return {
      segment,
      total: items.length,
      done: items.filter((dish) => statusOf(dish) === '已完成').length,
      partial: items.filter((dish) => statusOf(dish) === '部分完成').length,
      pending: items.filter((dish) => statusOf(dish) === '未完成').length,
    };
  }).filter((row) => row.total > 0);
  const totalBatches = activeMeals.reduce((sum, meal) => sum + meal.batches.length, 0);

  return (
    <CockpitModuleShell current="dish" clock={clock} onNavigate={onNavigate}>
      <main className="uk-dish-page">
        <div className="uk-dish-head">
          <div>
            <span className="uk-module-kicker">出餐统计 · 方案二</span>
            <h1>菜品任务统计</h1>
            <p>按去重菜品看计划覆盖，工单数和批次数作为生产拆分信息补充</p>
          </div>
          <label className="uk-date-switch">
            <span>统计日期</span>
            <input type="date" value={statDate} max={todayISO} onChange={(event) => setStatDate(event.target.value || todayISO)} />
          </label>
        </div>

        <div className="uk-module-kpis uk-dish-kpis">
          <ModuleKpi label="计划菜品" value={`${dishRows.length} 道`} note="按菜品去重" />
          <ModuleKpi label="已完成" value={`${doneDishes} 道`} note="所有工单已完成" tone="green" />
          <ModuleKpi label="部分完成" value={`${partialDishes} 道`} note="同一道菜有未完成工单" tone="amber" />
          <ModuleKpi label="未完成" value={`${pendingDishes} 道`} note="尚未完成生产" tone="red" />
          <ModuleKpi label="生产工单" value={`${activeMeals.flatMap((meal) => meal.batches.flatMap((batch) => batch.dishes)).length} 个`} note="不去重" tone="blue" />
          <ModuleKpi label="覆盖批次" value={`${totalBatches} 个`} note="按批次去重" tone="cyan" />
        </div>

        <div className="uk-dish-main">
          <section className="uk-module-panel uk-dish-segment-panel">
            <div className="uk-module-panel-head">
              <div><h2>餐段菜品完成度</h2><p>每道菜只计一次，工单拆分不会放大菜品总数</p></div>
            </div>
            <div className="uk-dish-legend"><span><i className="done" />已完成</span><span><i className="partial" />部分完成</span><span><i className="pending" />未完成</span></div>
            <div className="uk-dish-segment-list">
              {segmentRows.map((row) => (
                <div className="uk-dish-segment-row" key={row.segment}>
                  <div className="uk-dish-segment-label"><b>{row.segment}</b><small>{row.total} 道菜</small></div>
                  <div className="uk-dish-segment-track" aria-label={`${row.segment}：已完成 ${row.done} 道，部分完成 ${row.partial} 道，未完成 ${row.pending} 道`}>
                    <i className="done" style={{ flexGrow: row.done }}>{row.done > 0 ? <b>{row.done}</b> : null}</i>
                    <i className="partial" style={{ flexGrow: row.partial }}>{row.partial > 0 ? <b>{row.partial}</b> : null}</i>
                    <i className="pending" style={{ flexGrow: row.pending }}>{row.pending > 0 ? <b>{row.pending}</b> : null}</i>
                  </div>
                  <strong>{row.done}/{row.total}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="uk-module-panel uk-dish-rule-panel">
            <div className="uk-module-panel-head"><div><h2>统计口径</h2><p>避免把菜品数和生产次数混成一个数字</p></div></div>
            <div className="uk-dish-rules">
              <div><b>菜品数</b><span>按菜品去重。同一道菜拆成多个工单，仍只算 1 道。</span></div>
              <div><b>生产工单</b><span>按工单实例统计。同一道菜拆成 3 个工单，就显示 3 个。</span></div>
              <div><b>覆盖批次</b><span>按批次去重，说明一道菜分布在哪些生产批次。</span></div>
            </div>
            <div className="uk-dish-example"><strong>示例</strong><span>青椒肉丝 · 1 道菜 / 3 个工单 / 2 个批次</span></div>
          </section>
        </div>

        <section className="uk-module-panel uk-dish-table-panel">
          <div className="uk-module-panel-head"><div><h2>菜品任务明细</h2><p>状态按该菜的全部工单汇总，延迟单独标注</p></div><strong>{dishRows.length} 道</strong></div>
          <div className="uk-dish-table">
            <div className="uk-dish-table-head"><span>菜品</span><span>状态</span><span>工单</span><span>批次</span><span>计划盆</span><span>完成盆</span><span>延迟工单</span></div>
            <div className="uk-dish-table-body">
              {dishRows.map((dish) => {
                const status = statusOf(dish);
                return (
                  <div className="uk-dish-table-row" key={dish.key}>
                    <span className="uk-dish-name"><i style={{ background: dish.color }} />{dish.name}<small>{Array.from(dish.segments).join(' / ')}</small></span>
                    <em className={statusClass(status)}>{status}</em>
                    <b>{dish.taskCount}</b>
                    <b>{dish.batchKeys.size}</b>
                    <b>{dish.planTrays}</b>
                    <b>{dish.actualTrays}</b>
                    <span className={dish.lateTasks > 0 ? 'late' : 'ok'}>{dish.lateTasks > 0 ? `${dish.lateTasks} 个` : '无'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </CockpitModuleShell>
  );
}

/* 膳食宝塔：位图（AI 生成的立体釉面食物宝塔）+ 矢量中文标注。
   ── 为什么不再用 SVG 手绘梯形堆 ──
   手绘只能到「渐变色块拼梯形」的程度，釉面/食物质感做不出来；换成实拍级位图后
   塔身本身就够精致，SVG 只负责两件事：把位图摆到位、把中文标注叠上去。
   ── 为什么中文不用生成在图里 ──
   生成模型画中文必然缺笔画/错字，且改克数就得重新出图；中文留作矢量文字，
   随《膳食指南》口径改字、缩放不糊、屏幕阅读器也能读。
   ── 坐标约定 ──
   viewBox 取 669×753 —— 正好是 1920×1080 下 .uk-pyramid-wrap 的内容盒
   （面板宽 755 − 左右 padding 26×2 = 703… 实测 669×753），
   所以下面每个数字就是屏幕像素，不用来回折算。 */
const PAGODA = { w: 669, h: 726, imgW: 528, imgH: 429, imgX: 8, imgY: 149, labelX: 542, leadEnd: 536 };
/* 位图原始尺寸 900×731（见 assets/diet-pagoda-3d.png），标注与引线的位置
   按原图像素给出后除以此宽度换算 —— 换图/换尺寸只改 PAGODA.imgW 即可。 */
const PAGODA_SRC_W = 900;
const PAGODA_SRC_H = 731;
/* 每一层「托盘中心」在原图里的纵向位置（拿刻度尺逐层量出来的）：
   名字行 + 克数块整体以它为中心排布，因此标注永远对着自己那一层，
   改字号只会让区块上下长一点，不会跑到隔壁层去。 */
const PAGODA_ANCHORS = [68, 195, 300, 415, 520, 650];
/* 每层引线的起点（原图 x）：从托盘右沿再往外让一点。
   顶层要让开盐罐（盐罐右沿 ≈ x549），否则虚线会横穿盐罐。 */
const PAGODA_LEAD_X = [560, 645, 705, 750, 825, 876];

/** 立体膳食宝塔：位图塔身 + 右侧矢量中文层名/克数 + 虚线引线。 */
function DietPagoda({ tiers }: { tiers: Array<{ label: string; tone: string; amounts: string[] }> }) {
  return (
    <svg
      className="uk-pagoda"
      viewBox={`0 0 ${PAGODA.w} ${PAGODA.h}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="膳食结构建议 · 中国居民膳食宝塔（每日推荐摄入量）"
    >
      <defs>
        {/* 塔身背光：深色面板上把宝塔「托」出来，同驾驶舱主色系（青蓝） */}
        <radialGradient id="pagoda-halo">
          <stop offset="0" stopColor="#2fd8ea" stopOpacity="0.20" />
          <stop offset="0.55" stopColor="#1b7ad0" stopOpacity="0.07" />
          <stop offset="1" stopColor="#020c1e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        cx={PAGODA.imgX + PAGODA.imgW * 0.49}
        cy={PAGODA.imgY + PAGODA.imgH * 0.5}
        rx={PAGODA.imgW * 0.78}
        ry={PAGODA.imgH * 0.66}
        fill="url(#pagoda-halo)"
      />
      <image
        className="uk-pagoda-photo"
        href={dietPagoda3d}
        x={PAGODA.imgX}
        y={PAGODA.imgY}
        width={PAGODA.imgW}
        height={PAGODA.imgH}
        preserveAspectRatio="xMidYMid meet"
      />
      {tiers.map((tier, i) => {
        const y = PAGODA.imgY + (PAGODA_ANCHORS[i] / PAGODA_SRC_H) * PAGODA.imgH;
        const n = tier.amounts.length;
        /* 区块高度 = 层名一行(16) + 每行克数(13)；yName 是层名行的中心。 */
        const blockH = 16 + n * 13;
        const yName = y - blockH / 2 + 8;
        const leadX1 = Math.min(
          PAGODA.imgX + (PAGODA_LEAD_X[i] / PAGODA_SRC_W) * PAGODA.imgW,
          PAGODA.leadEnd - 14,
        );
        return (
          <g className="uk-pagoda-tier" key={tier.label} style={{ animationDelay: `${240 + i * 70}ms` } as React.CSSProperties}>
            <line className="uk-pagoda-lead" x1={leadX1} y1={y} x2={PAGODA.leadEnd} y2={y} />
            <text className="uk-pagoda-name" x={PAGODA.labelX} y={yName} dominantBaseline="central">{tier.label}</text>
            {tier.amounts.map((line, k) => (
              <text className="uk-pagoda-amount" key={line} x={PAGODA.labelX} y={yName + 13 + k * 13} dominantBaseline="central">{line}</text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/* 「营养分析」单品轮播卡的六项指标：按用户给的版式排 3 列 × 2 行 ——
   第一行 能量 / 蛋白质 / 脂肪，第二行 膳食纤维 / 碳水化合物 / 胆固醇。
   顺序就是这个数组的顺序，改版式只改这里。
   单位用 kcal（不是参考图里的 kj）：本原型其它地方（套餐卡、趋势、「生产进度」）都是 kcal，
   一张页面上两种能量单位会让人以为有一处是错的。 */
const SPOTLIGHT_METRICS: Array<{ key: keyof Dish['nutrition']; label: string; unit: string }> = [
  { key: 'energy', label: '能量', unit: 'kcal' },
  { key: 'protein', label: '蛋白质', unit: 'g' },
  { key: 'fat', label: '脂肪', unit: 'g' },
  { key: 'fiber', label: '膳食纤维', unit: 'g' },
  { key: 'carbs', label: '碳水化合物', unit: 'g' },
  { key: 'cholesterol', label: '胆固醇', unit: 'mg' },
];
/* 单品轮播的停留时长。4.5s ≈ 够把 6 个数扫一遍、又不至于干等。 */
const NUTRITION_SLIDE_MS = 4500;

/* 三色标签的小圆点色值。只给今日菜单卡上那个 9px 的圆点用，不影响卡片其余配色。
   「绿」取偏青的 #3ddc84 而不是纯草绿 —— 深色科技蓝底上纯草绿会发脏。 */
const FOOD_COLOR_TONE: Record<FoodColor, string> = {
  绿: '#3ddc84', 黄: '#f7c948', 红: '#ff6b6b',
};
/* 「颜色建议」这一行要给的频次，**由颜色推导**（不是每道菜各写一遍）：
   数据放在这里，10 张卡上的同一个颜色就不可能给出两个口径。
   口径按《中国居民膳食指南（2022）》：蔬菜类建议每餐都有、蛋与谷薯建议天天吃、畜肉建议每周 2~3 次。 */
const FOOD_COLOR_ADVICE: Record<FoodColor, string> = {
  绿: '建议每餐食用', 黄: '建议每天食用', 红: '建议每周食用 2-3 次',
};

function NutritionHealthModule({ clock, onNavigate }: { clock: string; onNavigate: (id: string) => void }) {
  /* 营养分析改成「一次只讲一道菜」的轮播卡：10 道菜 × 6 项指标铺成整表时，
     一屏 60 个数字全在抢注意力，观众一个也记不住；改成单品卡后
     「这道菜的图 + 它自己的 6 个值」是唯一焦点，10 道菜自动过一遍，讲解时不用手点。 */
  const [slide, setSlide] = useState(0);
  const [tick, setTick] = useState(0); // 手动选菜后 +1，用来把自动轮播的计时重置（见下）
  const [hovering, setHovering] = useState(false);
  /* 自动播放默认开，但系统开了「减少动态效果」时不自动播 —— 自动轮播的内容必须给
     暂停入口（WCAG 2.2.2），顶部的暂停按钮 + 悬停暂停一起满足这条。 */
  const [autoPlaying, setAutoPlaying] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const selectedDish = DISHES[slide % DISHES.length];
  const recommendations = DISHES;

  /* tick 出现在依赖里但函数体没用到 —— 这是故意的：点「今日菜单」选菜后要让计时重来，
     否则刚点完 0.1 秒就被自动翻页抢走。改 tick 让 effect 重建定时器即可。 */
  useEffect(() => {
    if (!autoPlaying || hovering) return undefined;
    const timer = window.setInterval(() => setSlide((i) => (i + 1) % DISHES.length), NUTRITION_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [autoPlaying, hovering, tick]);

  const pickDish = (index: number) => {
    setSlide(index);
    setTick((n) => n + 1);
  };
  /* 膳食宝塔：按《中国居民膳食指南（2022）》的六层结构复刻参考图 ——
     油盐（顶层最窄）→ 奶及奶制品/大豆坚果 → 动物性食物 → 蔬菜/水果 → 谷薯 → 水（最宽塔基）。
     数值是各类食物的**每日推荐摄入量**，不是今日菜单的实测统计。 */
  const pyramidTiers = [
    { label: '油 · 盐', tone: 'oil', amounts: ['油 25~30克', '盐 <5克'] },
    { label: '奶豆坚果', tone: 'dairy', amounts: ['奶及奶制品 300~500克', '大豆及坚果类 25~35克'] },
    { label: '动物性食物', tone: 'protein', amounts: ['120~200克', '每周至少2次水产品', '每天一个鸡蛋'] },
    { label: '蔬菜 · 水果', tone: 'produce', amounts: ['蔬菜类 300~500克', '水果类 200~350克'] },
    { label: '谷薯类', tone: 'grain', amounts: ['谷类 200~300克', '全谷物和杂豆 50~150克', '薯类 50~100克'] },
    { label: '水', tone: 'water', amounts: ['1500~1700毫升'] },
  ];

  return (
    <CockpitModuleShell current="nutrition" clock={clock} onNavigate={onNavigate}>
      <main className="uk-nutrition-page">
        {/* 原「今日餐品 / 平均能量 / 早餐·午餐·晚餐 / 当前分析」四个 KPI 卡已删：
            营养健康页的信息主体是「结构 + 每道菜的营养值」，这四张卡全是重复口径
            （道数 hero 上有、平均能量没人用、餐段覆盖在出餐统计页、当前分析由选中高亮承担），
            删掉后页面少一层横向分段，宝塔和营养分析的版面能直接顶上去。 */}
        <div className="uk-nutrition-main">
          <section className="uk-module-panel uk-nutrition-pyramid">
            <div className="uk-module-panel-head"><div><h2>膳食结构建议</h2><p>参考《中国居民膳食指南》膳食宝塔的每日推荐结构</p></div></div>
            <div className="uk-pyramid-wrap">
              <DietPagoda tiers={pyramidTiers} />
              {/* 图注：把「这张图在说什么」写清楚 —— 宝塔画的是每日推荐摄入量，
                  不是今日菜单的实测营养（实测在右边「营养分析」表里）。
                  压成一行：两行会把宝塔挤矮 6%，且这句本来也不用占两行。 */}
              <div className="uk-pyramid-caption">
                <strong>每日推荐摄入量</strong>
              </div>
            </div>
          </section>

          <div className="uk-nutrition-side">
            {/* 单品轮播卡取代了原来的「营养分析」整表（整表已移到 .uk-nutrition-menu-table 的
                旧规则保留在 style.css 里，回退时可直接复用；对应 JSX 已删）。
                点击联动：点下方「今日菜单」任一卡 → 跳到那道菜并重置自动播放计时。 */}
            <section
              className="uk-module-panel uk-nutrition-spotlight"
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
              onFocusCapture={() => setHovering(true)}
              onBlurCapture={() => setHovering(false)}
            >
              <div className="uk-module-panel-head">
                <div><h2>营养分析</h2><p>每 100g 熟制成品 · 演示估算值</p></div>
                <div className="uk-spotlight-tools">
                  <span className="uk-module-panel-count">{slide + 1} / {DISHES.length}</span>
                  <button
                    type="button"
                    className="uk-spotlight-play"
                    aria-pressed={autoPlaying}
                    aria-label={autoPlaying ? '暂停自动轮播' : '继续自动轮播'}
                    onClick={() => setAutoPlaying((v) => !v)}
                  >
                    {autoPlaying ? '暂停轮播' : '继续轮播'}
                  </button>
                </div>
              </div>
              <div className="uk-spotlight-body">
                <figure className="uk-spotlight-figure">
                  {/* key 绑菜名：换菜时 img 重新挂载，CSS 入场动画才会重播 */}
                  <img key={selectedDish.name} src={DISH_IMAGES[selectedDish.name]} alt={`${selectedDish.name}菜品图`} />
                  <figcaption>
                    <span className="uk-spotlight-seg" style={{ background: selectedDish.color }}>{selectedDish.segment}</span>
                    <strong style={{ color: selectedDish.color }}>{selectedDish.name}</strong>
                  </figcaption>
                </figure>
                <div className="uk-spotlight-detail" key={`${selectedDish.name}-meta`}>
                  {/* 右栏三段：设备/进度 → 6 项营养 → 主料调料。
                      只放 6 个数字的话，右栏 555×328 会空掉大半（6 个标量撑不满），
                      所以把生产状态和配方也放进来 —— 都是 DISHES 里已有的真实字段。 */}
                  <div className="uk-spotlight-head">
                  </div>
                  <div className="uk-spotlight-grid">
                    {SPOTLIGHT_METRICS.map((metric) => (
                      <div className="uk-spotlight-cell" key={metric.key}>
                        <span>{metric.label}</span>
                        <b>{selectedDish.nutrition[metric.key]}<em>{metric.unit}</em></b>
                      </div>
                    ))}
                  </div>
                  <div className="uk-spotlight-uses">
                    <div><span>主料</span><b>{selectedDish.ingredients.join(' · ')}</b></div>
                    <div><span>调料</span><b>{selectedDish.seasonings.join(' · ')}</b></div>
                  </div>
                </div>
                <div className="uk-spotlight-dots" role="tablist" aria-label="选择要查看的菜品">
                  {DISHES.map((dish, index) => (
                    <button
                      type="button"
                      role="tab"
                      key={dish.name}
                      className={`uk-spotlight-dot${index === slide ? ' active' : ''}`}
                      style={index === slide ? { background: dish.color, borderColor: dish.color } : undefined}
                      aria-selected={index === slide}
                      aria-label={`查看${dish.name}的营养`}
                      onClick={() => pickDish(index)}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="uk-module-panel uk-recommended-panel">
              <div className="uk-module-panel-head"><div><h2>今日菜单</h2></div><span className="uk-module-panel-count">{recommendations.length} 道</span></div>
              <div className="uk-recommended-grid">
                {recommendations.map((dish, index) => <button type="button" className={`uk-recommended-card${selectedDish.name === dish.name ? ' active' : ''}`} key={dish.name} onClick={() => pickDish(index)}>
                  <span className="uk-recommended-visual"><img src={DISH_IMAGES[dish.name]} alt={`${dish.name}餐品图片`} loading="lazy" /></span>
                  {/* 卡面 3 行：①名称 + 餐段；②颜色建议（色点 + 色名 + 建议食用频次）；③份数。
                      原来第②行是「151 kcal · 蛋白质 5.5g」，已按要求删掉 ——
                      菜单卡上两个营养值既讲不清也记不住，这块位置让给颜色建议更可执行。
                      频次由颜色推导（FOOD_COLOR_ADVICE），不在 DISHES 里逐菜重复写。
                      份数取「人份」= total 盆 × PORTIONS_PER_TRAY：「盆」是生产单位，
                      菜谱卡上写盆数对看菜单的人是绕的，直接给人份数。 */}
                  <span className="uk-recommended-copy">
                    <span className="uk-recommended-title"><strong>{dish.name}</strong><em>{dish.segment}</em></span>
                    <span className="uk-recommended-color">
                      <i className="uk-food-tone" style={{ background: FOOD_COLOR_TONE[dish.foodColor] }} aria-hidden="true" />
                      <span className="uk-recommended-colorname">{dish.foodColor}</span>
                      <span>{FOOD_COLOR_ADVICE[dish.foodColor]}</span>
                    </span>
                    <span className="uk-recommended-parts">份数 <b>{dish.total * PORTIONS_PER_TRAY}</b></span>
                  </span>
                </button>)}
              </div>
            </section>
          </div>
        </div>
      </main>
    </CockpitModuleShell>
  );
}

function DeviceMonitorModule({ data, clock, onNavigate }: { data: ModuleSharedData; clock: string; onNavigate: (id: string) => void }) {
  const running = data.machines.filter((machine) => machine.state === '烹饪中').length;
  const devices = data.machines;
  return (
    <CockpitModuleShell current="process" clock={clock} onNavigate={onNavigate}>
      <div className="uk-module-kpis"><ModuleKpi label="设备总数" value={`${devices.length} 台`} note="候选配置 · 演示" /><ModuleKpi label="加工中" value={`${running} 台`} note="炒菜机 / 烤箱" tone="green" /><ModuleKpi label="待命" value={`${devices.length - running} 台`} note="等待下一生产次" tone="blue" /><ModuleKpi label="当前加工菜品" value={`${data.machines.filter((machine) => machine.state === '烹饪中').length} 道`} note="设备任务关联" tone="cyan" /></div>
      <section className="uk-module-panel uk-device-dashboard"><div className="uk-module-panel-head"><div><h2>设备运行矩阵</h2><p>设备状态、当前菜品和任务进度集中展示</p></div></div><div className="uk-device-grid-dashboard">{devices.map((device, index) => <article className="uk-device-card" key={device.id}><div className="uk-device-card-head"><span className="uk-machine-dot" style={{ background: device.color }} /><b>{device.id}</b><em className={device.state === '烹饪中' || device.state === '协同中' ? 'running' : 'idle'}>{device.state}</em></div><p>{device.dish}</p><div className="uk-device-progress"><i style={{ width: `${device.state === '烹饪中' ? 48 + (index % 4) * 9 : device.state === '协同中' ? 64 : 12}%`, background: device.color }} /></div><small>{device.state === '烹饪中' ? `任务进行中 · ${58 + (index % 3) * 7}%` : device.state === '协同中' ? '设备协同中' : '等待任务下发'}</small></article>)}</div></section>
      <div className="uk-module-grid uk-module-grid-bottom"><section className="uk-module-panel"><div className="uk-module-panel-head"><div><h2>设备分布</h2><p>按设备类型统计</p></div></div><div className="uk-device-type-bars"><div><span>炒菜机</span><i><b style={{ width: '100%' }} /></i><em>2 台</em></div><div><span>烤箱</span><i><b style={{ width: '50%' }} /></i><em>1 台</em></div></div></section><section className="uk-module-panel"><div className="uk-module-panel-head"><div><h2>状态说明</h2><p>接入现场数据后替换演示值</p></div></div><div className="uk-status-legend"><span><i className="running" />烹饪 / 加工中</span><span><i className="idle" />待命</span><span><i className="warn" />待接入数据</span></div><p className="uk-module-note">当前页面用于向领导展示设备协同关系，不提供启停、配方修改或任务下发操作。</p></section></div>
    </CockpitModuleShell>
  );
}

function TaskDispatchModule({ data, clock, onNavigate }: { data: ModuleSharedData; clock: string; onNavigate: (id: string) => void }) {
  return (
    <CockpitModuleShell current="equipment" clock={clock} onNavigate={onNavigate}>
      <div className="uk-module-kpis"><ModuleKpi label="早餐任务" value={`${data.dishes.filter((dish) => dish.segment === '早餐').length} 道`} note="计划已生成" /><ModuleKpi label="午餐任务" value={`${data.dishes.filter((dish) => dish.segment === '午餐').length} 道`} note="当前主餐段" tone="cyan" /><ModuleKpi label="晚餐任务" value={`${data.dishes.filter((dish) => dish.segment === '晚餐').length} 道`} note="待后续生产" tone="blue" /><ModuleKpi label="实际 / 计划" value={`${formatTrays(data.servedNow)} / ${formatTrays(data.totalPlan)}`} note={`${data.serveRate.toFixed(1)}%`} tone="green" /></div>
      <div className="uk-module-grid uk-module-grid-main"><section className="uk-module-panel uk-task-panel"><div className="uk-module-panel-head"><div><h2>今日菜品任务</h2><p>按餐段展示计划、完成和生产状态</p></div></div><div className="uk-task-table"><div className="uk-task-head"><span>餐段 / 菜品</span><span>计划</span><span>已完成</span><span>状态</span></div>{data.dishes.map((dish) => <div className="uk-task-row" key={dish.name}><span><i style={{ background: dish.color }} />{dish.segment} · {dish.name}</span><b>{dish.total} 批</b><b>{dish.done} 批</b><em className={data.dishState(dish) === '出餐完成' || data.dishState(dish) === '取餐完成' ? 'done' : ''}>{data.dishState(dish)}</em></div>)}</div></section><section className="uk-module-panel"><div className="uk-module-panel-head"><div><h2>出口完成情况</h2><p>出餐数量按出口汇总</p></div></div><div className="uk-exit-cards"><div><b>出口 1</b><strong>{formatTrays(150)} 盆</strong><span>3 批已完成</span><i><em style={{ width: '76%' }} /></i></div><div><b>出口 2</b><strong>{formatTrays(100)} 盆</strong><span>2 批已完成</span><i><em style={{ width: '58%' }} /></i></div></div><div className="uk-module-note">到达出口的批次会同步更新右侧出餐记录与顶部完成率。</div></section></div>
    </CockpitModuleShell>
  );
}

export default function UnmannedKitchenCockpit() {
  const [scale, setScale] = useState(1);
  const [clock, setClock] = useState('');
  /* 当天第几分钟。跟 clock 同一个 tick 更新 —— 「生产进度」要按它推当前餐段。
     初值直接取真实时间，避免首帧先按 00:00 渲染成早餐再跳一下。 */
  const [clockMinutes, setClockMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  const [servedNow, setServedNow] = useState(SERVED);
  const [servedBatches, setServedBatches] = useState<OutItem[]>([]);
  const [flowNow, setFlowNow] = useState(() => Date.now());
  const [flowStartedAt] = useState(() => Date.now());
  const [view, setView] = useState<ViewId>(readViewFromLocation);
  const navigate = (id: string) => {
    const next = normalizeViewId(id);
    setView(next);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('page', next === 'cockpit' ? 'operations' : next);
      window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  };

  useEffect(() => {
    const onPopState = () => setView(readViewFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setFlowNow(Date.now()), 80);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timeoutIds: number[] = [];
    const intervalIds: number[] = [];
    ACTIVE_ROUTE_PATHS.forEach((route) => {
      const routeDelayMs = Number.parseFloat(route.delay) * 1000;
      const firstArrivalMs = Math.max(1000, LINE_CYCLE_MS + routeDelayMs);
      const addServedBatch = () => {
        setServedNow((current) => Math.min(TOTAL_PLAN, current + route.increment));
        setServedBatches((current) => [
          { port: route.port, dish: route.dish, qty: route.dish === '番茄炒蛋' || route.dish === '蒸蛋羹' ? '1 盆 / 2kg' : '1 盆 / 1kg', color: route.color },
          ...current,
        ].slice(0, 3));
      };
      const timeoutId = window.setTimeout(() => {
        addServedBatch();
        intervalIds.push(window.setInterval(addServedBatch, LINE_CYCLE_MS));
      }, firstArrivalMs);
      timeoutIds.push(timeoutId);
    });
    return () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
      intervalIds.forEach((id) => window.clearInterval(id));
    };
  }, []);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const tickClock = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setClock(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}  ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
      setClockMinutes(now.getHours() * 60 + now.getMinutes());
    };
    tickClock();
    const timer = window.setInterval(tickClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // 所有演示状态共享同一条产线时钟，保证动线、列表、设备状态和出餐记录同步。
  const routePhase = (route: (typeof ACTIVE_ROUTE_PATHS)[number]) => {
    const delayMs = Number.parseFloat(route.delay) * 1000;
    const elapsed = flowNow - flowStartedAt - delayMs;
    return ((elapsed % LINE_CYCLE_MS) + LINE_CYCLE_MS) % LINE_CYCLE_MS / LINE_CYCLE_MS;
  };
  const routeForDish = (dishName: string) => ACTIVE_ROUTE_PATHS.find((route) => route.dish === dishName);
  /* 烹饪进度相位（0~1）：按真实秒数推进，用来算「已烹饪时间 / 状态」。
     这里不复用 14 秒的动线循环：动线是流程演示，烹饪计时要和右上角真实时钟同速。
     每道菜只错开 0~60 秒，保留不同菜品的时间差，但不会让时间突然跳很快。 */
  const cookPhase = (dish: Dish) => {
    const idx = DISHES.findIndex((item) => item.name === dish.name);
    const offsetSec = (idx % 3) * 30;
    const cookTotal = COOK_DURATION_SEC[dish.name] ?? 6 * 60;
    return Math.min(1, ((flowNow - flowStartedAt) / 1000 + offsetSec) / cookTotal);
  };
  /* 「生产进度」面板专用的状态推导：与该面板的已烹饪时间 / 温度 / 投料区同一套时钟（cookPhase），
     面板内部自洽。不复用 workOrderStatus（那是动画相位驱动、跟流程图托盘位置绑定、供其他页用），
     两套口径的分工：本面板 = 本餐实时烹饪快照；workOrderStatus = 全局工单状态（跟流程图走）。
     起止两档由盆数决定（done=0 → 未开始、done=total → 取餐完成），状态和盆数永远同源 ——
     修掉了「蒸蛋羹状态未开始、盆数却是 2/3」这种打架；中间态才看烹饪相位
     （<0.15 还在称重加料 = 投料区，之后开火 = 烹饪中）。
     注意必须定义在 segmentFeedingTrays 之前 —— const 有暂时性死区，后定义先引用会直接抛错。 */
  const cookState = (dish: Dish): WorkOrderStatus => {
    if (dish.done === 0) return '未开始';
    if (dish.done === dish.total) return '取餐完成';
    return cookPhase(dish) < 0.15 ? '称重中' : '烹饪中';
  };
  const isMachineCooking = (machineId: string) => {
    const machine = COCKPIT_MACHINES.find((item) => item.id === machineId);
    const route = machine ? routeForDish(machine.dish) : undefined;
    if (!route) return false;
    const phase = routePhase(route);
    return phase >= route.pauseStart && phase < route.pauseEnd;
  };
  const isTrayWaiting = (route: (typeof ACTIVE_ROUTE_PATHS)[number]) => {
    const phase = routePhase(route);
    return phase >= route.trayStart && phase < route.trayEnd;
  };
  /* 原 feedingRoutes（正走在入口通道的动线集合）已删：它只被「投料区」KPI 引用，
     而那个 KPI 已改成按烹饪进度推导（见 segmentFeedingTrays）—— 演示动线只有 3 条、
     只覆盖早餐/午餐，晚餐段用它算出来永远是 0。入口通道的托盘高亮仍由 isTrayWaiting 驱动。 */

  /* 当前餐段（由时钟推导，见 MEAL_TIME_WINDOWS）+ 这一餐的菜。
     「生产进度」只显示这一餐，顶部 KPI 与下面列表同口径 ——
     面板回答的是「此刻这一餐做到哪了」，不是「今天总共做了多少」（全天口径在「出餐统计」页）。
     不吃切换控件：现场这块屏是盯着当下这一餐的，多一个控件就多一个要看的地方。 */
  const currentSegment = mealSegmentOf(clockMinutes);
  const segmentDishes = DISHES.filter((dish) => dish.segment === currentSegment);
  /* 生产状态只认 18 态标准清单（见 WorkOrderStatus / WORK_ORDER_STATUS_OPTIONS）。
     原型里的「示例」不再自造「摆盆等待 / 已出餐 / 待进入」这类词 ——
     状态列显示的词必须能在「工单状态」筛选器里找到同一个，两边一份口径（2026-10-08 同步）。
     阈值跟入口 2 通道的托盘窗口绑定，保证「状态词」和「托盘位置」说的是同一件事。 */
  const workOrderStatus = (dish: Dish): WorkOrderStatus => {
    const route = routeForDish(dish.name);
    if (!route) return dish.done === dish.total ? '取餐完成' : dish.done > 0 ? '烹饪中' : '未开始';
    const phase = routePhase(route);
    if (phase < route.trayStart) return '未开始';
    if (phase < route.trayStart + 0.03) return '待称重';
    if (phase < route.trayStart + 0.07) return '称重中';
    if (phase < route.trayStart + 0.10) return '待加料';
    if (phase < route.trayStart + 0.13) return '加料中';
    if (phase < route.trayEnd) return '称重加料完成';
    if (phase < route.pauseStart - 0.04) return '摆盆中';
    if (phase < route.pauseStart) return '待烹饪';
    if (phase < route.pauseStart + (route.pauseEnd - route.pauseStart) * 0.35) return '预热中';
    if (phase < route.pauseEnd) return '烹饪中';
    if (phase < 0.88) return '烹饪完成';
    if (phase < 0.94) return '开始出餐';
    if (phase < 0.98) return '出餐完成';
    if (phase < 0.995) return '取餐中';
    return '取餐完成';
  };
  /* 菜品状态 = 工单状态，同一份映射，不再各写一套阈值（两套阈值迟早会分叉）。 */
  const dishState = (dish: Dish) => workOrderStatus(dish);
  const visibleMachines = COCKPIT_MACHINES.map((machine) => {
    const route = routeForDish(machine.dish);
    if (!route) return machine;
    const phase = routePhase(route);
    return { ...machine, state: phase < route.pauseStart ? '未开始' : phase < 0.88 ? '烹饪中' : '出餐完成' };
  });
  const allMachines = MACHINES.map((machine) => {
    const route = routeForDish(machine.dish);
    if (!route) return machine;
    const phase = routePhase(route);
    return { ...machine, state: phase < route.pauseStart ? '未开始' : phase < 0.88 ? '烹饪中' : '出餐完成' };
  });
  /* 汇总卡片和下面的列表必须共用这一组行数据：
     四个数字都按列表行数统计，避免列表只有 3 道菜时「生产总数」却显示 9 盆。
     盆数只在每行明细里展示，不混入这组菜品数量统计。 */
  const productionRows = segmentDishes.map((dish) => {
    const machine = visibleMachines.find((item) => item.dish === dish.name);
    const stateText = cookState(dish);
    const stateClass = ['称重中', '加料中', '摆盆中', '预热中', '烹饪中', '开始出餐', '取餐中'].includes(stateText)
      ? 'is-cooking'
      : ['称重加料完成', '摆盆完成', '烹饪完成', '出餐完成', '取餐完成'].includes(stateText)
        ? 'is-done'
        : 'is-waiting';
    const isCooking = stateText === '烹饪中';
    const cookTotal = COOK_DURATION_SEC[dish.name] ?? 6 * 60;
    const phase = cookPhase(dish);
    const cookElapsed = Math.floor(phase * cookTotal);
    const targetTemp = COOK_TARGET_TEMP[dish.name] ?? 185;
    const dishIndex = DISHES.findIndex((item) => item.name === dish.name);
    const cookTemp = Math.round(targetTemp + Math.sin((flowNow - flowStartedAt) / 2600 + dishIndex) * 2);
    return { dish, machine, stateText, stateClass, isCooking, cookTotal, cookElapsed, cookTemp };
  });
  const segmentDishCount = productionRows.length;
  const segmentDoneDishCount = productionRows.filter((row) => row.dish.done === row.dish.total).length;
  const segmentPendingDishCount = segmentDishCount - segmentDoneDishCount;
  const segmentFeedingDishCount = productionRows.filter((row) => row.stateText === '称重中').length;
  const visibleFlow = [...servedBatches, ...OUTFLOW].slice(0, 5);
  const serveRate = Math.min(100, (servedNow / TOTAL_PLAN) * 100);
  // sparkTrend 同时供总览页「今日出餐」摘要和模块页趋势使用。
  const sparkTrend = SPARK_TREND.map((point, index) => (
    index === SPARK_TREND.length - 1 ? { ...point, v: servedNow } : point
  ));
  const sparkPeak = Math.max(...sparkTrend.map((point) => point.v), 1);
  const productionCompletionRate = COMPLETED_PRODUCTION_TRAYS / Math.max(TOTAL_PRODUCTION_TRAYS, 1);

  const sharedData: ModuleSharedData = {
    servedNow,
    totalPlan: TOTAL_PLAN,
    serveRate,
    dishes: DISHES,
    machines: allMachines,
    trend: sparkTrend,
    outflow: visibleFlow,
    dishState,
    workOrderStatus,
  };
  if (view === 'nutrition') return (
    <div className="uk-viewport">
      <div className="uk-screen uk-module-screen" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <NutritionHealthModule clock={clock} onNavigate={navigate} />
      </div>
    </div>
  );
  if (view === 'dish') return (
    <div className="uk-viewport">
      <div className="uk-screen uk-module-screen" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <DishStatsModule clock={clock} onNavigate={navigate} />
      </div>
    </div>
  );
  if (view === 'overview' || view === 'process' || view === 'equipment') return (
    <div className="uk-viewport">
      <div className="uk-screen uk-module-screen" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <MealPlanModule clock={clock} onNavigate={navigate} />
      </div>
    </div>
  );

  return (
    <div className="uk-viewport">
      <div className="uk-screen" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <TopHeader current={view} clock={clock} onNavigate={navigate} />

        {view === 'behavior' && <BehaviorView />}

        <main className="uk-body" hidden={view !== 'cockpit'}>
          <aside className="uk-col">
            <section className="uk-panel uk-menu-dashboard">
              <h2>
                今日菜单
                <em className="uk-h2-count">{DISHES.length} 道</em>
              </h2>
              <div className="uk-menu-dashboard-summary">
                <div className="uk-menu-dish-count"><b>{DISHES.length}</b><span>道</span></div>
                <div className="uk-menu-output-stat"><span>总产量</span><strong>{TOTAL_PRODUCTION_TRAYS}<em>盆</em></strong><small><b>{formatKg(TOTAL_FEED_KG)}</b></small></div>
                <div className="uk-menu-output-stat"><span>当前已完成</span><strong>{COMPLETED_PRODUCTION_TRAYS}<em>/ {TOTAL_PRODUCTION_TRAYS} 盆</em></strong><small><b>{formatKg(COMPLETED_FEED_KG)}</b></small></div>
              </div>
              {/* 完成率压在进度条里（跟在填充条右端内侧），不另占一行也不另占一列。
                  两版历史：① 百分比 position:absolute;bottom:12px 浮在 8px 条上方，
                  实测条 top=303 / 百分比 bottom=299，骑在上一张摘要卡的底边上，
                  看着就是「和进度条不在一行」；② 改成 flex 同行、条让出右侧宽度，条被压短 46px。
                  现在叠回条上，条加厚到 16px 才装得下 11px 的字。
                  条里还要再包一层 .uk-menu-overall-bar：填充条 width 是百分比，相对的是
                  「轨道」宽度，不能让它直接相对整行算。
                  数字贴着填充条右端（right 由完成率算出，永远跟在条尾），落在亮渐变上，
                  所以用深色字；万一将来演示数据把完成率调到很低（<16%）就退回轨道右端改浅色字，
                  免得数字跑到填充条外面看不见 —— 见 .uk-menu-overall-track.is-in-fill。 */}
              {(() => {
                const overallPct = productionCompletionRate * 100;
                const pctInFill = overallPct >= 16;
                return (
                  <div
                    className={`uk-menu-overall-track${pctInFill ? ' is-in-fill' : ''}`}
                    aria-label={`当前已完成 ${COMPLETED_PRODUCTION_TRAYS} 盆，共 ${TOTAL_PRODUCTION_TRAYS} 盆，完成率 ${overallPct.toFixed(1)}%`}
                  >
                    <div className="uk-menu-overall-bar"><i style={{ width: `${overallPct}%` }} /></div>
                    <span style={pctInFill ? { right: `calc(${(100 - overallPct).toFixed(2)}% + 10px)` } : undefined}>
                      {overallPct.toFixed(1)}%
                    </span>
                  </div>
                );
              })()}
              <div className="uk-dish-stat-chart">
                <div className="uk-dish-stat-head"><span>餐品统计</span><span>已完成重量 / 总重量</span></div>
                <div className="uk-dish-stat-body">
                  {DISH_GROUPS.map((group) => (
                    <section className="uk-dish-stat-group" key={group.segment}>
                      <div className="uk-menu-group-heading"><span>{group.segment}</span><em>{group.dishes.length} 道</em></div>
                      {group.dishes.map((dish) => <div className="uk-dish-stat-row" key={dish.name}>
                        <span className="uk-nutrition-name" style={{ color: dish.color }}><i />{dish.name}</span>
                        <div className="uk-dish-stat-track"><i style={{ width: `${(dish.done / Math.max(dish.total, 1)) * 100}%`, background: dish.color }} /></div>
                        <b aria-label={`${dish.name} 已完成重量 ${dish.feedKg == null ? '暂无数据' : `${(dish.feedKg * (dish.done / Math.max(dish.total, 1))).toFixed(1)} kg`}，总重量 ${dish.feedKg == null ? '暂无数据' : `${dish.feedKg.toFixed(1)} kg`}`}>{formatDishWeight(dish)}</b>
                      </div>)}
                    </section>
                  ))}
                </div>
              </div>
            </section>
          </aside>

          <section className="uk-col uk-main">
            <section className="uk-panel uk-line">
              <h2>
                智厨生产流程<span className="uk-tag-demo">流程演示</span>
              </h2>
              <div className="uk-line-stage">
                <svg viewBox="0 0 1040 400" preserveAspectRatio="xMidYMid meet">
                  {/* 左侧统一为投料区，保留两个入口；三类设备路线最终汇入单一出口。 */}
                  <path className="uk-rail" d="M196 240 C250 240 294 240 350 240" />
                  <path className="uk-rail" d="M336 240 H350" />
                  <path className="uk-rail-glow" d="M196 240 C250 240 294 240 350 240" />
                  <path className="uk-rail-glow" d="M336 240 H350" />
                  {DEVICE_ROUTE_PATHS.map((path, index) => (
                    <path className="uk-route" d={path} key={`device-route-${index}`} />
                  ))}
                  {ACTIVE_ROUTE_PATHS.map((route) => (
                    <path id={`active-route-${route.id}`} className="uk-route-glow" d={route.path} key={`${route.id}-glow`} style={{ stroke: route.color }} />
                  ))}

                  <g className="uk-zone">
                    <rect x="60" y="80" width="290" height="300" rx="10" />
                    <text x="205" y="64" textAnchor="middle">投料区 · 2 个入口</text>
                    <rect className="uk-entry-lane" x="74" y="100" width="122" height="258" rx="7" />
                    <rect className="uk-entry-lane" x="214" y="100" width="122" height="258" rx="7" />
                    <text className="uk-entry-label" x="135" y="123" textAnchor="middle">入口 1</text>
                    <text className="uk-entry-label" x="275" y="123" textAnchor="middle">入口 2</text>
                    {/* 入口 1：预处理队列；进入称重加料流程后卡片淡出。 */}
                    {ACTIVE_ROUTE_PATHS.map((route, index) => (
                      <g className="uk-flow-queue-card uk-weigh-queue" key={`weigh-queue-${route.id}`} style={{ animationDelay: route.delay }}>
                        <rect x="82" y={148 + index * 58} width="106" height="30" rx="5" style={{ stroke: route.color }} />
                        <circle cx="94" cy={163 + index * 58} r="4" style={{ fill: route.color }} />
                        <text className="uk-flow-queue-label" x="104" y={167 + index * 58}>{route.dish}</text>
                      </g>
                    ))}
                    {/* 入口 2：称重加料等待；进入烹饪分支后对应卡片淡出。 */}
                    {ACTIVE_ROUTE_PATHS.map((route, index) => (
                      <g className="uk-flow-queue-card uk-tray-queue" key={`tray-queue-${route.id}`} style={{ opacity: isTrayWaiting(route) ? 1 : 0 }}>
                        <rect
                          className="uk-tray-wait"
                          x="222"
                          y={148 + index * 58}
                          width="106"
                          height="30"
                          rx="5"
                          style={{ stroke: route.color }}
                        />
                        <circle cx="234" cy={163 + index * 58} r="4" style={{ fill: route.color }} />
                        <text className="uk-tray-wait-label" x="244" y={167 + index * 58}>{route.dish}</text>
                      </g>
                    ))}
                  </g>

                  <g className="uk-zone">
                    <rect x="380" y="80" width="320" height="300" rx="10" />
                    <text x="540" y="64" textAnchor="middle">烹饪区 · 2 台炒菜机 / 1 台烤箱</text>
                    {[0, 1].map((i) => (
                      <g key={`c${i}`}>
                        {/* 台间呼吸灯错峰由内联延迟控制 */}
                        <rect
                          className={`uk-cooker ${isMachineCooking(`炒菜机 CCJ${i + 1}`) ? 'is-route-active' : ''}`}
                          x={427 + i * 108}
                          y="128"
                          width="62"
                          height="68"
                          rx="8"
                          style={{ animationDelay: `${(i % 2) * 1.4}s` }}
                        />
                        <text className="uk-cooker-label" textAnchor="middle">
                          <tspan x={458 + i * 108} y="158">{COCKPIT_MACHINES[i].model} 型</tspan>
                          <tspan className="uk-cooker-id" x={458 + i * 108} dy="14">CCJ{i + 1}</tspan>
                        </text>
                      </g>
                    ))}
                    {[0].map((i) => (
                      <g key={`o${i}`}>
                        <rect className={`uk-oven ${isMachineCooking(`烤箱 KX${i + 1}`) ? 'is-route-active' : ''}`} x="458" y="284" width="104" height="68" rx="8" />
                        <text className="uk-oven-label" x="510" y="323" textAnchor="middle">KX{i + 1}</text>
                      </g>
                    ))}
                  </g>

                  <g className="uk-zone">
                    <rect x="760" y="80" width="180" height="300" rx="10" />
                    <text x="850" y="64" textAnchor="middle">出餐区</text>
                    <rect className="uk-port is-route-active" x="778" y="206" width="144" height="68" rx="8" />
                    <text className="uk-port-label" x="850" y="245" textAnchor="middle">出口 1</text>
                  </g>

                  {/* 仅展示 3 条活动路线，避免大量并行动画遮住设备；标签直接显示菜名，
                      现场接入后可替换成当前工单的菜品简称。
                      菜名带回底色芯片（72×20 圆角矩形，fill/stroke/发光均取菜品色，
                      白字），在深色动线图上保证可读 —— 2026-10-08 按需求还原。 */}
                  {ACTIVE_ROUTE_PATHS.map((route, index) => {
                    /* 不用负数 begin：部分浏览器在 SVG 动画初始化时会把节点留在 (0,0)，
                       也就是流程卡片左上角。正向错峰启动，初始化前保持透明。 */
                    const animationBegin = `${(index * LINE_CYCLE_MS) / ACTIVE_ROUTE_PATHS.length / 1000}s`;
                    return (
                      <g className="uk-route-token" key={route.id} opacity="0">
                        <rect x="-36" y="-10" width="72" height="20" rx="4" style={{ fill: route.color, stroke: route.color, filter: `drop-shadow(0 0 4px ${route.color})` }} />
                        <text x="0" y="4" textAnchor="middle" style={{ fill: '#ffffff' }}>{route.dish}</text>
                        <animate
                          attributeName="opacity"
                          values="0;1;1;0"
                          keyTimes="0;0.08;0.88;1"
                          dur={`${LINE_CYCLE_MS / 1000}s`}
                          begin={animationBegin}
                          repeatCount="indefinite"
                        />
                        <animateMotion
                          dur={`${LINE_CYCLE_MS / 1000}s`}
                          begin={animationBegin}
                          repeatCount="indefinite"
                          rotate="0"
                          calcMode="linear"
                          keyPoints={route.keyPoints}
                          keyTimes={route.keyTimes}
                        >
                          <mpath href={`#active-route-${route.id}`} />
                        </animateMotion>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </section>

            <section className="uk-panel uk-cooking uk-production-progress">
              <h2>
                生产进度
              </h2>
              {/* 只统计当前餐段：四个格子的数字都能在下面 3–4 行里逐条加出来，
                  不会被问「为什么 4 行菜加不出 33 盆」。全天口径在「出餐统计」页。 */}
              <div className="uk-production-kpis">
                <div><b>{segmentDishCount}</b><span>生产总数</span></div>
                <div><b className="is-done">{segmentDoneDishCount}</b><span>已完成</span></div>
                <div><b className="is-pending">{segmentPendingDishCount}</b><span>未完成</span></div>
                <div><b className="is-feeding">{segmentFeedingDishCount}</b><span>投料区</span></div>
              </div>
              {/* 列名集中在表头，行里只留值 —— 和右栏「原料品牌公示」的表头做法一致。
                  每行重复「生产重量」「盆数」既占宽度又抢眼，去掉之后列宽才腾得出来。
                  行里也不重复餐段：面板已经只显示当前餐段、标题上写着，4 行说 4 遍是废话。 */}
              <div className="uk-production-head" aria-hidden="true">
                <span>菜品</span>
                <span>状态</span>
                <span>设备</span>
                <span>生产重量</span>
                <span>盆数</span>
                <span>进度</span>
              </div>
              {/* 一行一条：菜品 / 状态 / 设备 / 生产重量 / 盆数 / 进度条 六列横排。
                  只留一餐（3–4 道）之后行数本来就少，再摊成两列会让每行只剩 ~450px，
                  设备名和重量都得截断；单列铺满 ~930px，六列各占其位，
                  竖着扫一列就是「同一项在不同菜上的对比」。 */}
              <div className="uk-production-list">
                {productionRows.map(({ dish, machine, stateText, stateClass, isCooking, cookTotal, cookElapsed, cookTemp }) => {
                  /* 状态列用 cookState（面板专用、与已烹饪时间/温度/投料区同一套时钟），
                     仍然只取 18 态标准清单里的词，能在「工单状态」筛选器里找到同一个。
                     不用 workOrderStatus：那是动画相位驱动、跟流程图托盘绑定，
                     会让「状态未开始、盆数 2/3」这种打架出现在同一行里。 */
                  /* 烹饪中的菜，在状态胶囊旁补三样实时信息：已烹饪时间 / 总时长 / 设备温度。
                     三者都由 cookPhase 随产线时钟推进，不是写死的快照 ——
                     时间越走越接近总时长、温度越升越接近目标温度，画面才「活」。
                     只有「烹饪中」显示，别的状态这三项没意义（没开火哪来的已烹饪时间）。 */
                  const fmtCook = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}分${sec % 60}秒` : `${sec}秒`);
                  return (
                    <div className="uk-production-row" key={dish.name}>
                      <b className="uk-production-dish-name">{dish.name}</b>
                      <span className="uk-production-state">
                        <em className={stateClass}>{stateText}</em>
                        {isCooking && (
                          <span className="uk-production-cook-meta" aria-label={`${dish.name} 已烹饪 ${fmtCook(cookElapsed)}，总时长 ${fmtCook(cookTotal)}，设备温度 ${cookTemp} 摄氏度`}>
                            <i>{fmtCook(cookElapsed)}<b>/ {fmtCook(cookTotal)}</b></i>
                            <i>{cookTemp}<b>℃</b></i>
                          </span>
                        )}
                      </span>
                      {/* 设备取运行时设备（machine.id）优先，兜底取 dish.device —— 两者同源不会打架。
                          生产重量口径 = 称重加料区实测投料量；出餐端未接入称重，
                          所以不给成品重量与出成率（PRD:199/217）；未称重显示「—」，缺失不等于零（PRD:122）。 */}
                      <span className="uk-production-device">{machine?.id ?? dish.device}</span>
                      <span className="uk-production-feed">{dish.feedKg != null ? `${dish.feedKg.toFixed(1)} kg` : '—'}</span>
                      <b className="uk-production-tray">{dish.done} / {dish.total} 盆</b>
                      <div className="uk-production-dish-track" aria-label={`${dish.name} 完成 ${dish.done} 盆，计划 ${dish.total} 盆`}>
                        <i style={{ width: `${Math.min(100, (dish.done / Math.max(1, dish.total)) * 100)}%`, background: dish.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </section>

          <aside className="uk-col">
            <section className="uk-panel uk-realtime">
              <h2>明厨亮灶</h2>
              <div className="uk-camera uk-kitchen-video" aria-label="仿真后厨视频，2台自动炒菜机和1台烤箱工作中">
                <div className="uk-kitchen-grid" />
                <div className="uk-cctv-vignette" />
                <div className="uk-cctv-scanline" />
                <div className="uk-cctv-topline"><span className="uk-cctv-rec"><i />REC</span><span>CAM-01 · 后厨生产区</span><time>{clock.split('  ')[1] || '--:--:--'}</time></div>
                <div className="uk-kitchen-video-head"></div>
                <div className="uk-kitchen-photo-frame">
                  <img className="uk-kitchen-photo" src={kitchenImage} alt="仿真后厨画面：2台自动炒菜机和1台烤箱正在工作" />
                  <div className="uk-kitchen-photo-shade" />
                </div>
                <div className="uk-kitchen-stream"><i /></div>
              </div>
            </section>

            <section className="uk-panel uk-outflow">
              <h2 className="uk-outflow-heading">
                <span>出餐记录</span>
                {/* 「平均出餐时长」胶囊已移除（写死的演示值、无计算逻辑、不在 PRD 指标清单内） */}
              </h2>
              <div className="uk-flow">
                {visibleFlow.map((item, index) => (
                  <div className="uk-flow-row" key={`${item.port}-${item.dish}-${index}`}>
                    <span className="uk-flow-port" style={{ borderColor: item.color, color: item.color }}>{item.port}</span>
                    <span className="uk-flow-dish" style={{ color: item.color }}>{item.dish}</span>
                    <b>{item.qty}</b>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </main>

        <footer className="uk-bottom" hidden={view !== 'cockpit'}>
          <div className="uk-ticker">
            <div className="uk-ticker-track">
              {[...DISHES, ...DISHES].map((dish, index) => (
                <span key={`${dish.name}-${index}`}>
                  <i style={{ background: dish.color }} />{dish.name}
                </span>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
