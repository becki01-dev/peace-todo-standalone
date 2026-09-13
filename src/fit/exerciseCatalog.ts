// 力量动作参考数据(代码常量):动作 -> 主要/次要肌肉 + 器械/模式/要点
// 唯一键 name 必须与 exercise_dictionary 的规范中文名一致(新增动作待后续迁移补齐别名);
// 页面只读,按肌肉分组检索。数据完整性/覆盖测试见 exerciseCatalog.test.ts。

import { exerciseSearchMatch, type ExerciseDict } from "./exerciseLib";
import {
  MUSCLES,
  MUSCLE_GROUP_LABELS,
  type MuscleGroupId,
  type MuscleId,
} from "./muscles";

export type EquipmentId =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "band"
  | "kettlebell";

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  barbell: "杠铃",
  dumbbell: "哑铃",
  machine: "器械",
  cable: "绳索",
  bodyweight: "自重",
  band: "弹力带",
  kettlebell: "壶铃",
};

export type MovementPatternId =
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "core"
  | "isolation"
  | "carry"
  | "full_body";

export const MOVEMENT_PATTERN_LABELS: Record<MovementPatternId, string> = {
  horizontal_push: "水平推",
  vertical_push: "垂直推",
  horizontal_pull: "水平拉",
  vertical_pull: "垂直拉",
  squat: "深蹲",
  hinge: "髋铰链",
  lunge: "单腿",
  core: "核心",
  isolation: "孤立",
  carry: "提携",
  full_body: "全身",
};

export interface ExerciseCatalogEntry {
  /** 规范中文名,与 exercise_dictionary 对齐 */
  name: string;
  en: string;
  /** 主要肌肉 1-2 个(大复合最多 3 个);筛选按此命中 */
  primaryMuscles: MuscleId[];
  /** 次要/协同肌肉 0-4 个;详情展示,不参与默认筛选 */
  secondaryMuscles: MuscleId[];
  equipment: EquipmentId;
  pattern: MovementPatternId;
  /** 1-2 句动作要点,替代现场上网查动作 */
  tips: string;
  /** 补充搜索词(中文俗称/器械版本),不参与显示 */
  searchTerms?: string[];
}

