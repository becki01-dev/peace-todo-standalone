import { describe, expect, it } from "vitest";
import {
  PRESET_DEFS,
  BODY_PART_LABELS,
  resolveBodyPart,
  exerciseDefaults,
  frequentExerciseNames,
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
  it("12 个预设动作都有有效部位与中文标签", () => {
    expect(PRESET_DEFS).toHaveLength(12);
    PRESET_DEFS.forEach((p) => {
      expect(BODY_PART_LABELS[p.body_part]).toBeTruthy();
      expect(p.default_reps).toBeGreaterThan(0);
    });
  });
});
