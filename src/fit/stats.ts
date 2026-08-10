import { Workout, WorkoutType } from "./types";
import { workoutDistanceMeters, workoutDurationSeconds, estimateWorkoutKcal } from "./units";

// ---- 统计窗口/环比/分桶 纯函数(FitStats 用,now 可注入便于测试) ----

export interface Window {
  start: Date; // 含(本地 0 点)
  endExclusive: Date; // 不含(本地 0 点)
  days: number; // 区间天数(闭区间含首尾)
}

export interface PeriodSums {
  count: number;
  meters: number;
  seconds: number;
  kcal: number;
  byType: Record<WorkoutType, number>;
}

/** "YYYY-MM-DD" → 本地 0 点;非法/空 → null */
export const parseYmdLocal = (ymd: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  // 回绕校验:如 2026-02-31 会被 Date 归一化到 3 月,视为非法
  if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return null;
  return d;
};

/** 今天往前 n 天的 ymd(本地) */
export const ymdDaysAgo = (n: number, now = new Date()): string => {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
};

/** 日历算术位移(setDate),DST 安全;不要用裸减 86400000 */
export const shiftDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

/** 两个本地 ymd 之间的天数差(起止都算,起=止 为 1) */
export const daysBetweenYmd = (a: string, b: string): number | null => {
  const sa = parseYmdLocal(a);
  const sb = parseYmdLocal(b);
  if (!sa || !sb || sa > sb) return null;
  // Date.UTC 求差,避免 DST 引入小时差
  return Math.round((Date.UTC(sb.getFullYear(), sb.getMonth(), sb.getDate()) - Date.UTC(sa.getFullYear(), sa.getMonth(), sa.getDate())) / 86400000) + 1;
};

/**
 * 当前统计窗口:
 * - week: [今-6 0点, 明0点) | month: [今-29 0点, 明0点) | custom: [起 0点, 止+1天 0点)
 * - custom 起>止 或 ymd 非法 → null
 */
export const rangeWindow = (
  range: "week" | "month" | "custom",
  customStart: string,
  customEnd: string,
  now = new Date(),
): Window | null => {
  if (range === "custom") {
    const s = parseYmdLocal(customStart);
    const e = parseYmdLocal(customEnd);
    if (!s || !e || s > e) return null;
    return { start: s, endExclusive: shiftDays(e, 1), days: daysBetweenYmd(customStart, customEnd)! };
  }
  const days = range === "week" ? 7 : 30;
  const endExclusive = shiftDays(startOfDay(now), 1); // 明天 0 点
  return { start: shiftDays(endExclusive, -days), endExclusive, days };
};

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** 当前窗口等长前推(环比对比用) */
export const shiftWindow = (w: Window): Window => ({
  start: shiftDays(w.start, -w.days),
  endExclusive: shiftDays(w.endExclusive, -w.days),
  days: w.days,
});

/** 是否落在窗口内(本地日期比较;w.date 为 UTC ISO,需先转本地) */
export const inWindowRange = (w: Workout, win: Window): boolean => {
  const d = new Date(w.date);
  return d >= win.start && d < win.endExclusive;
};

/** 汇总一批训练(复用 units.ts 跨格式 helper) */
export const sumWorkouts = (items: Workout[]): PeriodSums => {
  const sums: PeriodSums = {
    count: items.length,
    meters: 0,
    seconds: 0,
    kcal: 0,
    byType: { running: 0, swimming: 0, strength: 0, swimming_set: 0 },
  };
  items.forEach((w) => {
    sums.byType[w.type]++;
    sums.meters += workoutDistanceMeters(w);
    sums.seconds += workoutDurationSeconds(w);
    sums.kcal += estimateWorkoutKcal(w);
  });
  return sums;
};

/** 环比百分比;上一期为 0 → null(0 基线,无法比较) */
export const pctChange = (cur: number, prev: number): number | null =>
  prev === 0 ? null : (cur - prev) / prev;

/** null → "—";0.12 → "+12%";-0.05 → "-5%";0 → "0%" */
export const formatPct = (pct: number | null): string => {
  if (pct === null) return "—";
  return `${pct > 0 ? "+" : ""}${Math.round(pct * 100)}%`;
};

export interface Bucket {
  start: Date; // 桶首日(本地 0 点)
  days: number; // 桶内天数
  count: number;
}

/** 按类型把每桶数值累加(与 buckets 对齐,不落桶的忽略);桶定位沿用 shiftDays 语义(末桶 days 记整 size) */
export const seriesByType = (
  items: Workout[],
  buckets: Bucket[],
  valueOf: (w: Workout) => number,
): Record<WorkoutType, number[]> => {
  const acc: Record<WorkoutType, number[]> = {
    running: buckets.map(() => 0),
    swimming: buckets.map(() => 0),
    strength: buckets.map(() => 0),
    swimming_set: buckets.map(() => 0),
  };
  items.forEach((w) => {
    const d = new Date(w.date);
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (d >= b.start && d < shiftDays(b.start, b.days)) {
        acc[w.type][i] += valueOf(w);
        break;
      }
    }
  });
  return acc;
};

/** 把 [start, endExclusive) 按天分桶,超过 maxBars 根时聚合(桶跨多天) */
export const bucketWindow = (start: Date, endExclusive: Date, maxBars = 60): Bucket[] => {
  const totalMs = endExclusive.getTime() - start.getTime();
  const days = Math.round(totalMs / 86400000);
  const size = Math.max(1, Math.ceil(days / maxBars));
  const buckets: Bucket[] = [];
  let cur = startOfDay(start);
  while (cur < endExclusive) {
    const next = shiftDays(cur, size);
    buckets.push({
      start: cur,
      days: size,
      count: 0,
    });
    cur = next;
  }
  return buckets;
};
