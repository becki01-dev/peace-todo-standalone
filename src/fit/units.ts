import {
  DistanceUnit,
  PoolUnit,
  WeightUnit,
  Workout,
  RunningData,
  SwimmingData,
  SwimmingMultiSetData,
  SwimmingSetData,
  StrengthData,
} from "./types";

// ---- Distance (base: meters) ----
export const metersToDisplay = (meters: number, unit: DistanceUnit): number => {
  if (unit === "mi") return meters / 1609.344;
  return meters / 1000;
};

export const distanceInputToMeters = (value: number, unit: DistanceUnit): number => {
  if (unit === "mi") return value * 1609.344;
  return value * 1000;
};

// ---- Weight (base: kg) ----
export const kgToDisplay = (kg: number, unit: WeightUnit): number =>
  unit === "lb" ? kg * 2.20462 : kg;

export const weightInputToKg = (value: number, unit: WeightUnit): number =>
  unit === "lb" ? value / 2.20462 : value;

// ---- Pool (base: meters) ----
export const poolMetersToDisplay = (meters: number, unit: PoolUnit): number =>
  unit === "yd" ? meters * 1.09361 : meters;

export const poolInputToMeters = (value: number, unit: PoolUnit): number =>
  unit === "yd" ? value / 1.09361 : value;

// Yard to meters conversion (for drill length input)
export const yardsToMeters = (yards: number): number =>
  yards / 1.09361;

export const metersToYards = (meters: number): number =>
  meters * 1.09361;

// ---- Duration ----
export const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export const hmsToSeconds = (h: number, m: number, s: number): number =>
  h * 3600 + m * 60 + s;

export const formatNumber = (n: number, digits = 2): string => {
  if (Number.isNaN(n)) return "0";
  const fixed = n.toFixed(digits);
  // 只删除小数部分末尾的0，保留整数部分
  if (digits === 0) {
    return fixed; // 如果不需要小数位，直接返回
  }
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
};

// Rough kcal estimation
export const estimateKcal = (
  type: "running" | "swimming" | "strength",
  data: { distance_meters?: number; duration_seconds?: number; weight_kg?: number; sets?: number; reps?: number },
): number => {
  if (type === "running" && data.distance_meters) {
    return Math.round((data.distance_meters / 1000) * 65);
  }
  if (type === "swimming" && data.duration_seconds) {
    return Math.round((data.duration_seconds / 60) * 9);
  }
  if (type === "strength" && data.sets && data.reps) {
    return Math.round(data.sets * data.reps * 0.5);
  }
  return 0;
};

// ---- Workout 跨格式统一读取(统计口径,与 WorkoutCard 展示逻辑一致) ----

/** 游泳数据是否为多片段格式(新格式含 sets 数组) */
const isMultiSetSwimming = (d: unknown): d is SwimmingMultiSetData =>
  !!d && typeof d === "object" && "sets" in d && Array.isArray((d as SwimmingMultiSetData).sets);

/** 单次训练的总距离(米):兼容 旧单条/新多片段/专项游泳组 */
export const workoutDistanceMeters = (w: Workout): number => {
  if (w.type === "running") return (w.data as RunningData).distance_meters || 0;
  if (w.type === "swimming") {
    const d = w.data as SwimmingData | SwimmingMultiSetData;
    return isMultiSetSwimming(d) ? d.total_distance_meters || 0 : d.distance_meters || 0;
  }
  if (w.type === "swimming_set") {
    // 专项组:按每个训练组 实际完成数 × 单次长度(未填完成数时按全量要求数)
    const d = w.data as SwimmingSetData;
    return d.sets.reduce((sum, s) => {
      const completed = s.completed_count ?? s.sets_count * s.count_per_set;
      return sum + completed * s.length_meters;
    }, 0);
  }
  return 0;
};

/** 单次训练的总时长(秒):专项组无实际用时,按 要求时间×实际完成组数 估算 */
export const workoutDurationSeconds = (w: Workout): number => {
  if (w.type === "running") return (w.data as RunningData).duration_seconds || 0;
  if (w.type === "swimming") {
    const d = w.data as SwimmingData | SwimmingMultiSetData;
    return isMultiSetSwimming(d) ? d.total_duration_seconds || 0 : d.duration_seconds || 0;
  }
  if (w.type === "swimming_set") {
    // 实际完成组数 = 完成总数 ÷ 每组个数(未填完成数时按全量组数)
    const d = w.data as SwimmingSetData;
    return d.sets.reduce((sum, s) => {
      const completedSets =
        s.count_per_set > 0 ? (s.completed_count ?? s.sets_count * s.count_per_set) / s.count_per_set : s.sets_count;
      return sum + completedSets * (s.target_time_seconds || 0);
    }, 0);
  }
  return 0;
};

/** 单次训练的预估卡路里:兼容四种类型的新旧格式 */
export const estimateWorkoutKcal = (w: Workout): number => {
  if (w.type === "running") return estimateKcal("running", w.data as RunningData);
  if (w.type === "swimming") {
    const d = w.data as SwimmingData | SwimmingMultiSetData;
    return estimateKcal("swimming", {
      duration_seconds: isMultiSetSwimming(d) ? d.total_duration_seconds : d.duration_seconds,
    });
  }
  if (w.type === "swimming_set") {
    // 与游泳同一速率(9 kcal/分钟),时长按要求时间估算
    return estimateKcal("swimming", { duration_seconds: workoutDurationSeconds(w) });
  }
  const d = w.data as StrengthData;
  if (d.session && Array.isArray(d.exercises) && d.exercises.length > 0) {
    // 会话格式:按总组数估算(与单动作 sets×reps 同速率)
    return Math.round((d.sets || 0) * 0.5);
  }
  return estimateKcal("strength", d);
};

/** 单次训练的总重量(kg):力量 单动作 weight×sets×reps;会话按 per-set 累加;bodyweight 组按 体重×次数 计入(未传体重则计 0);非力量 0。
 * 不按 done 过滤——表单里组默认 done:false(计划态),done 只是会话完成度 UI 状态,不是训练量标记。 */
export const workoutVolumeKg = (w: Workout, bodyWeightKg?: number | null): number => {
  const bw = bodyWeightKg && bodyWeightKg > 0 ? bodyWeightKg : 0;
  if (w.type !== "strength") return 0;
  const d = w.data as StrengthData;
  if (d.session && Array.isArray(d.exercises) && d.exercises.length > 0) {
    // 会话:per-set 累加;bodyweight 组 weight_kg=0,按 体重×次数 注入(bw=0 时自然归零)
    return d.exercises.reduce((sum, e) => {
      return sum + (e.sets ?? []).reduce((s, st) => {
        if (st.bodyweight) return s + bw * (st.reps || 0);
        return s + (st.weight_kg || 0) * (st.reps || 0);
      }, 0);
    }, 0);
  }
  // 单动作:bodyweight 显式 guard(老数据可能 weight_kg 非零)
  return d.bodyweight ? bw * (d.sets || 0) * (d.reps || 0) : (d.weight_kg || 0) * (d.sets || 0) * (d.reps || 0);
};

/** 是否含自重(bodyweight)组:单动作 bodyweight 或会话任一组 bodyweight(FitStats 未填体重提示条判断用) */
export const hasBodyweightGroups = (w: Workout): boolean => {
  if (w.type !== "strength") return false;
  const d = w.data as StrengthData;
  if (d.session && Array.isArray(d.exercises)) {
    return d.exercises.some((e) => (e.sets ?? []).some((st) => st.bodyweight));
  }
  return !!d.bodyweight;
};
