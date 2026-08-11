// 统计窗口/环比/分桶 纯函数单测;now 参数注入固定时间,不依赖 fake timers
import { describe, it, expect } from "vitest";
import {
  parseYmdLocal,
  ymdDaysAgo,
  daysBetweenYmd,
  rangeWindow,
  shiftWindow,
  inWindowRange,
  sumWorkouts,
  pctChange,
  formatPct,
  bucketWindow,
  seriesByType,
  startOfDay,
  shiftDays,
  buildWeightAt,
} from "./stats";
import { workoutDistanceMeters, workoutVolumeKg, hasBodyweightGroups } from "./units";
import type { Workout } from "./types";

// 固定"今天" = 2026-08-10(本地)
const NOW = new Date(2026, 7, 10, 15, 30);

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

// 本地 ymd(如 2026-08-09)→ 该日中午的 ISO(保证转回本地后仍在当天)
const isoOfYmd = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
};

describe("parseYmdLocal / ymdDaysAgo / daysBetweenYmd", () => {
  it("解析合法 ymd 为本地 0 点,非法/回绕/空 为 null", () => {
    expect(parseYmdLocal("2026-08-10")).toEqual(new Date(2026, 7, 10));
    expect(parseYmdLocal("2026-02-31")).toBeNull(); // 回绕归一化视为非法
    expect(parseYmdLocal("2026-8-1")).toBeNull(); // 格式要求补零
    expect(parseYmdLocal("")).toBeNull();
    expect(parseYmdLocal("abc")).toBeNull();
  });

  it("ymdDaysAgo 相对 now 前推", () => {
    expect(ymdDaysAgo(0, NOW)).toBe("2026-08-10");
    expect(ymdDaysAgo(6, NOW)).toBe("2026-08-04");
    expect(ymdDaysAgo(1, new Date(2026, 2, 1))).toBe("2026-02-28"); // 跨月
  });

  it("daysBetweenYmd 闭区间含首尾", () => {
    expect(daysBetweenYmd("2026-08-01", "2026-08-10")).toBe(10);
    expect(daysBetweenYmd("2026-08-10", "2026-08-10")).toBe(1);
    expect(daysBetweenYmd("2026-08-10", "2026-08-01")).toBeNull();
  });
});

describe("rangeWindow", () => {
  it("week:[今-6 0点, 明0点)", () => {
    const w = rangeWindow("week", "", "", NOW)!;
    expect(w.start).toEqual(new Date(2026, 7, 4));
    expect(w.endExclusive).toEqual(new Date(2026, 7, 11));
    expect(w.days).toBe(7);
  });

  it("month:[今-29 0点, 明0点),30 天", () => {
    const w = rangeWindow("month", "", "", NOW)!;
    expect(w.start).toEqual(new Date(2026, 6, 12));
    expect(w.endExclusive).toEqual(new Date(2026, 7, 11));
    expect(w.days).toBe(30);
  });

  it("custom 闭区间含当天,endExclusive = 止+1天 0点", () => {
    const w = rangeWindow("custom", "2026-08-01", "2026-08-10", NOW)!;
    expect(w.start).toEqual(new Date(2026, 7, 1));
    expect(w.endExclusive).toEqual(new Date(2026, 7, 11));
    expect(w.days).toBe(10);
  });

  it("custom 单天区间", () => {
    const w = rangeWindow("custom", "2026-08-10", "2026-08-10", NOW)!;
    expect(w.days).toBe(1);
    expect(w.endExclusive).toEqual(new Date(2026, 7, 11));
  });

  it("custom 起>止 或 ymd 非法 → null", () => {
    expect(rangeWindow("custom", "2026-08-10", "2026-08-01", NOW)).toBeNull();
    expect(rangeWindow("custom", "", "2026-08-01", NOW)).toBeNull();
    expect(rangeWindow("custom", "bad", "2026-08-01", NOW)).toBeNull();
  });
});

