import { describe, expect, it } from "vitest";
import {
  PRESET_DEFS,
  BODY_PART_LABELS,
  EXERCISE_DICT_ADMIN_EMAIL,
  aliasesFor,
  dictFromRows,
  displayName,
  emptyDict,
  exerciseDefaults,
  exerciseSearchMatch,
  exerciseUsageByExercise,
  frequentExerciseNames,
  lastUsedByExercise,
  normalizeExerciseName,
  resolveBodyPart,
  type ExerciseDictEntry,
  type UserExercise,
} from "./exerciseLib";
import { FIXTURE_DICT, FIXTURE_DICT_ROWS } from "./testDict.fixture";
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

describe("dictFromRows / emptyDict", () => {
  it("空行 → 空视图", () => {
    expect(emptyDict()).toEqual({ aliases: {}, en: {}, zhAliases: {} });
    expect(dictFromRows([])).toEqual({ aliases: {}, en: {}, zhAliases: {} });
  });

  it("按 kind 路由,alias 键强制小写,未知 kind 忽略", () => {
    const rows: ExerciseDictEntry[] = [
      { id: "a", kind: "alias", key: "Squat", value: "深蹲" },
      { id: "b", kind: "en", key: "腿弯举", value: "Leg Curl" },
      { id: "c", kind: "zh_alias", key: "俄罗斯卷腹", value: "俄罗斯转体" },
      { id: "d", kind: "bogus" as ExerciseDictEntry["kind"], key: "x", value: "y" },
    ];
    const d = dictFromRows(rows);
    expect(d.aliases).toEqual({ squat: "深蹲" });
    expect(d.en).toEqual({ 腿弯举: "Leg Curl" });
    expect(d.zhAliases).toEqual({ 俄罗斯卷腹: "俄罗斯转体" });
  });

  it("别名键为小写时去重(后者覆盖)", () => {
    const rows: ExerciseDictEntry[] = [
      { id: "a", kind: "alias", key: "squat", value: "深蹲" },
      { id: "b", kind: "alias", key: "SQUAT", value: "蹲起" },
    ];
    expect(dictFromRows(rows).aliases.squat).toBe("蹲起");
  });
});

describe("FIXTURE_DICT_ROWS 完整性(镜像迁移种子不变式)", () => {
  it("别名键全小写、值为中文规范名;预设 en 收录且映射回自己", () => {
    const zhValues = new Set(Object.values(FIXTURE_DICT.aliases));
    Object.entries(FIXTURE_DICT.aliases).forEach(([en, zh]) => {
      expect(en).toBe(en.toLowerCase());
      expect(zh).toMatch(/[一-鿿]/); // 规范名必须含中文
    });
    PRESET_DEFS.forEach((p) => {
      expect(FIXTURE_DICT.aliases[p.en.toLowerCase()]).toBe(p.name);
    });
    // 所有规范名(预设 + 非预设)都有显示英文名;en 不与预设重复
    const presetNames = new Set(PRESET_DEFS.map((p) => p.name));
    zhValues.forEach((zh) => {
      if (!presetNames.has(zh)) expect(FIXTURE_DICT.en[zh]).toBeTruthy();
    });
    Object.keys(FIXTURE_DICT.en).forEach((zh) => {
      expect(presetNames.has(zh)).toBe(false);
    });
  });

  it("中文变体的规范名都能查到英文(预设或 en)", () => {
    Object.values(FIXTURE_DICT.zhAliases).forEach((zh) => {
      const preset = PRESET_DEFS.find((p) => p.name === zh);
      expect(preset?.en ?? FIXTURE_DICT.en[zh]).toBeTruthy();
    });
  });

  it("管理员邮箱与迁移 SQL 一致", () => {
    expect(EXERCISE_DICT_ADMIN_EMAIL).toBe("becki01@gmail.com");
  });
});

