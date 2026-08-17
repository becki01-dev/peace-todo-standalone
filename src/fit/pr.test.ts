import { describe, expect, it } from "vitest";
import { est1rm, setEffectiveKg, exerciseLogs, prSeries, prBreakthroughs, currentPr, type PRPoint } from "./pr";
import type { Workout } from "./types";

const w = (overrides: Partial<Workout> & Pick<Workout, "type" | "data">): Workout => ({
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

const noWeight = () => null;
const fixedWeight = (kg: number) => () => kg;

const strength = (
  date: string,
  data: Parameters<typeof w>[0]["data"],
): Workout => w({ type: "strength", date, data });

describe("setEffectiveKg", () => {
  it("非自重组 = 器械重量;自重组 = 体重 + 附加", () => {
    expect(setEffectiveKg(60, false, null)).toBe(60);
    expect(setEffectiveKg(0, true, 70)).toBe(70);
    expect(setEffectiveKg(20, true, 70)).toBe(90);
    expect(setEffectiveKg(0, true, null)).toBe(0); // 无体重 → 退化为附加
  });
});

describe("est1rm", () => {
  it("Epley:kg × (1 + reps/30)", () => {
    expect(est1rm(100, 10)).toBeCloseTo(133.33, 1);
    expect(est1rm(60, 5)).toBeCloseTo(70);
    expect(est1rm(100, 1)).toBeCloseTo(103.33, 2);
  });
  it("无效输入 → null", () => {
    expect(est1rm(0, 10)).toBeNull();
    expect(est1rm(100, 0)).toBeNull();
    expect(est1rm(100, -3)).toBeNull();
  });
});

describe("exerciseLogs", () => {
  it("legacy 单动作展开为 sets 组 × reps 次", () => {
    const logs = exerciseLogs(
      [strength("2026-08-09T04:00:00Z", { exercise: "深蹲", weight_kg: 100, sets: 3, reps: 5 })],
      "深蹲",
      noWeight,
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].sets).toHaveLength(3);
    expect(logs[0].sets[0]).toEqual({ weight_kg: 100, reps: 5 });
  });

  it("会话格式逐组提取;只匹配同名动作", () => {
    const logs = exerciseLogs(
      [
        strength("2026-08-09T04:00:00Z", {
          session: true,
          exercise: "",
          weight_kg: 0,
          sets: 1,
          reps: 10,
          exercises: [
            { name: "卧推", sets: [{ weight_kg: 60, reps: 10 }, { weight_kg: 65, reps: 8 }] },
            { name: "深蹲", sets: [{ weight_kg: 80, reps: 5 }] },
          ],
        }),
      ],
      "卧推",
      noWeight,
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].sets).toEqual([{ weight_kg: 60, reps: 10 }, { weight_kg: 65, reps: 8 }]);
  });

  it("按日期升序;多训练合并", () => {
    const logs = exerciseLogs(
      [
        strength("2026-08-09T04:00:00Z", { exercise: "深蹲", weight_kg: 80, sets: 1, reps: 5 }),
        strength("2026-08-01T04:00:00Z", { exercise: "深蹲", weight_kg: 70, sets: 1, reps: 5 }),
      ],
      "深蹲",
      noWeight,
    );
    expect(logs.map((l) => l.date.toISOString())).toEqual(["2026-08-01T04:00:00.000Z", "2026-08-09T04:00:00.000Z"]);
  });

  it("自重组:体重阶梯 + 附加重量", () => {
    const logs = exerciseLogs(
      [
        strength("2026-08-09T04:00:00Z", {
          session: true,
          exercise: "",
          weight_kg: 0,
          sets: 1,
          reps: 10,
          exercises: [
            { name: "引体向上", sets: [{ weight_kg: 0, reps: 8, bodyweight: true }, { weight_kg: 10, reps: 5, bodyweight: true }] },
          ],
        }),
      ],
      "引体向上",
      fixedWeight(70),
    );
    expect(logs[0].sets).toEqual([{ weight_kg: 70, reps: 8 }, { weight_kg: 80, reps: 5 }]);
  });

  it("无体重时自重组有效重量 = 附加(0 → 跳过);非力量类型忽略;legacy bodyweight 同样折算", () => {
    expect(exerciseLogs([strength("2026-08-09T04:00:00Z", { session: true, exercise: "", weight_kg: 0, sets: 1, reps: 10, exercises: [{ name: "引体向上", sets: [{ weight_kg: 0, reps: 8, bodyweight: true }] }] })], "引体向上", noWeight)).toEqual([{ date: new Date("2026-08-09T04:00:00Z"), sets: [{ weight_kg: 0, reps: 8 }] }]);
    expect(exerciseLogs([w({ type: "running", date: "2026-08-09T04:00:00Z", data: { distance_meters: 1, duration_seconds: 1, mood: 3 } })], "深蹲", noWeight)).toEqual([]);
    expect(exerciseLogs([strength("2026-08-09T04:00:00Z", { exercise: "深蹲", weight_kg: 20, bodyweight: true, sets: 2, reps: 10 })], "深蹲", fixedWeight(70))[0].sets).toEqual([{ weight_kg: 90, reps: 10 }, { weight_kg: 90, reps: 10 }]);
  });
});

describe("prSeries", () => {
  it("每天取最佳 1RM;无效组跳过", () => {
    const series = prSeries([
      { date: new Date("2026-08-01T04:00:00Z"), sets: [{ weight_kg: 100, reps: 5 }, { weight_kg: 110, reps: 3 }] },
      { date: new Date("2026-08-09T04:00:00Z"), sets: [{ weight_kg: 0, reps: 8 }] }, // 全无效(自重无体重)
      { date: new Date("2026-08-10T04:00:00Z"), sets: [{ weight_kg: 105, reps: 5 }] },
    ]);
    expect(series).toHaveLength(2);
    expect(series[0].est1rm).toBeCloseTo(121, 1); // max(116.67, 121)
    expect(series[0].weight_kg).toBe(110); // 最佳组详情
    expect(series[0].reps).toBe(3);
    expect(series[1].est1rm).toBeCloseTo(122.5, 1);
  });
});

describe("prBreakthroughs / currentPr", () => {
  it("首次 + 每次新高;持平不算突破", () => {
    const series: PRPoint[] = [
      { date: new Date("2026-08-01T04:00:00Z"), est1rm: 100, weight_kg: 90, reps: 3 },
      { date: new Date("2026-08-05T04:00:00Z"), est1rm: 100, weight_kg: 90, reps: 3 }, // 持平
      { date: new Date("2026-08-09T04:00:00Z"), est1rm: 105, weight_kg: 95, reps: 3 },
      { date: new Date("2026-08-11T04:00:00Z"), est1rm: 102, weight_kg: 90, reps: 4 }, // 回落
      { date: new Date("2026-08-13T04:00:00Z"), est1rm: 110, weight_kg: 100, reps: 3 },
    ];
    const bt = prBreakthroughs(series);
    expect(bt.map((p) => p.est1rm)).toEqual([100, 105, 110]);
    expect(bt.map((p) => p.date.toISOString())).toEqual([
      "2026-08-01T04:00:00.000Z",
      "2026-08-09T04:00:00.000Z",
      "2026-08-13T04:00:00.000Z",
    ]);
    expect(currentPr(bt)?.est1rm).toBe(110);
    expect(currentPr([])).toBeNull();
  });
});
