import { ExerciseDictEntry, dictFromRows } from "./exerciseLib";

/**
 * 全局动作字典测试 fixture:镜像 supabase/migrations/20260818120000_add_exercise_dictionary.sql
 * 种子的测试用子集(覆盖 exerciseLib / StrengthForm / FitPr / FitExerciseDict 测试断言所需条目,
 * 并包含全部 12 个预设动作的 en 别名以维持「预设 en 收录」不变式断言)。
 */
export const FIXTURE_DICT_ROWS: ExerciseDictEntry[] = [
  // —— 英文别名(键全小写)→ 中文规范名;预设 en 收录映射回自己 ——
  { id: "f-squat", kind: "alias", key: "squat", value: "深蹲" },
  { id: "f-back-squat", kind: "alias", key: "back squat", value: "深蹲" },
  { id: "f-goblet-squat", kind: "alias", key: "goblet squat", value: "深蹲" },
  { id: "f-deadlift", kind: "alias", key: "deadlift", value: "硬拉" },
  { id: "f-dead-lift", kind: "alias", key: "dead lift", value: "硬拉" },
  { id: "f-bench", kind: "alias", key: "bench", value: "卧推" },
  { id: "f-bench-press", kind: "alias", key: "bench press", value: "卧推" },
  { id: "f-pull-up", kind: "alias", key: "pull-up", value: "引体向上" },
  { id: "f-chin-ups", kind: "alias", key: "chin ups", value: "引体向上" },
  { id: "f-push-up", kind: "alias", key: "push-up", value: "俯卧撑" },
  { id: "f-ohp", kind: "alias", key: "overhead press", value: "肩推" },
  { id: "f-row", kind: "alias", key: "barbell row", value: "划船" },
  { id: "f-lunge", kind: "alias", key: "lunge", value: "弓步" },
  { id: "f-bicep-curl", kind: "alias", key: "bicep curl", value: "二头弯举" },
  { id: "f-arm-curl", kind: "alias", key: "arm curl", value: "二头弯举" },
  { id: "f-crunch", kind: "alias", key: "crunch", value: "卷腹" },
  { id: "f-abdominal", kind: "alias", key: "abdominal", value: "卷腹" },
  { id: "f-abdominal-crunch", kind: "alias", key: "abdominal crunch", value: "卷腹" },
  { id: "f-plank", kind: "alias", key: "plank", value: "平板支撑" },
  { id: "f-glute-bridge", kind: "alias", key: "glute bridge", value: "臀桥" },
  // —— 预设之外的动作别名 ——
  { id: "f-leg-curl", kind: "alias", key: "leg curl", value: "腿弯举" },
  { id: "f-chest-press", kind: "alias", key: "chest press", value: "器械推胸" },
  { id: "f-chess-press", kind: "alias", key: "chess press", value: "器械推胸" },
  { id: "f-hack-squat", kind: "alias", key: "hack squat", value: "哈克深蹲" },
  { id: "f-seated-calf", kind: "alias", key: "seated calf", value: "提踵" },
  { id: "f-rear-delt", kind: "alias", key: "rear delt", value: "反向飞鸟" },
  { id: "f-fly-delt", kind: "alias", key: "fly delt", value: "反向飞鸟" },
  { id: "f-hip-abduction", kind: "alias", key: "hip abduction", value: "髋外展" },
  { id: "f-hip-adduction", kind: "alias", key: "hip adduction", value: "髋内收" },
  { id: "f-russian-crunch", kind: "alias", key: "russian crunch", value: "俄罗斯转体" },
  { id: "f-back-bend", kind: "alias", key: "back bend", value: "背伸展" },
  { id: "f-back-extension", kind: "alias", key: "back extension", value: "背伸展" },
  { id: "f-back-and-side-lift", kind: "alias", key: "back and side lift", value: "背伸展" },
  { id: "f-arm-extension", kind: "alias", key: "arm extension", value: "臂屈伸" },
  { id: "f-triceps-press", kind: "alias", key: "triceps press", value: "臂屈伸" },
  // —— 非预设动作的中文规范名 → 显示英文 ——
  { id: "f-en-leg-curl", kind: "en", key: "腿弯举", value: "Leg Curl" },
  { id: "f-en-calf-raise", kind: "en", key: "提踵", value: "Calf Raise" },
  { id: "f-en-reverse-fly", kind: "en", key: "反向飞鸟", value: "Reverse Fly" },
  { id: "f-en-back-extension", kind: "en", key: "背伸展", value: "Back Extension" },
  { id: "f-en-tricep-extension", kind: "en", key: "臂屈伸", value: "Tricep Extension" },
  { id: "f-en-lat-pulldown", kind: "en", key: "高位下拉", value: "Lat Pulldown" },
  { id: "f-en-chest-press", kind: "en", key: "器械推胸", value: "Chest Press" },
  { id: "f-en-hack-squat", kind: "en", key: "哈克深蹲", value: "Hack Squat" },
  { id: "f-en-dip", kind: "en", key: "双杠臂屈伸", value: "Triceps Dip" },
  { id: "f-en-forearm", kind: "en", key: "前臂支撑举腿", value: "Forearm-supported Leg Raise" },
  { id: "f-en-russian-twist", kind: "en", key: "俄罗斯转体", value: "Russian Twist" },
  { id: "f-en-hip-abduction", kind: "en", key: "髋外展", value: "Hip Abduction" },
  { id: "f-en-hip-adduction", kind: "en", key: "髋内收", value: "Hip Adduction" },
  { id: "f-en-general", kind: "en", key: "综合力量训练", value: "General Strength Training" },
  { id: "f-en-yoga", kind: "en", key: "瑜伽", value: "Yoga" },
  // —— 中文变体 → 中文规范名(仅显示层兜底,数据不动) ——
  { id: "f-zh-russian", kind: "zh_alias", key: "俄罗斯卷腹", value: "俄罗斯转体" },
  { id: "f-zh-juti", kind: "zh_alias", key: "卷腹提腿", value: "前臂支撑举腿" },
  { id: "f-zh-dip", kind: "zh_alias", key: "曲臂下弯", value: "双杠臂屈伸" },
  { id: "f-zh-titui", kind: "zh_alias", key: "提腿卷腹", value: "前臂支撑举腿" },
  { id: "f-zh-wanbi", kind: "zh_alias", key: "弯臂曲伸", value: "双杠臂屈伸" },
  { id: "f-zh-jiandun", kind: "zh_alias", key: "箭步蹲", value: "弓步" },
];

/** fixture 组装好的运行时视图(纯函数测试直接用) */
export const FIXTURE_DICT = dictFromRows(FIXTURE_DICT_ROWS);
