// 动作示范图:中文动作名 -> 上游插画 slug
// 图片本体放在 public/exercises/<slug>/frame-{1..3}.svg,由 scripts/fetch-exercise-images.mjs 拉取。
// 来源:workout-guide(https://github.com/bryllim/workout-guide),原图 Everkinetic,CC BY-SA 4.0,
// 需署名并以相同方式共享;署名文案见 dialog 页脚与 public/exercises/ATTRIBUTION.md。
// 唯一键沿用 EXERCISE_CATALOG 的规范中文名;覆盖缺口见 exerciseMedia.test.ts。

/** 上游素材署名(CC BY-SA 4.0 要求的署名信息) */
export const EXERCISE_MEDIA_CREDIT = {
  creator: "Bryl Lim",
  creatorUrl: "https://bryllim.com",
  origin: "Everkinetic",
  originUrl: "https://github.com/everkinetic/data",
  sourceName: "workout-guide",
  sourceUrl: "https://github.com/bryllim/workout-guide",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
} as const;

export interface ExerciseMedia {
  /** public/exercises/<slug>/ 目录名,与上游 manifest 的 slug 一致 */
  slug: string;
  /** 上游动作名,用于重新拉取时精确定位 */
  source: string;
  /** 可用帧数(上游每个动作 3 帧) */
  frames: number;
  /** 与上游动作不完全一致时的说明(器械/姿势差异) */
  note?: string;
}

