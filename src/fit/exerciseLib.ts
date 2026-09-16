// 力量训练动作字典:部位归属 / 默认设置(BW、次数)/ 常用动作统计
// 数据源优先级:user_exercises 表(用户登记)→ PRESET_DEFS(内置兜底)→ full_body(未知动作)
//
// 全局映射(英文别名→中文、非预设中文→英文、中文变体→规范名)自 2026-08-18 起
// 由 Supabase exercise_dictionary 表提供(DB 唯一真相),App 内 /fit/exercises 可独立编辑,
// 增删改即时生效,不再需要改代码 + 迁移。运行时通过 ExerciseDictProvider(useExerciseDict)加载;
// 编辑页的写权限由 RLS 按 EXERCISE_DICT_ADMIN_EMAIL 邮箱强制(见迁移 SQL 的 admin 策略)。

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

/** 管理员邮箱:与 supabase/migrations/20260818120000_add_exercise_dictionary.sql 的 RLS admin 策略一致,改需两端同步 */
export const EXERCISE_DICT_ADMIN_EMAIL = "becki01@gmail.com";

export type ExerciseDictKind = "alias" | "en" | "zh_alias";

/** exercise_dictionary 表行(运行时/编辑页共用) */
export interface ExerciseDictEntry {
  id: string;
  kind: ExerciseDictKind;
  key: string;
  value: string;
}

/** 运行时字典视图(由 exercise_dictionary 表行组装;预设动作的结构化定义仍在代码 PRESET_DEFS) */
export interface ExerciseDict {
  /** 小写英文别名/变体 → 中文规范名 */
  aliases: Record<string, string>;
  /** 非预设动作的中文规范名 → 显示用英文名 */
  en: Record<string, string>;
  /** 中文变体 → 中文规范名(仅显示层兜底,数据不动) */
  zhAliases: Record<string, string>;
}

export const emptyDict = (): ExerciseDict => ({ aliases: {}, en: {}, zhAliases: {} });

/** 字典表行 → 视图;alias 键强制小写(与存储约定一致),未知 kind 忽略 */
export const dictFromRows = (rows: ExerciseDictEntry[]): ExerciseDict => {
  const d = emptyDict();
  rows.forEach((r) => {
    if (r.kind === "alias") d.aliases[r.key.toLowerCase()] = r.value;
    else if (r.kind === "en") d.en[r.key] = r.value;
    else if (r.kind === "zh_alias") d.zhAliases[r.key] = r.value;
  });
  return d;
};

export interface ExercisePreset {
  name: string;
  /** 英文名(显示用);小写形式收录在 exercise_dictionary 的 alias 表中 */
  en: string;
  body_part: BodyPart;
  bodyweight: boolean; // 默认自重(BW)
  default_reps: number;
}

/** 内置预设动作(种子):用户首次保存时批量登记进 user_exercises,老数据统计也用它兜底 */
export const PRESET_DEFS: ExercisePreset[] = [
  { name: "深蹲", en: "Squat", body_part: "legs", bodyweight: false, default_reps: 10 },
  { name: "硬拉", en: "Deadlift", body_part: "back", bodyweight: false, default_reps: 8 },
  { name: "卧推", en: "Bench Press", body_part: "chest", bodyweight: false, default_reps: 10 },
  { name: "引体向上", en: "Pull-up", body_part: "back", bodyweight: true, default_reps: 10 },
  { name: "俯卧撑", en: "Push-up", body_part: "chest", bodyweight: true, default_reps: 12 },
  { name: "肩推", en: "Overhead Press", body_part: "shoulders", bodyweight: false, default_reps: 10 },
  { name: "划船", en: "Barbell Row", body_part: "back", bodyweight: false, default_reps: 10 },
  { name: "弓步", en: "Lunge", body_part: "legs", bodyweight: true, default_reps: 12 },
  { name: "二头弯举", en: "Bicep Curl", body_part: "arms", bodyweight: false, default_reps: 12 },
  { name: "卷腹", en: "Crunch", body_part: "core", bodyweight: true, default_reps: 15 },
  { name: "平板支撑", en: "Plank", body_part: "core", bodyweight: true, default_reps: 1 },
  { name: "臀桥", en: "Glute Bridge", body_part: "core", bodyweight: true, default_reps: 12 },
];

