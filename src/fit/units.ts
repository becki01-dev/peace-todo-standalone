import { DistanceUnit, PoolUnit, WeightUnit } from "./types";

// ---- Distance (base: meters) ----
export const metersToDisplay = (meters: number, unit: DistanceUnit): number => {
  if (unit === "mi") return meters / 1609.344;
  return meters / 1000;
};

export const distanceInputToMeters = (value: number, unit: DistanceUnit): number => {
  if (unit === "mi") return value * 1609.344;
  return value * 1000;
};

// ---- Weight (base: kg) ----
export const kgToDisplay = (kg: number, unit: WeightUnit): number =>
  unit === "lb" ? kg * 2.20462 : kg;

export const weightInputToKg = (value: number, unit: WeightUnit): number =>
  unit === "lb" ? value / 2.20462 : value;

// ---- Pool (base: meters) ----
export const poolMetersToDisplay = (meters: number, unit: PoolUnit): number =>
  unit === "yd" ? meters * 1.09361 : meters;

export const poolInputToMeters = (value: number, unit: PoolUnit): number =>
  unit === "yd" ? value / 1.09361 : value;

// Yard to meters conversion (for drill length input)
export const yardsToMeters = (yards: number): number =>
  yards / 1.09361;

export const metersToYards = (meters: number): number =>
  meters * 1.09361;

// ---- Duration ----
export const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export const hmsToSeconds = (h: number, m: number, s: number): number =>
  h * 3600 + m * 60 + s;

export const formatNumber = (n: number, digits = 2): string => {
  if (Number.isNaN(n)) return "0";
  const fixed = n.toFixed(digits);
  // 只删除小数部分末尾的0，保留整数部分
  if (digits === 0) {
    return fixed; // 如果不需要小数位，直接返回
  }
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
};

// Rough kcal estimation
export const estimateKcal = (
  type: "running" | "swimming" | "strength",
  data: { distance_meters?: number; duration_seconds?: number; weight_kg?: number; sets?: number; reps?: number },
): number => {
  if (type === "running" && data.distance_meters) {
    return Math.round((data.distance_meters / 1000) * 65);
  }
  if (type === "swimming" && data.duration_seconds) {
    return Math.round((data.duration_seconds / 60) * 9);
  }
  if (type === "strength" && data.sets && data.reps) {
    return Math.round(data.sets * data.reps * 0.5);
  }
  return 0;
};