describe("displayName", () => {
  it("中文规范名 → 中文 (英文)", () => {
    expect(displayName("深蹲", FIXTURE_DICT)).toBe("深蹲 (Squat)");
    expect(displayName("二头弯举", FIXTURE_DICT)).toBe("二头弯举 (Bicep Curl)");
  });

  it("英文名/别名 → 中文 (原文,保留大小写)", () => {
    expect(displayName("Squat", FIXTURE_DICT)).toBe("深蹲 (Squat)");
    expect(displayName("back squat", FIXTURE_DICT)).toBe("深蹲 (back squat)");
    expect(displayName("BENCH", FIXTURE_DICT)).toBe("卧推 (BENCH)");
    expect(displayName("leg curl", FIXTURE_DICT)).toBe("腿弯举 (leg curl)");
    expect(displayName("Chest Press", FIXTURE_DICT)).toBe("器械推胸 (Chest Press)");
  });

  it("非预设规范名 → 中文 (en 英文名)", () => {
    expect(displayName("腿弯举", FIXTURE_DICT)).toBe("腿弯举 (Leg Curl)");
    expect(displayName("高位下拉", FIXTURE_DICT)).toBe("高位下拉 (Lat Pulldown)");
    expect(displayName("器械推胸", FIXTURE_DICT)).toBe("器械推胸 (Chest Press)");
    expect(displayName("哈克深蹲", FIXTURE_DICT)).toBe("哈克深蹲 (Hack Squat)");
    expect(displayName("双杠臂屈伸", FIXTURE_DICT)).toBe("双杠臂屈伸 (Triceps Dip)");
    expect(displayName("前臂支撑举腿", FIXTURE_DICT)).toBe("前臂支撑举腿 (Forearm-supported Leg Raise)");
  });

  it("中文变体 → 变体 (规范英文名)", () => {
    expect(displayName("俄罗斯卷腹", FIXTURE_DICT)).toBe("俄罗斯卷腹 (Russian Twist)");
    expect(displayName("russian crunch", FIXTURE_DICT)).toBe("俄罗斯转体 (russian crunch)");
    expect(displayName("卷腹提腿", FIXTURE_DICT)).toBe("卷腹提腿 (Forearm-supported Leg Raise)");
    expect(displayName("曲臂下弯", FIXTURE_DICT)).toBe("曲臂下弯 (Triceps Dip)");
    expect(displayName("back bend", FIXTURE_DICT)).toBe("背伸展 (back bend)");
    expect(displayName("提腿卷腹", FIXTURE_DICT)).toBe("提腿卷腹 (Forearm-supported Leg Raise)");
    expect(displayName("弯臂曲伸", FIXTURE_DICT)).toBe("弯臂曲伸 (Triceps Dip)");
    expect(displayName("箭步蹲", FIXTURE_DICT)).toBe("箭步蹲 (Lunge)");
  });

  it("审计收尾新增:髋部/拼写变体 → 中文 (原文,保留大小写)", () => {
    expect(displayName("Hip abduction", FIXTURE_DICT)).toBe("髋外展 (Hip abduction)");
    expect(displayName("Hip adduction", FIXTURE_DICT)).toBe("髋内收 (Hip adduction)");
    expect(displayName("髋外展", FIXTURE_DICT)).toBe("髋外展 (Hip Abduction)");
    expect(displayName("髋内收", FIXTURE_DICT)).toBe("髋内收 (Hip Adduction)");
    expect(displayName("Chess press", FIXTURE_DICT)).toBe("器械推胸 (Chess press)");
    expect(displayName("Dead lift", FIXTURE_DICT)).toBe("硬拉 (Dead lift)");
    expect(displayName("Fly Delt", FIXTURE_DICT)).toBe("反向飞鸟 (Fly Delt)");
    expect(displayName("Arm Curl", FIXTURE_DICT)).toBe("二头弯举 (Arm Curl)");
    expect(displayName("Abdominal crunch", FIXTURE_DICT)).toBe("卷腹 (Abdominal crunch)");
    expect(displayName("Back extension", FIXTURE_DICT)).toBe("背伸展 (Back extension)");
    expect(displayName("Arm extension", FIXTURE_DICT)).toBe("臂屈伸 (Arm extension)");
    expect(displayName("Triceps press", FIXTURE_DICT)).toBe("臂屈伸 (Triceps press)");
    expect(displayName("back and side lift", FIXTURE_DICT)).toBe("背伸展 (back and side lift)");
    expect(displayName("综合力量训练", FIXTURE_DICT)).toBe("综合力量训练 (General Strength Training)");
    expect(displayName("瑜伽", FIXTURE_DICT)).toBe("瑜伽 (Yoga)");
  });

  it("无映射 → 原样返回(含空串)", () => {
    expect(displayName("深蹲拉雪橇", FIXTURE_DICT)).toBe("深蹲拉雪橇");
    expect(displayName("", FIXTURE_DICT)).toBe("");
  });
});