/** 中文规范名 → 该动作的全部英文变体(预设 en + 别名表反查),搜索匹配用 */
export const aliasesFor = (name: string, dict: ExerciseDict): string[] => {
  const preset = PRESET_DEFS.find((p) => p.name === name);
  const fromAliases = Object.entries(dict.aliases)
    .filter(([, zh]) => zh === name)
    .map(([en]) => en);
  return preset ? [preset.en, ...fromAliases] : fromAliases;
};

/** 显示名:「中文 (英文)」;英文别名 → 「中文 (原文,保留输入大小写)」;中文变体 → 「变体 (规范英文)」;无映射原样返回 */
export const displayName = (name: string, dict: ExerciseDict): string => {
  const n = name.trim();
  if (!n) return name;
  const preset = PRESET_DEFS.find((p) => p.name === n);
  if (preset) return `${n} (${preset.en})`;
  const en = dict.en[n];
  if (en) return `${n} (${en})`;
  const zhNorm = dict.zhAliases[n];
  if (zhNorm) {
    const normEn = dict.en[zhNorm] ?? PRESET_DEFS.find((p) => p.name === zhNorm)?.en;
    if (normEn) return `${n} (${normEn})`;
  }
  const zh = dict.aliases[n.toLowerCase()];
  return zh ? `${zh} (${n})` : name;
};

/** 输入名 → 存储规范名:命中别名/英文预设 → 中文规范名;已是中文规范名保持;无映射原样(trim 后) */
export const normalizeExerciseName = (raw: string, dict: ExerciseDict): string => {
  const n = raw.trim();
  if (!n) return n;
  if (PRESET_DEFS.some((p) => p.name === n)) return n;
  return dict.aliases[n.toLowerCase()] ?? n;
};

/** 搜索匹配:name 自身或该动作任一英文别名(小写不敏感)包含 q;q 为空视为全部匹配 */
export const exerciseSearchMatch = (name: string, q: string, dict: ExerciseDict): boolean => {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  if (name.toLowerCase().includes(query)) return true;
  return aliasesFor(name, dict).some((a) => a.toLowerCase().includes(query));
};

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

/** 单动作历史用量:出现次数 + 最近一次训练日期 */
export interface ExerciseUsage {
  count: number;
  lastUsed: string | null;
}

/** 从力量训练历史聚合每个动作的用量;会话/legacy 两种格式都支持,非力量类型忽略 */
export const exerciseUsageByExercise = (workouts: Workout[]): Map<string, ExerciseUsage> => {
  const usage = new Map<string, ExerciseUsage>();
  workouts.forEach((workout) => {
    if (workout.type !== "strength") return;
    const data = workout.data as { exercises?: Array<{ name: string }>; exercise?: string };
    const names = Array.isArray(data.exercises)
      ? data.exercises.map((exercise) => exercise.name)
      : data.exercise
        ? [data.exercise]
        : [];
    const ts = Date.parse(workout.date);
    names.forEach((name) => {
      if (!name) return;
      const prev = usage.get(name) ?? { count: 0, lastUsed: null };
      const lastUsed =
        Number.isNaN(ts) || (prev.lastUsed && Date.parse(prev.lastUsed) >= ts) ? prev.lastUsed : workout.date;
      usage.set(name, { count: prev.count + 1, lastUsed });
    });
  });
  return usage;
};

/** 每个动作最近一次训练日期(ISO 字符串);会话/legacy 两种格式都支持,非力量类型忽略 */
export const lastUsedByExercise = (workouts: Workout[]): Map<string, string> => {
  const map = new Map<string, string>();
  exerciseUsageByExercise(workouts).forEach((usage, name) => {
    if (usage.lastUsed) map.set(name, usage.lastUsed);
  });
  return map;
};
