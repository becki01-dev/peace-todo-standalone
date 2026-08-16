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
  /** 英文名(显示用);小写形式必须收录在 EXERCISE_ALIASES(与 SQL 迁移映射一致) */
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

/**
 * 英文别名/变体(键全小写)→ 中文规范名。
 * 必须与 supabase/migrations/20260815120000_normalize_exercise_names.sql、
 * supabase/migrations/20260816120000_map_remaining_exercise_names.sql 的 alias_map 保持同一集合,
 * 增改需两端同步(完整性由 exerciseLib.test.ts 断言守护)。
 * 刻意排除易误伤的词:romanian deadlift/rdl、裸 "press" 等含糊名。
 */
export const EXERCISE_ALIASES: Record<string, string> = {
  squat: "深蹲",
  squats: "深蹲",
  "back squat": "深蹲",
  "goblet squat": "深蹲",
  "front squat": "深蹲",
  "bodyweight squat": "深蹲",
  "air squat": "深蹲",
  deadlift: "硬拉",
  deadlifts: "硬拉",
  "conventional deadlift": "硬拉",
  "sumo deadlift": "硬拉",
  "bench press": "卧推",
  benchpress: "卧推",
  bench: "卧推",
  "pull-up": "引体向上",
  "pull up": "引体向上",
  pullup: "引体向上",
  pullups: "引体向上",
  "chin-up": "引体向上",
  "chin up": "引体向上",
  chinup: "引体向上",
  chinups: "引体向上",
  "chin ups": "引体向上",
  "push-up": "俯卧撑",
  "push up": "俯卧撑",
  pushup: "俯卧撑",
  pushups: "俯卧撑",
  "press-up": "俯卧撑",
  "press up": "俯卧撑",
  "overhead press": "肩推",
  ohp: "肩推",
  "shoulder press": "肩推",
  "military press": "肩推",
  "strict press": "肩推",
  "barbell row": "划船",
  "bent-over row": "划船",
  "bent over row": "划船",
  "bentover row": "划船",
  rows: "划船",
  lunge: "弓步",
  lunges: "弓步",
  "walking lunge": "弓步",
  "walking lunges": "弓步",
  "forward lunge": "弓步",
  "bicep curl": "二头弯举",
  "biceps curl": "二头弯举",
  "bicep curls": "二头弯举",
  "biceps curls": "二头弯举",
  curl: "二头弯举",
  curls: "二头弯举",
  "barbell curl": "二头弯举",
  "dumbbell curl": "二头弯举",
  crunch: "卷腹",
  crunches: "卷腹",
  "sit-up": "卷腹",
  "sit up": "卷腹",
  situp: "卷腹",
  situps: "卷腹",
  plank: "平板支撑",
  planks: "平板支撑",
  "forearm plank": "平板支撑",
  "front plank": "平板支撑",
  "glute bridge": "臀桥",
  "glute bridges": "臀桥",
  "hip thrust": "臀桥",
  "hip thrusts": "臀桥",
  "hip bridge": "臀桥",
  // —— 预设 12 个之外的动作(无默认设置,由用户保存后登记进字典)——
  "leg curl": "腿弯举",
  "leg curls": "腿弯举",
  "hamstring curl": "腿弯举",
  "hamstring curls": "腿弯举",
  "lying leg curl": "腿弯举",
  "seated leg curl": "腿弯举",
  "leg extension": "腿屈伸",
  "leg extensions": "腿屈伸",
  "leg ext": "腿屈伸",
  "quad extension": "腿屈伸",
  "quad extensions": "腿屈伸",
  "leg press": "腿举",
  "leg presses": "腿举",
  "sled press": "腿举",
  "hack squat": "哈克深蹲",
  "calf raise": "提踵",
  "calf raises": "提踵",
  "standing calf raise": "提踵",
  "seated calf raise": "提踵",
  "seated calf": "提踵",
  "lat pulldown": "高位下拉",
  "lat pulldowns": "高位下拉",
  "lat pull-down": "高位下拉",
  "lat pull down": "高位下拉",
  pulldown: "高位下拉",
  "seated row": "坐姿划船",
  "seated rows": "坐姿划船",
  "cable row": "坐姿划船",
  "cable rows": "坐姿划船",
  "machine row": "坐姿划船",
  "reverse fly": "反向飞鸟",
  "reverse flies": "反向飞鸟",
  "rear delt fly": "反向飞鸟",
  "rear delt raise": "反向飞鸟",
  "rear delt": "反向飞鸟",
  "incline bench press": "上斜卧推",
  "incline press": "上斜卧推",
  "incline bench": "上斜卧推",
  "dumbbell press": "哑铃卧推",
  "dumbbell bench press": "哑铃卧推",
  "db press": "哑铃卧推",
  "db bench press": "哑铃卧推",
  "chest press": "器械推胸",
  "chest fly": "飞鸟",
  "chest flies": "飞鸟",
  "dumbbell fly": "飞鸟",
  "dumbbell flies": "飞鸟",
  "cable fly": "飞鸟",
  "pec deck": "飞鸟",
  "pec fly": "飞鸟",
  "lateral raise": "侧平举",
  "lateral raises": "侧平举",
  "side raise": "侧平举",
  "side raises": "侧平举",
  "front raise": "前平举",
  "front raises": "前平举",
  shrug: "耸肩",
  shrugs: "耸肩",
  "dumbbell shrug": "耸肩",
  "barbell shrug": "耸肩",
  "hammer curl": "锤式弯举",
  "hammer curls": "锤式弯举",
  "tricep pushdown": "绳索下压",
  "triceps pushdown": "绳索下压",
  "tricep push down": "绳索下压",
  "triceps push down": "绳索下压",
  pushdown: "绳索下压",
  "tricep extension": "臂屈伸",
  "triceps extension": "臂屈伸",
  "tricep extensions": "臂屈伸",
  "overhead tricep extension": "臂屈伸",
  "skull crusher": "臂屈伸",
  skullcrusher: "臂屈伸",
  dip: "双杠臂屈伸",
  dips: "双杠臂屈伸",
  "chest dip": "双杠臂屈伸",
  "bench dip": "双杠臂屈伸",
  "tricep dip": "双杠臂屈伸",
  "russian twist": "俄罗斯转体",
  "russian twists": "俄罗斯转体",
  "russian crunch": "俄罗斯转体",
  "russian crunches": "俄罗斯转体",
  "oblique twist": "俄罗斯转体",
  "leg raise": "举腿",
  "leg raises": "举腿",
  "hanging leg raise": "举腿",
  "lying leg raise": "举腿",
  burpee: "波比跳",
  burpees: "波比跳",
  "back bend": "背伸展",
  "back bends": "背伸展",
};

