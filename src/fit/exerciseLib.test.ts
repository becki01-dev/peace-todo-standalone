import { describe, expect, it } from "vitest";
import {
  PRESET_DEFS,
  BODY_PART_LABELS,
  EXERCISE_ALIASES,
  EXERCISE_EN,
  EXERCISE_ZH_ALIASES,
  aliasesFor,
  displayName,
  exerciseDefaults,
  exerciseSearchMatch,
  frequentExerciseNames,
  normalizeExerciseName,
  resolveBodyPart,
  type UserExercise,
} from "./exerciseLib";
import type { Workout } from "./types";

const dict: UserExercise[] = [
  { name: "引体向上", body_part: "back", bodyweight_default: true, default_reps: 10 },
  { name: "自定义划船", body_part: "shoulders", bodyweight_default: false, default_reps: null },
];

const workout = (overrides: Partial<Workout> & Pick<Workout, "type" | "data">): Workout => ({
  id: "w1",
  user_id: "u1",
  type: "running",
  date: "2026-08-09T04:00:00Z",
  notes: null,
  data: { distance_meters: 0, duration_seconds: 0, mood: 3 },
  created_at: "2026-08-09T04:00:00Z",
  updated_at: "2026-08-09T04:00:00Z",
  ...overrides,
});

describe("resolveBodyPart", () => {
  it("用户字典优先于预设", () => {
    // 字典里把引体向上改成肩部 → 以字典为准
    const overridden: UserExercise[] = [{ ...dict[0], body_part: "shoulders" }];
    expect(resolveBodyPart("引体向上", overridden)).toBe("shoulders");
    expect(resolveBodyPart("引体向上", dict)).toBe("back");
  });

  it("预设兜底(老数据未登记)", () => {
    expect(resolveBodyPart("深蹲", [])).toBe("legs");
    expect(resolveBodyPart("卧推", [])).toBe("chest");
  });

  it("未知动作 → 全身", () => {
    expect(resolveBodyPart("深蹲加哑铃", [])).toBe("full_body");
  });
});

describe("exerciseDefaults", () => {
  it("预设动作返回 BW 与默认次数", () => {
    expect(exerciseDefaults("引体向上", [])).toEqual({ bodyweight: true, default_reps: 10 });
    expect(exerciseDefaults("卧推", [])).toEqual({ bodyweight: false, default_reps: 10 });
  });

  it("字典覆盖预设(如用户改默认次数)", () => {
    const overridden: UserExercise[] = [{ ...dict[0], default_reps: 15 }];
    expect(exerciseDefaults("引体向上", overridden)).toEqual({ bodyweight: true, default_reps: 15 });
  });

  it("未知动作无默认(BW 关、次数 null)", () => {
    expect(exerciseDefaults("自定义深蹲", [])).toEqual({ bodyweight: false, default_reps: null });
  });
});

describe("frequentExerciseNames", () => {
  it("按出现次数排序取 Top N,单动作 legacy 也计入", () => {
    const w = (type: "session" | "legacy", name: string) =>
      type === "session"
        ? workout({
            type: "strength",
            data: { session: true, exercise: "", weight_kg: 0, sets: 1, reps: 10, exercises: [{ name, done: false, sets: [] }] },
          })
        : workout({ type: "strength", data: { exercise: name, weight_kg: 60, sets: 3, reps: 10 } });

    const items = [
      w("session", "深蹲"),
      w("session", "深蹲"),
      w("session", "引体向上"),
      w("legacy", "引体向上"),
      w("session", "卧推"),
    ];
    expect(frequentExerciseNames(items, 2)).toEqual(["深蹲", "引体向上"]);
    expect(frequentExerciseNames(items, 10)).toHaveLength(3);
  });

  it("非力量类型忽略,空列表返回空", () => {
    expect(frequentExerciseNames([workout({ type: "running", data: { distance_meters: 1, duration_seconds: 1, mood: 3 } })], 5)).toEqual([]);
    expect(frequentExerciseNames([], 5)).toEqual([]);
  });

  it("次数相同按名称中文排序", () => {
    const items = [
      workout({ type: "strength", data: { session: true, exercise: "", weight_kg: 0, sets: 1, reps: 10, exercises: [{ name: "卧推", done: false, sets: [] }] } }),
      workout({ type: "strength", data: { session: true, exercise: "", weight_kg: 0, sets: 1, reps: 10, exercises: [{ name: "深蹲", done: false, sets: [] }] } }),
    ];
    expect(frequentExerciseNames(items, 5)).toEqual(["深蹲", "卧推"]); // 深蹲 < 卧推(拼音)
  });
});

describe("PRESET_DEFS 种子完整性", () => {
  it("12 个预设动作都有有效部位、中文标签与英文名", () => {
    expect(PRESET_DEFS).toHaveLength(12);
    PRESET_DEFS.forEach((p) => {
      expect(BODY_PART_LABELS[p.body_part]).toBeTruthy();
      expect(p.default_reps).toBeGreaterThan(0);
      expect(p.en).toBeTruthy();
    });
  });
});

describe("EXERCISE_ALIASES 完整性", () => {
  it("别名键全小写、值为中文规范名;预设 en 收录且映射回自己", () => {
    const zhValues = new Set(Object.values(EXERCISE_ALIASES));
    Object.entries(EXERCISE_ALIASES).forEach(([en, zh]) => {
      expect(en).toBe(en.toLowerCase());
      expect(zh).toMatch(/[一-鿿]/); // 规范名必须含中文
    });
    PRESET_DEFS.forEach((p) => {
      expect(EXERCISE_ALIASES[p.en.toLowerCase()]).toBe(p.name);
    });
    // 所有规范名(预设 + 非预设)都有显示英文名;EXERCISE_EN 不与预设重复
    const presetNames = new Set(PRESET_DEFS.map((p) => p.name));
    zhValues.forEach((zh) => {
      if (!presetNames.has(zh)) expect(EXERCISE_EN[zh]).toBeTruthy();
    });
    Object.keys(EXERCISE_EN).forEach((zh) => {
      expect(presetNames.has(zh)).toBe(false);
    });
  });
});

