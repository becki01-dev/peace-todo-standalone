// 力量动作参考页的肌肉分类:一级部位(含臀)+ 二级肌肉
// 说明:这是参考页/动作库自己的分类,不等于统计页的 BodyPart enum;
// 臀/小腿/颈等旧 enum 没有或粒度不同的分类,先在这里独立建模,不改 DB。

import type { BodyPart } from "./exerciseLib";

export type MuscleGroupId =
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "core"
  | "glutes"
  | "legs"
  | "calves"
  | "neck"
  | "full_body";

export const MUSCLE_GROUPS: MuscleGroupId[] = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "core",
  "glutes",
  "legs",
  "calves",
  "neck",
  "full_body",
];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroupId, string> = {
  chest: "胸",
  back: "背",
  shoulders: "肩",
  arms: "手臂",
  core: "核心",
  glutes: "臀",
  legs: "腿",
  calves: "小腿",
  neck: "头颈",
  full_body: "全身",
};

export type MuscleId =
  | "chest_upper"
  | "chest_mid"
  | "chest_lower"
  | "lats"
  | "traps_upper"
  | "traps_mid_lower"
  | "rhomboids"
  | "erectors"
  | "delts_front"
  | "delts_side"
  | "delts_rear"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs_upper"
  | "abs_lower"
  | "obliques"
  | "tv_abs"
  | "glute_max"
  | "glute_med_min"
  | "quads"
  | "hamstrings"
  | "adductors"
  | "calves_gastroc"
  | "calves_soleus"
  | "neck"
  | "full_body";

export interface MuscleMeta {
  id: MuscleId;
  /** 完整名,用于动作详情/筛选结果 */
  label: string;
  /** 短标签,用于筛选 chip */
  shortLabel: string;
  group: MuscleGroupId;
  /** 兼容现有统计的粗分类;参考页不依赖它 */
  bodyPart: BodyPart;
  /** 可选肌肉:不强制至少 2 个主要动作的覆盖测试 */
  optional?: boolean;
}

export const MUSCLES: Record<MuscleId, MuscleMeta> = {
  chest_upper: { id: "chest_upper", label: "胸大肌上束", shortLabel: "上胸", group: "chest", bodyPart: "chest" },
  chest_mid: { id: "chest_mid", label: "胸大肌中束", shortLabel: "中胸", group: "chest", bodyPart: "chest" },
  chest_lower: { id: "chest_lower", label: "胸大肌下束", shortLabel: "下胸", group: "chest", bodyPart: "chest" },
  lats: { id: "lats", label: "背阔肌", shortLabel: "背阔肌", group: "back", bodyPart: "back" },
  traps_upper: { id: "traps_upper", label: "斜方肌上束", shortLabel: "上斜方", group: "back", bodyPart: "back" },
  traps_mid_lower: { id: "traps_mid_lower", label: "斜方肌中下束", shortLabel: "中下斜方", group: "back", bodyPart: "back" },
  rhomboids: { id: "rhomboids", label: "菱形肌", shortLabel: "菱形肌", group: "back", bodyPart: "back" },
  erectors: { id: "erectors", label: "竖脊肌", shortLabel: "竖脊肌", group: "back", bodyPart: "back" },
  delts_front: { id: "delts_front", label: "三角肌前束", shortLabel: "前束", group: "shoulders", bodyPart: "shoulders" },
  delts_side: { id: "delts_side", label: "三角肌中束", shortLabel: "中束", group: "shoulders", bodyPart: "shoulders" },
  delts_rear: { id: "delts_rear", label: "三角肌后束", shortLabel: "后束", group: "shoulders", bodyPart: "shoulders" },
  biceps: { id: "biceps", label: "肱二头肌", shortLabel: "肱二头肌", group: "arms", bodyPart: "arms" },
  triceps: { id: "triceps", label: "肱三头肌", shortLabel: "肱三头肌", group: "arms", bodyPart: "arms" },
  forearms: { id: "forearms", label: "前臂", shortLabel: "前臂", group: "arms", bodyPart: "arms" },
  abs_upper: { id: "abs_upper", label: "腹直肌上部", shortLabel: "上腹", group: "core", bodyPart: "core" },
  abs_lower: { id: "abs_lower", label: "腹直肌下部", shortLabel: "下腹", group: "core", bodyPart: "core" },
  obliques: { id: "obliques", label: "腹斜肌", shortLabel: "腹斜肌", group: "core", bodyPart: "core" },
  tv_abs: { id: "tv_abs", label: "腹横肌", shortLabel: "腹横肌", group: "core", bodyPart: "core" },
  glute_max: { id: "glute_max", label: "臀大肌", shortLabel: "臀大肌", group: "glutes", bodyPart: "legs" },
  glute_med_min: { id: "glute_med_min", label: "臀中/小肌", shortLabel: "臀中肌", group: "glutes", bodyPart: "legs" },
  quads: { id: "quads", label: "股四头肌", shortLabel: "股四头肌", group: "legs", bodyPart: "legs" },
  hamstrings: { id: "hamstrings", label: "腘绳肌", shortLabel: "腘绳肌", group: "legs", bodyPart: "legs" },
  adductors: { id: "adductors", label: "内收肌", shortLabel: "内收肌", group: "legs", bodyPart: "legs" },
  calves_gastroc: { id: "calves_gastroc", label: "腓肠肌", shortLabel: "腓肠肌", group: "calves", bodyPart: "legs" },
  calves_soleus: { id: "calves_soleus", label: "比目鱼肌", shortLabel: "比目鱼肌", group: "calves", bodyPart: "legs" },
  neck: { id: "neck", label: "颈部", shortLabel: "颈部", group: "neck", bodyPart: "neck", optional: true },
  full_body: { id: "full_body", label: "后链/全身", shortLabel: "全身", group: "full_body", bodyPart: "full_body", optional: true },
};

export const MUSCLE_IDS = Object.keys(MUSCLES) as MuscleId[];

export const musclesByGroup = (group: MuscleGroupId): MuscleId[] =>
  MUSCLE_IDS.filter((id) => MUSCLES[id].group === group);

export const isMuscleId = (value: string): value is MuscleId => value in MUSCLES;