/** 非预设动作的规范名 → 显示用英文名(预设动作的英文名在 PRESET_DEFS.en;两端需与迁移 SQL 一致) */
export const EXERCISE_EN: Record<string, string> = {
  腿弯举: "Leg Curl",
  腿屈伸: "Leg Extension",
  腿举: "Leg Press",
  哈克深蹲: "Hack Squat",
  提踵: "Calf Raise",
  高位下拉: "Lat Pulldown",
  坐姿划船: "Seated Row",
  反向飞鸟: "Reverse Fly",
  上斜卧推: "Incline Bench Press",
  哑铃卧推: "Dumbbell Press",
  器械推胸: "Chest Press",
  飞鸟: "Chest Fly",
  侧平举: "Lateral Raise",
  前平举: "Front Raise",
  耸肩: "Shrug",
  锤式弯举: "Hammer Curl",
  绳索下压: "Tricep Pushdown",
  臂屈伸: "Tricep Extension",
  双杠臂屈伸: "Dip",
  俄罗斯转体: "Russian Twist",
  背伸展: "Back Extension",
  举腿: "Leg Raise",
  波比跳: "Burpee",
};

/**
 * 中文变体(用户自定义写法)→ 中文规范名,仅用于显示层英文补充。
 * 数据不动(用户保留自己的叫法),displayName 借此查出规范英文名,如「俄罗斯卷腹」→「俄罗斯卷腹 (Russian Twist)」。
 */
export const EXERCISE_ZH_ALIASES: Record<string, string> = {
  "俄罗斯卷腹": "俄罗斯转体",
  "卷腹提腿": "举腿",
};

/** 中文规范名 → 该动作的全部英文变体(预设 en + 别名表反查),搜索匹配用 */
export const aliasesFor = (name: string): string[] => {
  const preset = PRESET_DEFS.find((p) => p.name === name);
  const fromAliases = Object.entries(EXERCISE_ALIASES)
    .filter(([, zh]) => zh === name)
    .map(([en]) => en);
  return preset ? [preset.en, ...fromAliases] : fromAliases;
};

/** 显示名:「中文 (英文)」;英文别名 → 「中文 (原文,保留输入大小写)」;中文变体 → 「变体 (规范英文)」;无映射原样返回 */
export const displayName = (name: string): string => {
  const n = name.trim();
  if (!n) return name;
  const preset = PRESET_DEFS.find((p) => p.name === n);
  if (preset) return `${n} (${preset.en})`;
  const en = EXERCISE_EN[n];
  if (en) return `${n} (${en})`;
  const zhNorm = EXERCISE_ZH_ALIASES[n];
  if (zhNorm) {
    const normEn = EXERCISE_EN[zhNorm] ?? PRESET_DEFS.find((p) => p.name === zhNorm)?.en;
    if (normEn) return `${n} (${normEn})`;
  }
  const zh = EXERCISE_ALIASES[n.toLowerCase()];
  return zh ? `${zh} (${n})` : name;
};

/** 输入名 → 存储规范名:命中别名/英文预设 → 中文规范名;已是中文规范名保持;无映射原样(trim 后) */
export const normalizeExerciseName = (raw: string): string => {
  const n = raw.trim();
  if (!n) return n;
  if (PRESET_DEFS.some((p) => p.name === n)) return n;
  return EXERCISE_ALIASES[n.toLowerCase()] ?? n;
};

/** 搜索匹配:name 自身或该动作任一英文别名(小写不敏感)包含 q;q 为空视为全部匹配 */
export const exerciseSearchMatch = (name: string, q: string): boolean => {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  if (name.toLowerCase().includes(query)) return true;
  return aliasesFor(name).some((a) => a.toLowerCase().includes(query));
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
