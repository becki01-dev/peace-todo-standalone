export type WorkoutType = "running" | "swimming" | "strength" | "swimming_set";

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
  input_unit?: DistanceUnit; // 记录输入时使用的单位
}

export interface SwimmingData {
  distance_meters: number;
  pool_length_meters: number;
  laps: number;
  stroke: string;
  mood?: number; // 1-5
  duration_seconds: number;
  input_unit?: PoolUnit; // 记录输入时使用的单位
}

export interface SwimmingSet {
  pool_length_meters: number;
  laps: number;
  stroke: string;
  duration_seconds: number;
  input_unit?: PoolUnit; // 记录输入时使用的单位
}

export interface SwimmingMultiSetData {
  sets: SwimmingSet[];
  total_distance_meters: number;
  total_duration_seconds: number;
  mood?: number;
}

// 专项游泳组数据结构
export interface SwimmingSetItem {
  sets_count: number; // 组数（如3组）
  count_per_set: number; // 每组个数（如10个）
  length_meters: number; // 每个长度（米）
  stroke: string; // 泳姿
  target_time_seconds: number; // 要求时间（秒）
  completed_count?: number; // 实际完成总数
  input_unit?: PoolUnit; // 记录输入时使用的单位
}

export interface SwimmingSetData {
  sets: SwimmingSetItem[];
  total_required_count: number; // 总共要求完成个数
  total_completed_count: number; // 实际完成总数
  completion_rate: number; // 完成度百分比
  notes?: string;
  input_unit?: PoolUnit; // 记录输入时使用的单位
}

// 专项游泳训练数据结构
export interface SwimmingDrillSet {
  count: number; // 每组个数
  length_meters: number; // 每个长度（米）
  target_time_seconds: number; // 要求时间（秒）
  completed_count?: number; // 实际完成个数
}

export interface SwimmingDrillData {
  sets: SwimmingDrillSet[];
  total_required_count: number; // 总共要求完成个数
  total_completed_count: number; // 实际完成总数
  completion_rate: number; // 完成度百分比
  notes?: string;
}

export interface StrengthData {
  exercise: string;
  weight_kg: number;
  bodyweight?: boolean;
  sets: number;
  reps: number;
  input_unit?: WeightUnit; // 记录输入时使用的单位
  session?: boolean;
  exercises?: Array<{
    name: string;
    done?: boolean;
    input_unit?: WeightUnit; // 记录输入时使用的单位
    sets: Array<{
      weight_kg: number;
      reps: number;
      bodyweight?: boolean;
      done?: boolean;
    }>;
  }>;
}

export type WorkoutData = RunningData | SwimmingData | StrengthData | SwimmingMultiSetData | SwimmingSetData;

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