export type WorkoutType = "running" | "swimming" | "strength";

export type DistanceUnit = "km" | "mi";
export type WeightUnit = "kg" | "lb";
export type PoolUnit = "m" | "yd";

export interface UserPreferences {
  user_id: string;
  distance_unit: DistanceUnit;
  weight_unit: WeightUnit;
  pool_unit: PoolUnit;
}

// All numbers stored in metric: meters, seconds, kilograms
export interface RunningData {
  distance_meters: number;
  duration_seconds: number;
  mood: number; // 1-5
}

export interface SwimmingData {
  distance_meters: number;
  pool_length_meters: number;
  duration_seconds: number;
}

export interface StrengthData {
  exercise: string;
  weight_kg: number;
  bodyweight?: boolean;
  sets: number;
  reps: number;
}

export type WorkoutData = RunningData | SwimmingData | StrengthData;

export interface Workout {
  id: string;
  user_id: string;
  type: WorkoutType;
  date: string;
  notes: string | null;
  data: WorkoutData;
  created_at: string;
  updated_at: string;
}