describe("shiftWindow / inWindowRange", () => {
  it("等长前推(week 上一区间)", () => {
    const w = rangeWindow("week", "", "", NOW)!;
    const prev = shiftWindow(w);
    expect(prev.start).toEqual(new Date(2026, 6, 28)); // 8/4 - 7 天
    expect(prev.endExclusive).toEqual(new Date(2026, 7, 4));
  });

  it("custom 不等长也正确前推", () => {
    const w = rangeWindow("custom", "2026-08-01", "2026-08-10", NOW)!;
    const prev = shiftWindow(w);
    expect(prev.start).toEqual(new Date(2026, 6, 22));
    expect(prev.endExclusive).toEqual(new Date(2026, 7, 1));
  });

  it("inWindowRange 半开区间:start 含,endExclusive 不含", () => {
    const w = rangeWindow("custom", "2026-08-01", "2026-08-10", NOW)!;
    expect(inWindowRange(workout({ type: "running", data: { distance_meters: 1, duration_seconds: 1, mood: 3 }, date: isoOfYmd("2026-08-01") }), w)).toBe(true);
    expect(inWindowRange(workout({ type: "running", data: { distance_meters: 1, duration_seconds: 1, mood: 3 }, date: isoOfYmd("2026-08-10") }), w)).toBe(true);
    expect(inWindowRange(workout({ type: "running", data: { distance_meters: 1, duration_seconds: 1, mood: 3 }, date: isoOfYmd("2026-07-31") }), w)).toBe(false);
    expect(inWindowRange(workout({ type: "running", data: { distance_meters: 1, duration_seconds: 1, mood: 3 }, date: isoOfYmd("2026-08-11") }), w)).toBe(false);
  });
});

describe("sumWorkouts", () => {
  it("四类型混合:距离/时长/kcal 按跨格式 helper 汇总,byType 计数", () => {
    const items = [
      workout({ type: "running", data: { distance_meters: 5000, duration_seconds: 1800, mood: 3 } }),
      workout({
        type: "swimming",
        data: { sets: [], total_distance_meters: 1000, total_duration_seconds: 600, mood: 3 },
      }),
      workout({
        type: "swimming_set",
        data: {
          sets: [{ sets_count: 3, count_per_set: 10, length_meters: 50, stroke: "自由泳", target_time_seconds: 150, completed_count: 27 }],
          total_required_count: 30,
          total_completed_count: 27,
          completion_rate: 90,
        },
      }),
      workout({ type: "strength", data: { exercise: "卧推", weight_kg: 60, sets: 3, reps: 10 } }),
    ];
    const s = sumWorkouts(items);
    expect(s.count).toBe(4);
    expect(s.meters).toBe(5000 + 1000 + 1350);
    expect(s.seconds).toBe(1800 + 600 + 405);
    expect(s.kcal).toBe(325 + 90 + 61 + 15);
    expect(s.byType).toEqual({ running: 1, swimming: 1, strength: 1, swimming_set: 1 });
  });
});

describe("pctChange / formatPct", () => {
  it("正常涨跌", () => {
    expect(pctChange(10, 5)).toBe(1);
    expect(pctChange(5, 10)).toBe(-0.5);
    expect(pctChange(5, 5)).toBe(0);
  });

  it("0 基线 → null", () => {
    expect(pctChange(5, 0)).toBeNull();
    expect(pctChange(0, 0)).toBeNull();
  });

  it("formatPct 带符号与舍入", () => {
    expect(formatPct(1)).toBe("+100%");
    expect(formatPct(-0.5)).toBe("-50%");
    expect(formatPct(0)).toBe("0%");
    expect(formatPct(0.1234)).toBe("+12%");
    expect(formatPct(null)).toBe("—");
  });
});

describe("bucketWindow", () => {
  it("30 天 → 30 桶(每桶 1 天)", () => {
    const start = new Date(2026, 6, 12);
    const end = new Date(2026, 7, 11);
    const buckets = bucketWindow(start, end, 60);
    expect(buckets).toHaveLength(30);
    expect(buckets[0]).toMatchObject({ start: new Date(2026, 6, 12), days: 1, count: 0 });
  });

  it("100 天 → 60 桶聚合(桶跨 2 天)", () => {
    const start = new Date(2026, 4, 1);
    const end = shiftDays(start, 100);
    const buckets = bucketWindow(start, end, 60);
    expect(buckets).toHaveLength(50);
    expect(buckets[0].days).toBe(2);
  });

  it("起点取自传入 start(与今天无关)", () => {
    const start = new Date(2026, 7, 3);
    const end = new Date(2026, 7, 10);
    const buckets = bucketWindow(start, end, 60);
    expect(buckets).toHaveLength(7);
    expect(buckets[0].start).toEqual(startOfDay(start));
  });
});