describe("normalizeExerciseName", () => {
  it("英文别名(任意大小写/空白)→ 中文规范名", () => {
    expect(normalizeExerciseName("squat", FIXTURE_DICT)).toBe("深蹲");
    expect(normalizeExerciseName("Back Squat", FIXTURE_DICT)).toBe("深蹲");
    expect(normalizeExerciseName("SQUAT", FIXTURE_DICT)).toBe("深蹲");
    expect(normalizeExerciseName("chin ups", FIXTURE_DICT)).toBe("引体向上");
    expect(normalizeExerciseName("chest press", FIXTURE_DICT)).toBe("器械推胸");
    expect(normalizeExerciseName("Hack Squat", FIXTURE_DICT)).toBe("哈克深蹲");
    expect(normalizeExerciseName("rear delt", FIXTURE_DICT)).toBe("反向飞鸟");
    expect(normalizeExerciseName("Seated Calf", FIXTURE_DICT)).toBe("坐姿提踵");
    expect(normalizeExerciseName("Hip Abduction", FIXTURE_DICT)).toBe("髋外展");
    expect(normalizeExerciseName("Hip Thrust", FIXTURE_DICT)).toBe("臀推");
    expect(normalizeExerciseName("Romanian Deadlift", FIXTURE_DICT)).toBe("罗马尼亚硬拉");
    expect(normalizeExerciseName("dead lift", FIXTURE_DICT)).toBe("硬拉");
    expect(normalizeExerciseName("Abdominal Crunch", FIXTURE_DICT)).toBe("卷腹");
    expect(normalizeExerciseName(" 卧推 ", FIXTURE_DICT)).toBe("卧推");
  });

  it("已中文规范名保持;无映射原样", () => {
    expect(normalizeExerciseName("深蹲", FIXTURE_DICT)).toBe("深蹲");
    expect(normalizeExerciseName("腿弯举", FIXTURE_DICT)).toBe("腿弯举");
    expect(normalizeExerciseName("squat machine", FIXTURE_DICT)).toBe("squat machine");
    expect(normalizeExerciseName("", FIXTURE_DICT)).toBe("");
  });

  it("空字典:无映射可用时原样返回", () => {
    expect(normalizeExerciseName("squat", emptyDict())).toBe("squat");
    expect(normalizeExerciseName("深蹲", emptyDict())).toBe("深蹲"); // 预设仍由代码兜底
  });
});

describe("exerciseSearchMatch", () => {
  it("中文名或任一英文别名包含 q 即命中(大小写不敏感)", () => {
    expect(exerciseSearchMatch("深蹲", "squat", FIXTURE_DICT)).toBe(true);
    expect(exerciseSearchMatch("深蹲", "SQUAT", FIXTURE_DICT)).toBe(true);
    expect(exerciseSearchMatch("深蹲", "back squat", FIXTURE_DICT)).toBe(true);
    expect(exerciseSearchMatch("二头弯举", "bicep", FIXTURE_DICT)).toBe(true);
    expect(exerciseSearchMatch("二头弯举", "弯举", FIXTURE_DICT)).toBe(true);
    expect(exerciseSearchMatch("腿弯举", "leg curl", FIXTURE_DICT)).toBe(true);
    expect(exerciseSearchMatch("腿弯举", "腿弯举", FIXTURE_DICT)).toBe(true);
    expect(exerciseSearchMatch("髋外展", "hip", FIXTURE_DICT)).toBe(true);
    expect(exerciseSearchMatch("髋外展", "髋", FIXTURE_DICT)).toBe(true);
    expect(exerciseSearchMatch("前臂支撑举腿", "提腿", FIXTURE_DICT)).toBe(false); // 变体不做搜索匹配
  });

  it("不命中与空查询", () => {
    expect(exerciseSearchMatch("深蹲", "sqat", FIXTURE_DICT)).toBe(false);
    expect(exerciseSearchMatch("深蹲拉雪橇", "squat", FIXTURE_DICT)).toBe(false);
    expect(exerciseSearchMatch("深蹲", "", FIXTURE_DICT)).toBe(true);
  });
});