export const EXERCISE_MEDIA: Record<string, ExerciseMedia> = {
  // ---- 胸 ----
  上斜卧推: { slug: "incline-bench-press", source: "Incline Bench Press", frames: 3 },
  上斜哑铃飞鸟: {
    slug: "incline-cable-fly",
    source: "Incline Cable Fly",
    frames: 3,
    note: "上游只有绳索版;动作模式与上斜角度一致,器械为绳索。",
  },
  卧推: { slug: "bench-press", source: "Bench Press", frames: 3 },
  哑铃卧推: { slug: "dumbbell-bench-press", source: "Dumbbell Bench Press", frames: 3 },
  俯卧撑: { slug: "push-up", source: "Push-up", frames: 3 },
  双杠臂屈伸: { slug: "dip", source: "Dip", frames: 3 },
  下斜卧推: { slug: "decline-bench-press", source: "Decline Bench Press", frames: 3 },
  器械推胸: { slug: "machine-chest-press", source: "Machine Chest Press", frames: 3 },
  飞鸟: { slug: "dumbbell-fly", source: "Dumbbell Fly", frames: 3 },
  // ---- 背 ----
  引体向上: { slug: "pull-up", source: "Pull-up", frames: 3 },
  高位下拉: { slug: "lat-pulldown", source: "Lat Pulldown", frames: 3 },
  耸肩: { slug: "shrug", source: "Barbell Shrug", frames: 3 },
  农夫行走: { slug: "farmer-carry", source: "Farmer Carry", frames: 3 },
  坐姿划船: { slug: "seated-row", source: "Seated Cable Row", frames: 3 },
  面拉: { slug: "face-pull", source: "Face Pull", frames: 3 },
  划船: { slug: "barbell-row", source: "Barbell Row", frames: 3 },
  硬拉: { slug: "deadlift", source: "Deadlift", frames: 3 },
  早安式: { slug: "good-morning", source: "Good Morning", frames: 3 },
  背伸展: { slug: "back-extension", source: "Back Extension", frames: 3 },
  哑铃划船: { slug: "one-arm-dumbbell-row", source: "One-Arm Dumbbell Row", frames: 3 },
  // ---- 肩 ----
  肩推: { slug: "overhead-press", source: "Overhead Press", frames: 3 },
  前平举: { slug: "front-raise", source: "Front Raise", frames: 3 },
  侧平举: { slug: "lateral-raise", source: "Lateral Raise", frames: 3 },
  绳索侧平举: { slug: "cable-lateral-raise", source: "Cable Lateral Raise", frames: 3 },
  反向飞鸟: { slug: "rear-delt-fly", source: "Rear Delt Fly", frames: 3 },
  // ---- 手臂 ----
  二头弯举: { slug: "bicep-curl", source: "Bicep Curl", frames: 3 },
  锤式弯举: { slug: "hammer-curl", source: "Hammer Curl", frames: 3 },
  绳索下压: { slug: "tricep-pushdown", source: "Tricep Pushdown", frames: 3 },
  窄距卧推: { slug: "close-grip-bench-press", source: "Close-Grip Bench Press", frames: 3 },
  腕弯举: { slug: "wrist-curl", source: "Wrist Curl", frames: 3 },
  反向弯举: { slug: "reverse-curl", source: "Reverse Curl", frames: 3 },
  臂屈伸: {
    slug: "dumbbell-overhead-tricep-extension",
    source: "Dumbbell Overhead Tricep Extension",
    frames: 3,
    note: "上游为哑铃过顶臂屈伸;绳索/仰卧版本动作模式相同。",
  },
  // ---- 核心 ----
  卷腹: { slug: "crunch", source: "Crunch", frames: 3 },
  绳索卷腹: { slug: "cable-crunch", source: "Cable Crunch", frames: 3 },
  举腿: { slug: "lying-leg-raise", source: "Lying Leg Raise", frames: 3 },
  悬垂举腿: { slug: "hanging-leg-raise", source: "Hanging Leg Raise", frames: 3 },
  俄罗斯转体: { slug: "russian-twist", source: "Russian Twist", frames: 3 },
  侧平板: { slug: "side-plank", source: "Side Plank", frames: 3 },
  平板支撑: { slug: "plank", source: "Plank", frames: 3 },
  死虫: { slug: "dead-bug", source: "Dead Bug", frames: 3 },
  前臂支撑举腿: {
    slug: "captains-chair-knee-raise",
    source: "Captain's Chair Knee Raise",
    frames: 3,
    note: "上游是屈膝版;直腿举腿的发力与幅度一致。",
  },
  // ---- 臀 ----
  臀桥: { slug: "glute-bridge", source: "Glute Bridge", frames: 3 },
  臀推: { slug: "hip-thrust", source: "Hip Thrust", frames: 3 },
  罗马尼亚硬拉: { slug: "romanian-deadlift", source: "Romanian Deadlift", frames: 3 },
  相扑硬拉: { slug: "sumo-deadlift", source: "Sumo Deadlift", frames: 3 },
  深蹲: { slug: "squat", source: "Squat", frames: 3 },
  前蹲: { slug: "front-squat", source: "Front Squat", frames: 3 },
  高脚杯深蹲: { slug: "goblet-squat", source: "Goblet Squat", frames: 3 },
  保加利亚分腿蹲: { slug: "bulgarian-split-squat", source: "Bulgarian Split Squat", frames: 3 },
  髋外展: { slug: "hip-abduction-machine", source: "Hip Abduction Machine", frames: 3 },
  蚌式: { slug: "clamshell", source: "Clamshell", frames: 3 },
  // ---- 腿 ----
  腿举: { slug: "leg-press", source: "Leg Press", frames: 3 },
  腿屈伸: { slug: "leg-extension", source: "Leg Extension", frames: 3 },
  腿弯举: { slug: "leg-curl", source: "Leg Curl", frames: 3 },
  髋内收: { slug: "cable-standing-hip-adduction", source: "Cable Standing Hip Adduction", frames: 3 },
  相扑深蹲: { slug: "dumbbell-sumo-squat", source: "Dumbbell Sumo Squat", frames: 3 },
  哈克深蹲: { slug: "hack-squat", source: "Hack Squat", frames: 3 },
  弓步: {
    slug: "forward-lunge",
    source: "Forward Lunge",
    frames: 3,
    note: "上游是自重前弓步;负重或行进版本动作模式相同。",
  },
  上台阶: { slug: "step-up", source: "Step-Up", frames: 3 },
  哑铃上台阶: {
    slug: "step-up",
    source: "Step-Up",
    frames: 3,
    note: "与上台阶共用同一示范图,区别只在手持哑铃。",
  },
  哑铃弓步跳: {
    slug: "forward-lunge",
    source: "Forward Lunge",
    frames: 3,
    note: "上游无跳跃版本,借前弓步示意起止姿势。",
  },
  // ---- 小腿 ----
  站姿提踵: { slug: "standing-calf-raise", source: "Standing Calf Raise", frames: 3 },
  腿举提踵: { slug: "leg-press-calf-raise", source: "Leg Press Calf Raise", frames: 3 },
  坐姿提踵: { slug: "seated-calf-raise", source: "Seated Calf Raise", frames: 3 },
  屈膝提踵: {
    slug: "seated-calf-raise",
    source: "Seated Calf Raise",
    frames: 3,
    note: "上游没有自重版屈膝提踵,借用坐姿提踵(同为屈膝练比目鱼肌)。",
  },
  提踵: { slug: "calf-raise", source: "Calf Raise", frames: 3 },
  // ---- 全身 ----
  壶铃摆荡: { slug: "kettlebell-swing", source: "Kettlebell Swing", frames: 3 },
  波比跳: { slug: "burpee", source: "Burpee", frames: 3 },
  // 颈部屈伸:上游无对应插画,继续用占位图
};

/** 示范图目录(基于 Vite base,部署到子路径也不会失效) */
export const exerciseMediaDir = (): string => {
  const base = import.meta.env?.BASE_URL ?? "/";
  return `${base.endsWith("/") ? base : base + "/"}exercises/`;
};

export const exerciseFrameSrc = (slug: string, frame: number): string =>
  `${exerciseMediaDir()}${slug}/frame-${frame}.svg`;

/** 动作名 -> 示范图;无对应插画返回 undefined */
export const mediaForExercise = (name: string): ExerciseMedia | undefined => EXERCISE_MEDIA[name];

/** 已配示范图的动作数(用于页面提示/测试) */
export const mediaCoverageCount = (): number => Object.keys(EXERCISE_MEDIA).length;