export const EXERCISE_CATALOG: ExerciseCatalogEntry[] = [
  // ---- 胸 ----
  {
    name: "上斜卧推",
    en: "Incline Bench Press",
    primaryMuscles: ["chest_upper"],
    secondaryMuscles: ["delts_front", "triceps"],
    equipment: "barbell",
    pattern: "horizontal_push",
    tips: "上胸为主;肩胛后缩,杠铃触胸上沿,别让肩过度前伸。",
  },
  {
    name: "上斜哑铃飞鸟",
    en: "Incline Dumbbell Fly",
    primaryMuscles: ["chest_upper"],
    secondaryMuscles: ["delts_front"],
    equipment: "dumbbell",
    pattern: "isolation",
    tips: "上胸孤立;手臂微屈固定,像抱树一样打开,别用惯性甩。",
  },
  {
    name: "卧推",
    en: "Bench Press",
    primaryMuscles: ["chest_mid"],
    secondaryMuscles: ["delts_front", "triceps"],
    equipment: "barbell",
    pattern: "horizontal_push",
    tips: "中胸综合;肩胛后缩下沉,杠铃触胸中下部,手腕保持中立。",
    searchTerms: ["平板卧推", "平板杠铃卧推"],
  },
  {
    name: "哑铃卧推",
    en: "Dumbbell Bench Press",
    primaryMuscles: ["chest_mid"],
    secondaryMuscles: ["delts_front", "triceps"],
    equipment: "dumbbell",
    pattern: "horizontal_push",
    tips: "中胸;比杠铃活动范围大,下放到胸两侧,别让肩过度前伸。",
  },
  {
    name: "俯卧撑",
    en: "Push-up",
    primaryMuscles: ["chest_mid"],
    secondaryMuscles: ["triceps", "delts_front", "tv_abs"],
    equipment: "bodyweight",
    pattern: "horizontal_push",
    tips: "中胸+核心;身体一条线,胸口接近地面,肘部约 45 度。",
  },
  {
    name: "双杠臂屈伸",
    en: "Dips",
    primaryMuscles: ["chest_lower", "triceps"],
    secondaryMuscles: ["delts_front"],
    equipment: "bodyweight",
    pattern: "horizontal_push",
    tips: "下胸+三头;身体前倾偏胸,直立偏三头;肩不适时减小幅度。",
  },
  {
    name: "下斜卧推",
    en: "Decline Bench Press",
    primaryMuscles: ["chest_lower"],
    secondaryMuscles: ["delts_front", "triceps"],
    equipment: "barbell",
    pattern: "horizontal_push",
    tips: "下胸;下斜 15-30 度即可,杠铃触胸下沿,固定肩胛。",
  },
  // ---- 背 ----
  {
    name: "引体向上",
    en: "Pull-up",
    primaryMuscles: ["lats"],
    secondaryMuscles: ["biceps", "rhomboids", "traps_mid_lower"],
    equipment: "bodyweight",
    pattern: "vertical_pull",
    tips: "背阔肌;先沉肩再拉,胸口向杠靠近,避免耸肩。",
  },
  {
    name: "高位下拉",
    en: "Lat Pulldown",
    primaryMuscles: ["lats"],
    secondaryMuscles: ["biceps", "rhomboids"],
    equipment: "cable",
    pattern: "vertical_pull",
    tips: "背阔肌;拉杆到锁骨附近,肘向下向后,别用身体后仰借力。",
  },
  {
    name: "耸肩",
    en: "Shrug",
    primaryMuscles: ["traps_upper"],
    secondaryMuscles: ["forearms"],
    equipment: "dumbbell",
    pattern: "isolation",
    tips: "上斜方;肩膀垂直上提,顶端停一下,别绕圈。",
  },
  {
    name: "农夫行走",
    en: "Farmer's Carry",
    primaryMuscles: ["traps_upper", "forearms"],
    secondaryMuscles: ["tv_abs", "glute_max"],
    equipment: "dumbbell",
    pattern: "carry",
    tips: "上斜方+前臂+核心;站直快走,肩胛微沉,别让身体侧倾。",
  },
  {
    name: "坐姿划船",
    en: "Seated Row",
    primaryMuscles: ["traps_mid_lower", "rhomboids"],
    secondaryMuscles: ["lats", "biceps", "delts_rear"],
    equipment: "cable",
    pattern: "horizontal_pull",
    tips: "中下斜方+菱形肌;肩胛先向后收,再拉肘,不靠身体后仰。",
  },
  {
    name: "面拉",
    en: "Face Pull",
    primaryMuscles: ["traps_mid_lower", "delts_rear"],
    secondaryMuscles: ["rhomboids"],
    equipment: "cable",
    pattern: "horizontal_pull",
    tips: "后束+中下斜方;拉向面部,肘高于手,末端外旋。",
  },
  {
    name: "划船",
    en: "Barbell Row",
    primaryMuscles: ["lats", "rhomboids"],
    secondaryMuscles: ["traps_mid_lower", "delts_rear", "biceps", "erectors"],
    equipment: "barbell",
    pattern: "horizontal_pull",
    tips: "背阔+菱形;髋铰链俯身,杠铃拉向肚脐,背部保持中立。",
    searchTerms: ["杠铃划船"],
  },
  {
    name: "硬拉",
    en: "Deadlift",
    primaryMuscles: ["glute_max", "hamstrings", "erectors"],
    secondaryMuscles: ["lats", "traps_mid_lower", "forearms", "quads"],
    equipment: "barbell",
    pattern: "hinge",
    tips: "后链综合;杠铃贴腿,髋膝同步伸展,背部不弓。",
    searchTerms: ["传统硬拉", "杠铃硬拉"],
  },
  {
    name: "早安式",
    en: "Good Morning",
    primaryMuscles: ["hamstrings", "erectors"],
    secondaryMuscles: ["glute_max"],
    equipment: "barbell",
    pattern: "hinge",
    tips: "腘绳+竖脊;髋向后推,背部挺直,重量宁轻勿重。",
  },
  // ---- 肩 ----
  {
    name: "肩推",
    en: "Overhead Press",
    primaryMuscles: ["delts_front"],
    secondaryMuscles: ["delts_side", "triceps"],
    equipment: "barbell",
    pattern: "vertical_push",
    tips: "前束+三头;收紧核心,杠铃过头后微微后移,别过度挺腰。",
    searchTerms: ["站姿推举", "杠铃推举"],
  },
  {
    name: "前平举",
    en: "Front Raise",
    primaryMuscles: ["delts_front"],
    secondaryMuscles: ["traps_upper"],
    equipment: "dumbbell",
    pattern: "isolation",
    tips: "前束;抬到肩高即可,别耸肩、别甩。",
  },
  {
    name: "侧平举",
    en: "Lateral Raise",
    primaryMuscles: ["delts_side"],
    secondaryMuscles: ["traps_upper"],
    equipment: "dumbbell",
    pattern: "isolation",
    tips: "中束;小重量,肘微屈,抬到肩高,像倒水一样。",
  },
  {
    name: "绳索侧平举",
    en: "Cable Lateral Raise",
    primaryMuscles: ["delts_side"],
    secondaryMuscles: ["traps_upper"],
    equipment: "cable",
    pattern: "isolation",
    tips: "中束;绳索持续张力,身体可微倾,别用斜方肌代偿。",
  },
  {
    name: "反向飞鸟",
    en: "Reverse Fly",
    primaryMuscles: ["delts_rear", "rhomboids"],
    secondaryMuscles: ["traps_mid_lower"],
    equipment: "dumbbell",
    pattern: "isolation",
    tips: "后束+菱形;俯身,手臂微屈向两侧打开,别用腰甩。",
  },
  // ---- 手臂 ----
  {
    name: "二头弯举",
    en: "Bicep Curl",
    primaryMuscles: ["biceps"],
    secondaryMuscles: ["forearms"],
    equipment: "dumbbell",
    pattern: "isolation",
    tips: "肱二头;肘固定,收缩到顶,下放控制。",
    searchTerms: ["哑铃弯举"],
  },
  {
    name: "锤式弯举",
    en: "Hammer Curl",
    primaryMuscles: ["biceps", "forearms"],
    secondaryMuscles: [],
    equipment: "dumbbell",
    pattern: "isolation",
    tips: "肱二头+肱肌+前臂;对握,肘贴身体,别晃。",
  },
  {
    name: "绳索下压",
    en: "Tricep Pushdown",
    primaryMuscles: ["triceps"],
    secondaryMuscles: ["forearms"],
    equipment: "cable",
    pattern: "isolation",
    tips: "肱三头;肘固定,下压到伸直,顶端挤压。",
  },
  {
    name: "窄距卧推",
    en: "Close-grip Bench Press",
    primaryMuscles: ["triceps"],
    secondaryMuscles: ["chest_mid", "delts_front"],
    equipment: "barbell",
    pattern: "horizontal_push",
    tips: "三头为主;握距与肩同宽,肘贴近身体,杠铃触胸下部。",
  },
  {
    name: "腕弯举",
    en: "Wrist Curl",
    primaryMuscles: ["forearms"],
    secondaryMuscles: [],
    equipment: "dumbbell",
    pattern: "isolation",
    tips: "前臂屈肌;前臂贴大腿,手腕充分卷起和放下。",
  },
  {
    name: "反向弯举",
    en: "Reverse Curl",
    primaryMuscles: ["forearms", "biceps"],
    secondaryMuscles: [],
    equipment: "barbell",
    pattern: "isolation",
    tips: "前臂伸肌+肱肌;正握,手腕保持中立,别用肩甩。",
  },
  // ---- 核心 ----
  {
    name: "卷腹",
    en: "Crunch",
    primaryMuscles: ["abs_upper"],
    secondaryMuscles: ["obliques"],
    equipment: "bodyweight",
    pattern: "core",
    tips: "上腹;下巴微收,胸椎卷起,别用手拉脖子。",
  },
  {
    name: "绳索卷腹",
    en: "Cable Crunch",
    primaryMuscles: ["abs_upper"],
    secondaryMuscles: ["obliques"],
    equipment: "cable",
    pattern: "core",
    tips: "上腹负重;跪姿,用腹肌把肘拉向膝盖,髋角固定。",
  },
  {
    name: "举腿",
    en: "Leg Raise",
    primaryMuscles: ["abs_lower"],
    secondaryMuscles: ["obliques"],
    equipment: "bodyweight",
    pattern: "core",
    tips: "下腹;下背贴地,腿放下时不要塌腰。",
    searchTerms: ["仰卧举腿"],
  },
  {
    name: "悬垂举腿",
    en: "Hanging Leg Raise",
    primaryMuscles: ["abs_lower"],
    secondaryMuscles: ["forearms", "lats"],
    equipment: "bodyweight",
    pattern: "core",
    tips: "下腹;悬垂稳定,先屈髋再卷骨盆,别摆荡。",
  },
  {
    name: "俄罗斯转体",
    en: "Russian Twist",
    primaryMuscles: ["obliques"],
    secondaryMuscles: ["abs_upper"],
    equipment: "bodyweight",
    pattern: "core",
    tips: "腹斜肌;胸口带动旋转,别只甩手。",
  },
  {
    name: "侧平板",
    en: "Side Plank",
    primaryMuscles: ["obliques", "tv_abs"],
    secondaryMuscles: [],
    equipment: "bodyweight",
    pattern: "core",
    tips: "腹斜肌+腹横肌;身体一条线,髋部别下沉。",
  },
  {
    name: "平板支撑",
    en: "Plank",
    primaryMuscles: ["tv_abs"],
    secondaryMuscles: ["abs_upper", "obliques", "glute_max"],
    equipment: "bodyweight",
    pattern: "core",
    tips: "腹横肌+核心;肘在肩下,收腹夹臀,别塌腰。",
  },
  {
    name: "死虫",
    en: "Dead Bug",
    primaryMuscles: ["tv_abs"],
    secondaryMuscles: ["abs_upper"],
    equipment: "bodyweight",
    pattern: "core",
    tips: "腹横肌+核心稳定;下背贴地,对侧手脚缓慢伸出。",
  },
  // ---- 臀 ----
  {
    name: "臀桥",
    en: "Glute Bridge",
    primaryMuscles: ["glute_max"],
    secondaryMuscles: ["hamstrings"],
    equipment: "bodyweight",
    pattern: "hinge",
    tips: "臀大肌自重;脚跟发力顶髋,顶端夹臀,别用腰顶。",
  },
  {
    name: "臀推",
    en: "Hip Thrust",
    primaryMuscles: ["glute_max"],
    secondaryMuscles: ["hamstrings"],
    equipment: "barbell",
    pattern: "hinge",
    tips: "臀大肌负重;上背靠凳,收下巴,顶到躯干与大腿成直线。",
  },
  {
    name: "罗马尼亚硬拉",
    en: "Romanian Deadlift",
    primaryMuscles: ["hamstrings", "glute_max"],
    secondaryMuscles: ["erectors", "forearms"],
    equipment: "barbell",
    pattern: "hinge",
    tips: "腘绳+臀;髋向后推,膝盖微屈,杠铃贴腿下放到小腿中段。",
  },
  {
    name: "深蹲",
    en: "Squat",
    primaryMuscles: ["quads", "glute_max"],
    secondaryMuscles: ["hamstrings", "adductors", "erectors", "tv_abs"],
    equipment: "barbell",
    pattern: "squat",
    tips: "股四头+臀;脚掌踩稳,膝盖对准脚尖,下蹲到至少大腿平行。",
    searchTerms: ["杠铃深蹲", "背蹲"],
  },
  {
    name: "保加利亚分腿蹲",
    en: "Bulgarian Split Squat",
    primaryMuscles: ["quads", "glute_max"],
    secondaryMuscles: ["hamstrings", "adductors"],
    equipment: "dumbbell",
    pattern: "lunge",
    tips: "单腿股四头+臀;重心在前脚,后脚仅辅助,躯干可微前倾。",
  },
  {
    name: "髋外展",
    en: "Hip Abduction",
    primaryMuscles: ["glute_med_min"],
    secondaryMuscles: [],
    equipment: "machine",
    pattern: "isolation",
    tips: "臀中肌;身体稳定,腿向外打开,避免用腰借力。",
  },
  {
    name: "蚌式",
    en: "Clamshell",
    primaryMuscles: ["glute_med_min"],
    secondaryMuscles: [],
    equipment: "band",
    pattern: "isolation",
    tips: "臀中肌;侧卧屈膝,骨盆稳定,上侧膝盖像贝壳打开。",
  },
  // ---- 腿 ----
  {
    name: "腿举",
    en: "Leg Press",
    primaryMuscles: ["quads", "glute_max"],
    secondaryMuscles: ["hamstrings", "adductors"],
    equipment: "machine",
    pattern: "squat",
    tips: "股四头+臀;脚踩中上部,下放到膝盖约 90 度,别锁死膝关节。",
    searchTerms: ["倒蹬"],
  },
  {
    name: "腿屈伸",
    en: "Leg Extension",
    primaryMuscles: ["quads"],
    secondaryMuscles: [],
    equipment: "machine",
    pattern: "isolation",
    tips: "股四头孤立;顶端停一下,控制下放。",
    searchTerms: ["坐姿腿屈伸"],
  },
  {
    name: "腿弯举",
    en: "Leg Curl",
    primaryMuscles: ["hamstrings"],
    secondaryMuscles: [],
    equipment: "machine",
    pattern: "isolation",
    tips: "腘绳肌;收紧时别抬臀,控制离心。",
    searchTerms: ["俯卧腿弯举", "坐姿腿弯举"],
  },
  {
    name: "髋内收",
    en: "Hip Adduction",
    primaryMuscles: ["adductors"],
    secondaryMuscles: [],
    equipment: "machine",
    pattern: "isolation",
    tips: "内收肌;双腿向内夹紧,躯干保持稳定。",
  },
  {
    name: "相扑深蹲",
    en: "Sumo Squat",
    primaryMuscles: ["adductors", "glute_max", "quads"],
    secondaryMuscles: ["hamstrings"],
    equipment: "dumbbell",
    pattern: "squat",
    tips: "内收肌+臀+股四头;站距宽、脚尖外展,膝盖跟着脚尖方向。",
  },
  // ---- 小腿 ----
  {
    name: "站姿提踵",
    en: "Standing Calf Raise",
    primaryMuscles: ["calves_gastroc"],
    secondaryMuscles: ["calves_soleus"],
    equipment: "machine",
    pattern: "isolation",
    tips: "腓肠肌(直膝);脚跟充分下沉再顶到最高,顶端停一下。",
  },
  {
    name: "腿举提踵",
    en: "Leg Press Calf Raise",
    primaryMuscles: ["calves_gastroc"],
    secondaryMuscles: ["calves_soleus"],
    equipment: "machine",
    pattern: "isolation",
    tips: "腓肠肌;前脚掌踩在踏板边缘,膝微屈固定,别用踝弹。",
  },
  {
    name: "坐姿提踵",
    en: "Seated Calf Raise",
    primaryMuscles: ["calves_soleus"],
    secondaryMuscles: ["calves_gastroc"],
    equipment: "machine",
    pattern: "isolation",
    tips: "比目鱼肌(屈膝);坐姿膝盖负重,动作幅度做满。",
  },
  {
    name: "屈膝提踵",
    en: "Bent-knee Calf Raise",
    primaryMuscles: ["calves_soleus"],
    secondaryMuscles: ["calves_gastroc"],
    equipment: "bodyweight",
    pattern: "isolation",
    tips: "比目鱼肌;膝盖保持弯曲,单腿或负重做提踵。",
  },
  // ---- 全身/颈 ----
  {
    name: "壶铃摆荡",
    en: "Kettlebell Swing",
    primaryMuscles: ["glute_max", "hamstrings"],
    secondaryMuscles: ["erectors", "tv_abs", "forearms"],
    equipment: "kettlebell",
    pattern: "hinge",
    tips: "臀+腘绳爆发;髋铰链,壶铃摆到胸口高度,靠伸髋不是抬手臂。",
  },
  {
    name: "波比跳",
    en: "Burpee",
    primaryMuscles: ["full_body"],
    secondaryMuscles: ["quads", "chest_mid", "tv_abs"],
    equipment: "bodyweight",
    pattern: "full_body",
    tips: "全身性;动作连贯,落地缓冲,注意呼吸。",
  },
  {
    name: "颈部屈伸",
    en: "Neck Flexion/Extension",
    primaryMuscles: ["neck"],
    secondaryMuscles: ["traps_upper"],
    equipment: "bodyweight",
    pattern: "isolation",
    tips: "颈部;小幅度、慢速,千万别甩或负重过大。",
  },
];

