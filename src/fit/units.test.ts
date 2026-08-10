import { describe, it, expect } from "vitest";
import {
  metersToDisplay,
  distanceInputToMeters,
  kgToDisplay,
  weightInputToKg,
  poolMetersToDisplay,
  poolInputToMeters,
  yardsToMeters,
  metersToYards,
  formatDuration,
  hmsToSeconds,
  formatNumber,
  estimateKcal,
  workoutDistanceMeters,
  workoutDurationSeconds,
  estimateWorkoutKcal,
} from "./units";
import type { Workout, StrengthData, SwimmingSetData } from "./types";

const workout = (overrides: Partial<Workout> & Pick<Workout, "type" | "data">): Workout => ({
  id: "w1",
  user_id: "u1",
  type: "running",
  date: "2026-08-01T00:00:00Z",
  notes: null,
  data: { distance_meters: 0, duration_seconds: 0, mood: 3 },
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  ...overrides,
});

describe("distance (base: meters)", () => {
  it("converts meters to km/mi", () => {
    expect(metersToDisplay(1000, "km")).toBeCloseTo(1);
    expect(metersToDisplay(1609.344, "mi")).toBeCloseTo(1);
    expect(metersToDisplay(0, "km")).toBe(0);
  });

  it("converts input back to meters", () => {
    expect(distanceInputToMeters(1, "km")).toBeCloseTo(1000);
    expect(distanceInputToMeters(1, "mi")).toBeCloseTo(1609.344);
  });

  it("is invertible", () => {
    const km = 42.195;
    expect(metersToDisplay(distanceInputToMeters(km, "km"), "km")).toBeCloseTo(km);
    const mi = 26.2;
    expect(metersToDisplay(distanceInputToMeters(mi, "mi"), "mi")).toBeCloseTo(mi);
  });
});

describe("weight (base: kg)", () => {
  it("converts kg to lb/kg", () => {
    expect(kgToDisplay(1, "lb")).toBeCloseTo(2.20462);
    expect(kgToDisplay(1, "kg")).toBe(1);
    expect(kgToDisplay(0, "lb")).toBe(0);
  });

  it("converts input back to kg", () => {
    expect(weightInputToKg(2.20462, "lb")).toBeCloseTo(1);
    expect(weightInputToKg(100, "kg")).toBe(100);
  });

  it("is invertible", () => {
    const lb = 135;
    expect(kgToDisplay(weightInputToKg(lb, "lb"), "lb")).toBeCloseTo(lb);
  });
});

describe("pool (base: meters)", () => {
  it("converts meters to yd/m", () => {
    expect(poolMetersToDisplay(1, "yd")).toBeCloseTo(1.09361);
    expect(poolMetersToDisplay(1, "m")).toBe(1);
  });

  it("converts input back to meters", () => {
    expect(poolInputToMeters(1, "yd")).toBeCloseTo(1 / 1.09361);
    expect(poolInputToMeters(50, "m")).toBe(50);
  });

  it("yards/meters helpers are inverse", () => {
    expect(yardsToMeters(100)).toBeCloseTo(100 / 1.09361);
    expect(metersToYards(100)).toBeCloseTo(100 * 1.09361);
    expect(yardsToMeters(metersToYards(50))).toBeCloseTo(50);
  });
});

describe("duration", () => {
  it("formats seconds", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(59)).toBe("59s");
    expect(formatDuration(61)).toBe("1m 1s");
    expect(formatDuration(3600)).toBe("1h 0m");
    expect(formatDuration(3661)).toBe("1h 1m");
    expect(formatDuration(5400)).toBe("1h 30m");
  });

  it("hmsToSeconds combines fields", () => {
    expect(hmsToSeconds(0, 0, 0)).toBe(0);
    expect(hmsToSeconds(1, 2, 3)).toBe(3723);
    expect(hmsToSeconds(0, 30, 0)).toBe(1800);
  });
});

describe("formatNumber", () => {
  it("handles NaN and zeros", () => {
    expect(formatNumber(NaN)).toBe("0");
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(0, 0)).toBe("0");
  });

  it("strips trailing zeros in decimals", () => {
    expect(formatNumber(1.5)).toBe("1.5");
    expect(formatNumber(1.5, 0)).toBe("2"); // digits=0 returns rounded integer
    expect(formatNumber(0.1)).toBe("0.1");
    expect(formatNumber(123.456, 2)).toBe("123.46");
  });

  it("keeps integer part when decimals vanish", () => {
    expect(formatNumber(1.0)).toBe("1");
    expect(formatNumber(2.0, 2)).toBe("2");
  });
});