describe("aliasesFor", () => {
  it("预设动作返回 en + 全部别名;非预设返回别名反查结果", () => {
    expect(aliasesFor("深蹲", FIXTURE_DICT)).toContain("Squat");
    expect(aliasesFor("高脚杯深蹲", FIXTURE_DICT)).toContain("goblet squat");
    expect(aliasesFor("深蹲", FIXTURE_DICT)).not.toContain("goblet squat");
    expect(aliasesFor("臀推", FIXTURE_DICT)).toContain("hip thrust");
    expect(aliasesFor("罗马尼亚硬拉", FIXTURE_DICT)).toContain("romanian deadlift");
    expect(aliasesFor("Squat", FIXTURE_DICT)).toHaveLength(0); // 非规范名不反查
  });
});

describe("lastUsedByExercise", () => {
  it("会话/legacy 两种格式都支持,保留最近一次日期", () => {
    const early = workout({
      type: "strength",
      date: "2026-08-01T10:00:00Z",
      data: {
        session: true,
        exercise: "",
        weight_kg: 0,
        sets: 1,
        reps: 1,
        exercises: [{ name: "臀推", done: false, sets: [] }],
      },
    });
    const late = workout({
      type: "strength",
      date: "2026-08-10T10:00:00Z",
      data: { exercise: "臀推", weight_kg: 60, sets: 3, reps: 10 },
    });
    const map = lastUsedByExercise([early, late]);
    expect(map.get("臀推")).toBe("2026-08-10T10:00:00Z");
  });

  it("非力量类型与空列表忽略,非法日期跳过", () => {
    const running = workout({ type: "running", data: { distance_meters: 1000, duration_seconds: 300, mood: 3 } });
    const badDate = workout({
      type: "strength",
      date: "not-a-date",
      data: { exercise: "深蹲", weight_kg: 60, sets: 3, reps: 10 },
    });
    expect(lastUsedByExercise([running, badDate]).size).toBe(0);
    expect(lastUsedByExercise([]).size).toBe(0);
  });
});

describe("exerciseUsageByExercise", () => {
  it("聚合次数与最近日期,会话/legacy 都支持", () => {
    const early = workout({
      type: "strength",
      date: "2026-08-01T10:00:00Z",
      data: {
        session: true,
        exercise: "",
        weight_kg: 0,
        sets: 1,
        reps: 1,
        exercises: [{ name: "深蹲", done: false, sets: [] }],
      },
    });
    const late = workout({
      type: "strength",
      date: "2026-08-10T10:00:00Z",
      data: {
        session: true,
        exercise: "",
        weight_kg: 0,
        sets: 1,
        reps: 1,
        exercises: [{ name: "深蹲", done: false, sets: [] }],
      },
    });
    const legacy = workout({
      type: "strength",
      date: "2026-08-05T10:00:00Z",
      data: { exercise: "卧推", weight_kg: 60, sets: 3, reps: 10 },
    });

    const usage = exerciseUsageByExercise([early, late, legacy]);
    expect(usage.get("深蹲")).toEqual({ count: 2, lastUsed: "2026-08-10T10:00:00Z" });
    expect(usage.get("卧推")).toEqual({ count: 1, lastUsed: "2026-08-05T10:00:00Z" });
  });

  it("非力量/空名忽略,非法日期仍计数但 lastUsed 为 null", () => {
    const running = workout({ type: "running", data: { distance_meters: 1000, duration_seconds: 300, mood: 3 } });
    const badDate = workout({
      type: "strength",
      date: "not-a-date",
      data: { exercise: "深蹲", weight_kg: 60, sets: 3, reps: 10 },
    });

    const usage = exerciseUsageByExercise([running, badDate]);
    expect(usage.get("深蹲")).toEqual({ count: 1, lastUsed: null });
  });
});
