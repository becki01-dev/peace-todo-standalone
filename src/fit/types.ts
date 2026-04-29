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
  laps: number;
  stroke: string;
  mood?: number; // 1-5
  duration_seconds: number;
}

export interface SwimmingSet {
  pool_length_meters: number;
  laps: number;
  stroke: string;
  duration_seconds: number;
}

export interface SwimmingMultiSetData {
  sets: SwimmingSet[];
  total_distance_meters: number;
  total_duration_seconds: number;
  mood?: number;
}

export interface StrengthData {
  exercise: string;
  weight_kg: number;
  bodyweight?: boolean;
  sets: number;
  reps: number;
  session?: boolean;
  exercises?: Array<{
    name: string;
    done?: boolean;
    sets: Array<{
      weight_kg: number;
      reps: number;
      bodyweight?: boolean;
      done?: boolean;
    }>;
  }>;
}

export type WorkoutData = RunningData | SwimmingData | StrengthData | SwimmingMultiSetData;

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