/** 按一级部位筛选(命中任一 primary 肌肉所在组) */
export const entriesForGroup = (group: MuscleGroupId): ExerciseCatalogEntry[] =>
  EXERCISE_CATALOG.filter((entry) =>
    entry.primaryMuscles.some((muscle) => MUSCLES[muscle].group === group),
  );

/** 按二级肌肉筛选(只匹配 primary) */
export const entriesForMuscle = (muscle: MuscleId): ExerciseCatalogEntry[] =>
  EXERCISE_CATALOG.filter((entry) => entry.primaryMuscles.includes(muscle));

/** 页面搜索:动作名/英文/补充词/肌肉名/部位/器械/模式/字典别名 */
export const exerciseMatchesQuery = (
  entry: ExerciseCatalogEntry,
  rawQuery: string,
  dict?: ExerciseDict,
): boolean => {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  const primaryGroup = MUSCLES[entry.primaryMuscles[0]]?.group;
  const haystack = [
    entry.name,
    entry.en,
    ...(entry.searchTerms ?? []),
    ...entry.primaryMuscles.flatMap((muscle) => [MUSCLES[muscle].label, MUSCLES[muscle].shortLabel]),
    ...entry.secondaryMuscles.flatMap((muscle) => [MUSCLES[muscle].label, MUSCLES[muscle].shortLabel]),
    primaryGroup ? MUSCLE_GROUP_LABELS[primaryGroup] : "",
    EQUIPMENT_LABELS[entry.equipment],
    MOVEMENT_PATTERN_LABELS[entry.pattern],
  ];
  if (haystack.some((text) => text.toLowerCase().includes(query))) return true;
  return dict ? exerciseSearchMatch(entry.name, query, dict) : false;
};