describe("EXERCISE_ZH_ALIASES 完整性", () => {
  it("中文变体的规范名都能查到英文(预设或 EXERCISE_EN)", () => {
    Object.values(EXERCISE_ZH_ALIASES).forEach((zh) => {
      const preset = PRESET_DEFS.find((p) => p.name === zh);
      expect(preset?.en ?? EXERCISE_EN[zh]).toBeTruthy();
    });
  });
});

describe("displayName", () => {
  it("中文规范名 → 中文 (英文)", () => {
    expect(displayName("深蹲")).toBe("深蹲 (Squat)");
    expect(displayName("二头弯举")).toBe("二头弯举 (Bicep Curl)");
  });

  it("英文名/别名 → 中文 (原文,保留大小写)", () => {
    expect(displayName("Squat")).toBe("深蹲 (Squat)");
    expect(displayName("back squat")).toBe("深蹲 (back squat)");
    expect(displayName("BENCH")).toBe("卧推 (BENCH)");
    expect(displayName("leg curl")).toBe("腿弯举 (leg curl)");
    expect(displayName("Chest Press")).toBe("器械推胸 (Chest Press)");
  });

  it("非预设规范名 → 中文 (EXERCISE_EN 英文名)", () => {
    expect(displayName("腿弯举")).toBe("腿弯举 (Leg Curl)");
    expect(displayName("高位下拉")).toBe("高位下拉 (Lat Pulldown)");
    expect(displayName("器械推胸")).toBe("器械推胸 (Chest Press)");
    expect(displayName("哈克深蹲")).toBe("哈克深蹲 (Hack Squat)");
    expect(displayName("双杠臂屈伸")).toBe("双杠臂屈伸 (Triceps Dip)");
  });

  it("中文变体 → 变体 (规范英文名)", () => {
    expect(displayName("俄罗斯卷腹")).toBe("俄罗斯卷腹 (Russian Twist)");
    expect(displayName("russian crunch")).toBe("俄罗斯转体 (russian crunch)");
    expect(displayName("卷腹提腿")).toBe("卷腹提腿 (Leg Raise)");
    expect(displayName("曲臂下弯")).toBe("曲臂下弯 (Triceps Dip)");
    expect(displayName("back bend")).toBe("背伸展 (back bend)");
  });

  it("无映射 → 原样返回(含空串)", () => {
    expect(displayName("深蹲拉雪橇")).toBe("深蹲拉雪橇");
    expect(displayName("")).toBe("");
  });
});

describe("normalizeExerciseName", () => {
  it("英文别名(任意大小写/空白)→ 中文规范名", () => {
    expect(normalizeExerciseName("squat")).toBe("深蹲");
    expect(normalizeExerciseName("Back Squat")).toBe("深蹲");
    expect(normalizeExerciseName("SQUAT")).toBe("深蹲");
    expect(normalizeExerciseName("chin ups")).toBe("引体向上");
    expect(normalizeExerciseName("chest press")).toBe("器械推胸");
    expect(normalizeExerciseName("Hack Squat")).toBe("哈克深蹲");
    expect(normalizeExerciseName("rear delt")).toBe("反向飞鸟");
    expect(normalizeExerciseName("Seated Calf")).toBe("提踵");
    expect(normalizeExerciseName(" 卧推 ")).toBe("卧推");
  });

  it("已中文规范名保持;无映射原样", () => {
    expect(normalizeExerciseName("深蹲")).toBe("深蹲");
    expect(normalizeExerciseName("腿弯举")).toBe("腿弯举");
    expect(normalizeExerciseName("squat machine")).toBe("squat machine");
    expect(normalizeExerciseName("")).toBe("");
  });
});

describe("exerciseSearchMatch", () => {
  it("中文名或任一英文别名包含 q 即命中(大小写不敏感)", () => {
    expect(exerciseSearchMatch("深蹲", "squat")).toBe(true);
    expect(exerciseSearchMatch("深蹲", "SQUAT")).toBe(true);
    expect(exerciseSearchMatch("深蹲", "back squat")).toBe(true);
    expect(exerciseSearchMatch("二头弯举", "bicep")).toBe(true);
    expect(exerciseSearchMatch("二头弯举", "弯举")).toBe(true);
    expect(exerciseSearchMatch("腿弯举", "leg curl")).toBe(true);
    expect(exerciseSearchMatch("腿弯举", "腿弯举")).toBe(true);
  });

  it("不命中与空查询", () => {
    expect(exerciseSearchMatch("深蹲", "sqat")).toBe(false);
    expect(exerciseSearchMatch("深蹲拉雪橇", "squat")).toBe(false);
    expect(exerciseSearchMatch("深蹲", "")).toBe(true);
  });
});

describe("aliasesFor", () => {
  it("预设动作返回 en + 全部别名;非预设返回别名反查结果", () => {
    expect(aliasesFor("深蹲")).toContain("Squat");
    expect(aliasesFor("深蹲")).toContain("goblet squat");
    expect(aliasesFor("Squat")).toHaveLength(0); // 非规范名不反查
  });
});