describe("estimateKcal", () => {
  it("estimates running by distance", () => {
    expect(estimateKcal("running", { distance_meters: 5000 })).toBe(325);
  });

  it("estimates swimming by duration", () => {
    expect(estimateKcal("swimming", { duration_seconds: 3600 })).toBe(540);
  });

  it("estimates strength by sets x reps", () => {
    expect(estimateKcal("strength", { sets: 3, reps: 10 })).toBe(15);
  });

  it("returns 0 when required fields missing", () => {
    expect(estimateKcal("running", { duration_seconds: 60 })).toBe(0);
    expect(estimateKcal("swimming", {})).toBe(0);
    expect(estimateKcal("strength", { sets: 3 })).toBe(0);
  });
});

describe("workoutDistanceMeters / workoutDurationSeconds(跨格式)", () => {
  it("多片段游泳读汇总字段,旧单条读单条字段", () => {
    const multi = workout({
      type: "swimming",
      data: { sets: [], total_distance_meters: 1000, total_duration_seconds: 600, mood: 3 },
    });
    expect(workoutDistanceMeters(multi)).toBe(1000);
    expect(workoutDurationSeconds(multi)).toBe(600);

    const single = workout({
      type: "swimming",
      data: { distance_meters: 1000, pool_length_meters: 25, laps: 40, stroke: "自由泳", duration_seconds: 600, mood: 3 },
    });
    expect(workoutDistanceMeters(single)).toBe(1000);
    expect(workoutDurationSeconds(single)).toBe(600);
  });

  it("专项游泳组:距离按 实际完成数×长度,时长按 要求时间×实际完成组数 估算", () => {
    const d: SwimmingSetData = {
      sets: [
        { sets_count: 3, count_per_set: 10, length_meters: 50, stroke: "自由泳", target_time_seconds: 150, completed_count: 27 },
      ],
      total_required_count: 30,
      total_completed_count: 27,
      completion_rate: 90,
    };
    const w = workout({ type: "swimming_set", data: d });
    expect(workoutDistanceMeters(w)).toBe(1350); // 27 × 50
    expect(workoutDurationSeconds(w)).toBe(405); // 27/10 = 2.7 组 × 150
  });

  it("专项游泳组未填完成数时按要求数估算距离、按全量组数估算时长", () => {
    const d: SwimmingSetData = {
      sets: [{ sets_count: 3, count_per_set: 10, length_meters: 50, stroke: "自由泳", target_time_seconds: 150 }],
      total_required_count: 30,
      total_completed_count: 0,
      completion_rate: 0,
    };
    const w = workout({ type: "swimming_set", data: d });
    expect(workoutDistanceMeters(w)).toBe(1500); // 30 × 50
    expect(workoutDurationSeconds(w)).toBe(450); // 3 组 × 150
  });

  it("跑步/力量与旧口径一致", () => {
    const run = workout({ type: "running", data: { distance_meters: 5000, duration_seconds: 1800, mood: 3 } });
    expect(workoutDistanceMeters(run)).toBe(5000);
    expect(workoutDurationSeconds(run)).toBe(1800);
    const strength = workout({ type: "strength", data: { exercise: "卧推", weight_kg: 60, sets: 3, reps: 10 } });
    expect(workoutDistanceMeters(strength)).toBe(0);
    expect(workoutDurationSeconds(strength)).toBe(0);
  });
});

describe("estimateWorkoutKcal(跨格式)", () => {
  it("多片段游泳按总时长估算", () => {
    const w = workout({ type: "swimming", data: { sets: [], total_distance_meters: 1000, total_duration_seconds: 600, mood: 3 } });
    expect(estimateWorkoutKcal(w)).toBe(90); // 600s × 9/60
  });

  it("专项游泳组按要求时间估算", () => {
    const d: SwimmingSetData = {
      sets: [{ sets_count: 3, count_per_set: 10, length_meters: 50, stroke: "自由泳", target_time_seconds: 150 }],
      total_required_count: 30,
      total_completed_count: 0,
      completion_rate: 0,
    };
    expect(estimateWorkoutKcal(workout({ type: "swimming_set", data: d }))).toBe(68); // 450s → 67.5 → 68
  });

  it("力量会话格式按总组数估算", () => {
    const d: StrengthData = {
      exercise: "",
      weight_kg: 0,
      sets: 5,
      session: true,
      exercises: [
        { name: "卧推", sets: [{ weight_kg: 60, reps: 10 }, { weight_kg: 60, reps: 8 }] },
        { name: "深蹲", sets: [{ weight_kg: 80, reps: 5 }, { weight_kg: 80, reps: 5 }, { weight_kg: 80, reps: 5 }] },
      ],
    };
    expect(estimateWorkoutKcal(workout({ type: "strength", data: d }))).toBe(3); // 5 组 × 0.5 → 2.5 → 3
  });

  it("旧格式保持不变", () => {
    const run = workout({ type: "running", data: { distance_meters: 5000, duration_seconds: 1800, mood: 3 } });
    expect(estimateWorkoutKcal(run)).toBe(325);
    const strength = workout({ type: "strength", data: { exercise: "卧推", weight_kg: 60, sets: 3, reps: 10 } });
    expect(estimateWorkoutKcal(strength)).toBe(15);
  });
});