describe("seriesByType", () => {
  it("按桶聚合,类型分列,窗口外忽略", () => {
    const buckets = bucketWindow(new Date(2026, 7, 3), new Date(2026, 7, 10), 60); // 7 桶
    const items = [
      workout({ type: "running", date: isoOfYmd("2026-08-04"), data: { distance_meters: 5000, duration_seconds: 1800, mood: 3 } }),
      workout({ type: "running", date: isoOfYmd("2026-08-04"), data: { distance_meters: 2000, duration_seconds: 600, mood: 3 } }),
      workout({ type: "swimming", date: isoOfYmd("2026-08-06"), data: { sets: [], total_distance_meters: 1000, total_duration_seconds: 600, mood: 3 } }),
      workout({ type: "running", date: isoOfYmd("2026-08-02"), data: { distance_meters: 9999, duration_seconds: 999, mood: 3 } }), // 窗口外
    ];
    const s = seriesByType(items, buckets, (w) => workoutDistanceMeters(w));
    expect(s.running[1]).toBe(7000); // 08-04 两笔合并
    expect(s.running[0]).toBe(0);
    expect(s.swimming[3]).toBe(1000); // 08-06
    expect(s.running[0] + s.running[1] + s.running[2] + s.running[3] + s.running[4] + s.running[5] + s.running[6]).toBe(7000);
    expect(s.strength.every((v) => v === 0)).toBe(true);
  });

  it("自定义 valueOf 回调(总重量)", () => {
    const buckets = bucketWindow(new Date(2026, 7, 3), new Date(2026, 7, 10), 60);
    const items = [
      workout({ type: "strength", date: isoOfYmd("2026-08-05"), data: { exercise: "卧推", weight_kg: 60, sets: 3, reps: 10 } }),
    ];
    const s = seriesByType(items, buckets, workoutVolumeKg);
    expect(s.strength[2]).toBe(1800);
  });
});

describe("workoutVolumeKg", () => {
  it("单动作:weight×sets×reps", () => {
    const w = workout({ type: "strength", data: { exercise: "卧推", weight_kg: 60, sets: 3, reps: 10 } });
    expect(workoutVolumeKg(w)).toBe(1800);
  });

  it("单动作 bodyweight → 0(即使 weight_kg 非零)", () => {
    const w = workout({ type: "strength", data: { exercise: "引体", weight_kg: 60, bodyweight: true, sets: 3, reps: 10 } });
    expect(workoutVolumeKg(w)).toBe(0);
  });

  it("单动作 bodyweight + 体重 → 体重×sets×reps;不传/传 null 仍 0", () => {
    const w = workout({ type: "strength", data: { exercise: "引体", weight_kg: 60, bodyweight: true, sets: 3, reps: 10 } });
    expect(workoutVolumeKg(w, 70)).toBe(2100); // 70×3×10
    expect(workoutVolumeKg(w, null)).toBe(0);
  });

  it("会话:per-set 累加,不按 done 过滤(表单默认 done:false),bodyweight 组不计", () => {
    const w = workout({
      type: "strength",
      data: {
        exercise: "",
        weight_kg: 0,
        sets: 4,
        session: true,
        exercises: [
          {
            name: "卧推",
            done: true,
            sets: [
              { weight_kg: 60, reps: 8, bodyweight: false, done: true },
              { weight_kg: 60, reps: 8, bodyweight: false, done: true },
            ],
          },
          {
            name: "深蹲",
            done: true,
            sets: [
              { weight_kg: 100, reps: 5, bodyweight: false, done: false }, // 未勾完成,仍计入
              { weight_kg: 100, reps: 5, bodyweight: false, done: true },
            ],
          },
          {
            name: "引体",
            done: true,
            sets: [{ weight_kg: 0, reps: 10, bodyweight: true, done: true }], // 自重,不计
          },
        ],
      },
    });
    // 60×8×2 + 100×5×2 = 1960
    expect(workoutVolumeKg(w)).toBe(1960);
  });

  it("会话:bodyweight 组按 体重×次数 计入,器械组不变", () => {
    const w = workout({
      type: "strength",
      data: {
        exercise: "",
        weight_kg: 0,
        sets: 4,
        session: true,
        exercises: [
          {
            name: "卧推",
            done: true,
            sets: [
              { weight_kg: 60, reps: 8, bodyweight: false, done: true },
              { weight_kg: 60, reps: 8, bodyweight: false, done: true },
            ],
          },
          {
            name: "深蹲",
            done: true,
            sets: [
              { weight_kg: 100, reps: 5, bodyweight: false, done: false },
              { weight_kg: 100, reps: 5, bodyweight: false, done: true },
            ],
          },
          {
            name: "引体",
            done: true,
            sets: [{ weight_kg: 0, reps: 10, bodyweight: true, done: true }],
          },
        ],
      },
    });
    // 60×8×2 + 100×5×2 + 70×10 = 2660;不传体重仍是旧口径 1960
    expect(workoutVolumeKg(w, 70)).toBe(2660);
    expect(workoutVolumeKg(w)).toBe(1960);
  });

  it("会话:动作整体 done:false 也不影响统计", () => {
    const w = workout({
      type: "strength",
      data: {
        exercise: "",
        weight_kg: 0,
        sets: 2,
        session: true,
        exercises: [
          { name: "划船", done: false, sets: [{ weight_kg: 50, reps: 10, bodyweight: false, done: false }] },
          { name: "二头", done: true, sets: [{ weight_kg: 30, reps: 12, bodyweight: false, done: true }] },
        ],
      },
    });
    expect(workoutVolumeKg(w)).toBe(860); // 50×10 + 30×12
  });

  it("非力量类型 → 0", () => {
    expect(workoutVolumeKg(workout({ type: "running", data: { distance_meters: 5000, duration_seconds: 1800, mood: 3 } }))).toBe(0);
    expect(workoutVolumeKg(workout({ type: "swimming", data: { sets: [], total_distance_meters: 1000, total_duration_seconds: 600, mood: 3 } }))).toBe(0);
    expect(
      workoutVolumeKg(
        workout({
          type: "swimming_set",
          data: {
            sets: [{ sets_count: 3, count_per_set: 10, length_meters: 50, stroke: "自由泳", target_time_seconds: 150 }],
            total_required_count: 30,
            total_completed_count: 0,
            completion_rate: 0,
          },
        }),
      ),
    ).toBe(0);
  });
});

