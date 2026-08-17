// 动作级 PR(个人纪录):1RM 估算 + 按动作的历史序列
// 口径(2026-08-17 用户拍板):1RM = Epley 公式;全部组计入(不按 done 过滤,
// 与 units.ts 的 workoutVolumeKg/exerciseAggs 一致);自重组有效重量 = 当日体重 + 附加重量
import { Workout } from "./types";

/** 单组有效重量(kg):自重组 = 体重 + 附加重量(通常 0),否则 = 器械重量 */
export const setEffectiveKg = (weightKg: number, bodyweight: boolean, bodyWeightKg: number | null): number =>
  bodyweight ? (bodyWeightKg ?? 0) + weightKg : weightKg;

/** Epley 1RM 估算:kg × (1 + reps/30);无效输入 → null */
export const est1rm = (weightKg: number, reps: number): number | null =>
  reps > 0 && weightKg > 0 ? weightKg * (1 + reps / 30) : null;

export interface ExerciseSet {
  weight_kg: number; // 有效重量(kg,已含自重折算)
  reps: number;
}

export interface ExerciseLog {
  date: Date;
  sets: ExerciseSet[]; // 该训练日该动作的全部组(按顺序)
}

/**
 * 提取指定动作的全部组记录(按日期升序)。
 * 兼容两种格式:legacy 单动作(d.exercise 精确匹配,组 = sets 组 × reps 次 × weight_kg)
 * 与会话(d.exercises[] name 精确匹配,逐组累加)。
 * weightAt:训练日期 → 当日体重(阶梯查找),自重组用;null 时自重组按 0 计(有效重量退化为附加重量)
 */
export const exerciseLogs = (
  workouts: Workout[],
  name: string,
  weightAt: (d: Date) => number | null,
): ExerciseLog[] => {
  const logs: ExerciseLog[] = [];
  workouts.forEach((w) => {
    if (w.type !== "strength") return;
    const d = w.data as { exercise?: string; session?: boolean; exercises?: Array<{ name: string; sets?: Array<{ weight_kg: number; reps: number; bodyweight?: boolean }> }>; weight_kg?: number; bodyweight?: boolean; sets?: number; reps?: number };
    const date = new Date(w.date);
    const bw = weightAt(date);
    if (d.session && Array.isArray(d.exercises) && d.exercises.length > 0) {
      const ex = d.exercises.find((e) => e.name === name);
      if (!ex) return;
      const sets = (ex.sets ?? [])
        .filter((s) => (s.reps ?? 0) > 0)
        .map((s) => ({
          weight_kg: setEffectiveKg(s.weight_kg || 0, !!s.bodyweight, bw),
          reps: s.reps,
        }));
      if (sets.length > 0) logs.push({ date, sets });
      return;
    }
    if (d.exercise !== name) return;
    const sets = Array.from({ length: d.sets || 0 }, () => ({
      weight_kg: setEffectiveKg(d.weight_kg || 0, !!d.bodyweight, bw),
      reps: d.reps || 0,
    })).filter((s) => s.reps > 0);
    if (sets.length > 0) logs.push({ date, sets });
  });
  logs.sort((a, b) => a.date.getTime() - b.date.getTime());
  return logs;
};

export interface PRPoint {
  date: Date;
  est1rm: number; // 该日最佳 1RM(kg)
  weight_kg: number; // 产生该 1RM 的组(有效重量)
  reps: number;
}

/** 按训练日聚合:每天取该动作最佳 1RM(无有效组的天跳过) */
export const prSeries = (logs: ExerciseLog[]): PRPoint[] =>
  logs
    .map((log) => {
      let best = { est1rm: 0, weight_kg: 0, reps: 0 };
      log.sets.forEach((s) => {
        const e = est1rm(s.weight_kg, s.reps) ?? 0;
        if (e > best.est1rm) best = { est1rm: e, weight_kg: s.weight_kg, reps: s.reps };
      });
      return best.est1rm > 0 ? { date: log.date, ...best } : null;
    })
    .filter((p): p is PRPoint => p !== null);

/** 突破历史:首次记录 + 每次刷新纪录(单调递增) */
export const prBreakthroughs = (series: PRPoint[]): PRPoint[] => {
  const out: PRPoint[] = [];
  let best = 0;
  series.forEach((p) => {
    if (p.est1rm > best) {
      best = p.est1rm;
      out.push(p);
    }
  });
  return out;
};

/** 当前 PR = 突破历史最后一项(无记录 → null) */
export const currentPr = (breakthroughs: PRPoint[]): PRPoint | null =>
  breakthroughs.length > 0 ? breakthroughs[breakthroughs.length - 1] : null;
