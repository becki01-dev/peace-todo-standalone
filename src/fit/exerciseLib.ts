// 力量训练动作字典:部位归属 / 默认设置(BW、次数)/ 常用动作统计
// 数据源优先级:user_exercises 表(用户登记)→ PRESET_DEFS(内置兜底)→ full_body(未知动作)

import { Workout } from "./types";

export type BodyPart = "chest" | "back" | "shoulders" | "arms" | "core" | "legs" | "neck" | "full_body";

export const BODY_PARTS: BodyPart[] = ["chest", "back", "shoulders", "arms", "core", "legs", "neck", "full_body"];

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  chest: "胸部",
  back: "背部",
  shoulders: "肩部",
  arms: "手臂",
  core: "腰腹核心",
  legs: "腿部",
  neck: "头颈",
  full_body: "全身",
};

export interface ExercisePreset {
  name: string;
  body_part: BodyPart;
  bodyweight: boolean; // 默认自重(BW)
  default_reps: number;
}

/** 内置预设动作(种子):用户首次保存时批量登记进 user_exercises,老数据统计也用它兜底 */
export const PRESET_DEFS: ExercisePreset[] = [
  { name: "深蹲", body_part: "legs", bodyweight: false, default_reps: 10 },
  { name: "硬拉", body_part: "back", bodyweight: false, default_reps: 8 },
  { name: "卧推", body_part: "chest", bodyweight: false, default_reps: 10 },
  { name: "引体向上", body_part: "back", bodyweight: true, default_reps: 10 },
  { name: "俯卧撑", body_part: "chest", bodyweight: true, default_reps: 12 },
  { name: "肩推", body_part: "shoulders", bodyweight: false, default_reps: 10 },
  { name: "划船", body_part: "back", bodyweight: false, default_reps: 10 },
  { name: "弓步", body_part: "legs", bodyweight: true, default_reps: 12 },
  { name: "二头弯举", body_part: "arms", bodyweight: false, default_reps: 12 },
  { name: "卷腹", body_part: "core", bodyweight: true, default_reps: 15 },
  { name: "平板支撑", body_part: "core", bodyweight: true, default_reps: 1 },
  { name: "臀桥", body_part: "core", bodyweight: true, default_reps: 12 },
];

/** user_exercises 表行(统计/表单用到的字段) */
export interface UserExercise {
  name: string;
  body_part: BodyPart;
  bodyweight_default: boolean;
  default_reps: number | null;
}

/** 动作部位:用户字典优先 → 内置预设兜底 → 全身 */
export const resolveBodyPart = (
  name: string,
  dict: UserExercise[],
  presets: ExercisePreset[] = PRESET_DEFS,
): BodyPart => {
  const hit = dict.find((e) => e.name === name);
  if (hit) return hit.body_part;
  return presets.find((p) => p.name === name)?.body_part ?? "full_body";
};

/** 动作默认设置(组预填用):用户字典优先 → 内置预设 → 无默认 */
export const exerciseDefaults = (
  name: string,
  dict: UserExercise[],
  presets: ExercisePreset[] = PRESET_DEFS,
): { bodyweight: boolean; default_reps: number | null } => {
  const hit = dict.find((e) => e.name === name);
  if (hit) return { bodyweight: hit.bodyweight_default, default_reps: hit.default_reps };
  const preset = presets.find((p) => p.name === name);
  return preset
    ? { bodyweight: preset.bodyweight, default_reps: preset.default_reps }
    : { bodyweight: false, default_reps: null };
};

/** 从力量训练历史聚合动作频率(按出现次数降序;单动作 legacy 也算) */
export const frequentExerciseNames = (workouts: Workout[], limit: number): string[] => {
  const counts = new Map<string, number>();
  workouts.forEach((w) => {
    if (w.type !== "strength") return;
    const d = w.data as { exercises?: Array<{ name: string }>; exercise?: string };
    if (Array.isArray(d.exercises)) {
      d.exercises.forEach((e) => counts.set(e.name, (counts.get(e.name) ?? 0) + 1));
    } else if (d.exercise) {
      counts.set(d.exercise, (counts.get(d.exercise) ?? 0) + 1);
    }
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh"))
    .slice(0, limit)
    .map(([name]) => name);
};
