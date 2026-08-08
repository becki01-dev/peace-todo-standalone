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
} from "./units";

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