describe("buildWeightAt", () => {
  it("取当天或之前最近一次记录的体重(阶梯覆盖)", () => {
    const weightAt = buildWeightAt([
      { date: "2026-08-05", weight_kg: 70 },
      { date: "2026-08-08", weight_kg: 75 },
    ]);
    expect(weightAt(new Date(2026, 7, 4))).toBeNull(); // 早于首次记录 → 无覆盖
    expect(weightAt(new Date(2026, 7, 5))).toBe(70); // 当天
    expect(weightAt(new Date(2026, 7, 6))).toBe(70); // 两次记录之间取旧值
    expect(weightAt(new Date(2026, 7, 7))).toBe(70);
    expect(weightAt(new Date(2026, 7, 8))).toBe(75); // 改体重当天生效
    expect(weightAt(new Date(2026, 7, 30))).toBe(75); // 之后延续
  });

  it("乱序输入不影响结果", () => {
    const weightAt = buildWeightAt([
      { date: "2026-08-08", weight_kg: 75 },
      { date: "2026-08-05", weight_kg: 70 },
    ]);
    expect(weightAt(new Date(2026, 7, 6))).toBe(70);
    expect(weightAt(new Date(2026, 7, 8))).toBe(75);
  });

  it("空记录 → 恒 null", () => {
    const weightAt = buildWeightAt([]);
    expect(weightAt(new Date(2026, 7, 10))).toBeNull();
  });
});

describe("hasBodyweightGroups", () => {
  it("单动作 bodyweight / 会话含自重组 → true", () => {
    expect(
      hasBodyweightGroups(workout({ type: "strength", data: { exercise: "引体", weight_kg: 0, bodyweight: true, sets: 1, reps: 10 } })),
    ).toBe(true);
    expect(
      hasBodyweightGroups(
        workout({
          type: "strength",
          data: {
            exercise: "",
            weight_kg: 0,
            sets: 1,
            session: true,
            exercises: [{ name: "引体", done: true, sets: [{ weight_kg: 0, reps: 10, bodyweight: true, done: true }] }],
          },
        }),
      ),
    ).toBe(true);
  });

  it("纯器械会话 / 单动作 / 非力量 → false", () => {
    expect(
      hasBodyweightGroups(workout({ type: "strength", data: { exercise: "卧推", weight_kg: 60, sets: 3, reps: 10 } })),
    ).toBe(false);
    expect(
      hasBodyweightGroups(
        workout({
          type: "strength",
          data: {
            exercise: "",
            weight_kg: 0,
            sets: 1,
            session: true,
            exercises: [{ name: "卧推", done: true, sets: [{ weight_kg: 60, reps: 8, bodyweight: false, done: true }] }],
          },
        }),
      ),
    ).toBe(false);
    expect(hasBodyweightGroups(workout({ type: "running", data: { distance_meters: 1000, duration_seconds: 600, mood: 3 } }))).toBe(false);
  });
});
