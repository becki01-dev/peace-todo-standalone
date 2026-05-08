import { Footprints, Waves, Dumbbell, Trash2, Pencil, Target } from "lucide-react";
import { Workout, RunningData, SwimmingData, StrengthData, SwimmingMultiSetData, SwimmingSetData, DistanceUnit, WeightUnit, PoolUnit } from "./types";
import { usePreferences } from "./usePreferences";
import {
  metersToDisplay,
  poolMetersToDisplay,
  kgToDisplay,
  formatDuration,
  formatNumber,
} from "./units";

const ICONS = {
  running: Footprints,
  swimming: Waves,
  strength: Dumbbell,
  swimming_set: Target,
};

// 旧数据的默认单位（没有 input_unit 字段时使用）
const LEGACY_DEFAULT_UNITS = {
  distance: "mile" as DistanceUnit,  // 跑步默认 mile
  weight: "lb" as WeightUnit,        // 力量训练默认 lb
  pool: "yd" as PoolUnit,            // 游泳默认 yd
};

export const WorkoutCard = ({ workout, onDelete, onEdit }: { 
  workout: Workout; 
  onDelete: (id: string) => void;
  onEdit?: (workout: Workout) => void;
}) => {
  const { prefs } = usePreferences();
  const Icon = ICONS[workout.type];
  const date = new Date(workout.date);

  const moods = ["😞", "😕", "😐", "🙂", "🤩"];

  let primary = "";
  let secondary = "";

  if (workout.type === "running") {
    const d = workout.data as RunningData;
    // 优先使用保存的输入单位，如果没有则使用旧数据默认单位（mile）
    const displayUnit = d.input_unit || LEGACY_DEFAULT_UNITS.distance;
    primary = `${formatNumber(metersToDisplay(d.distance_meters, displayUnit))} ${displayUnit}`;
    secondary = `${formatDuration(d.duration_seconds)} · ${moods[d.mood - 1] ?? ""}`;
  } else if (workout.type === "swimming") {
    const d = workout.data as SwimmingData | SwimmingMultiSetData;
    
    if ('sets' in d && Array.isArray(d.sets)) {
      // 多片段游泳数据
      const multiSetData = d as SwimmingMultiSetData;
      const swimMood = multiSetData.mood ? `${moods[multiSetData.mood - 1] ?? ""} · ` : "";
      
      // 优先使用保存的输入单位，如果没有则使用旧数据默认单位（yd）
      const displayUnit = multiSetData.sets[0]?.input_unit || LEGACY_DEFAULT_UNITS.pool;
      primary = `${formatNumber(poolMetersToDisplay(multiSetData.total_distance_meters, displayUnit), 0)} ${displayUnit}`;
      
      const setSummary = multiSetData.sets.reduce((acc, set) => {
        if (!acc[set.stroke]) {
          acc[set.stroke] = 0;
        }
        acc[set.stroke] += set.laps;
        return acc;
      }, {} as Record<string, number>);
      
      const strokeSummary = Object.entries(setSummary)
        .map(([stroke, laps]) => `${stroke}${laps}圈`)
        .join(" · ");
      
      secondary = `${swimMood}${strokeSummary} · ${formatDuration(multiSetData.total_duration_seconds)} · ${multiSetData.sets.length} 个片段`;
    } else {
      // 单一游泳数据
      const singleSetData = d as SwimmingData;
      const swimMood = singleSetData.mood ? `${moods[singleSetData.mood - 1] ?? ""} · ` : "";
      const stroke = singleSetData.stroke ? `${singleSetData.stroke} · ` : "";
      // 优先使用保存的输入单位，如果没有则使用旧数据默认单位（yd）
      const displayUnit = singleSetData.input_unit || LEGACY_DEFAULT_UNITS.pool;

      primary = `${formatNumber(poolMetersToDisplay(singleSetData.distance_meters, displayUnit), 0)} ${displayUnit}`;
      secondary = `${swimMood}${stroke}${formatDuration(singleSetData.duration_seconds)} · 池长 ${formatNumber(poolMetersToDisplay(singleSetData.pool_length_meters, displayUnit), 0)}${displayUnit} · ${singleSetData.laps ?? 0} 圈`;
    }
  } else if (workout.type === "swimming_set") {
    const d = workout.data as SwimmingSetData;
    primary = `专项游泳组 (${d.sets.length} 个训练组)`;
    
    // 按泳姿分组统计
    const strokeSummary = d.sets.reduce((acc, set) => {
      if (!acc[set.stroke]) {
        acc[set.stroke] = { setsCount: 0, requiredCount: 0, completed: 0 };
      }
      const totalRequired = set.sets_count * set.count_per_set;
      acc[set.stroke].setsCount += set.sets_count;
      acc[set.stroke].requiredCount += totalRequired;
      acc[set.stroke].completed += set.completed_count || 0;
      return acc;
    }, {} as Record<string, { setsCount: number; requiredCount: number; completed: number }>);
    
    const strokeText = Object.entries(strokeSummary)
      .map(([stroke, data]) => `${stroke} ${data.completed}/${data.requiredCount}(${data.setsCount}组)`)
      .join(" · ");
    
    secondary = `${strokeText} · 完成度: ${d.completion_rate.toFixed(1)}%`;
  } else {
    const d = workout.data as StrengthData;
    const isSession = !!d.session && Array.isArray(d.exercises) && d.exercises.length > 0;
    primary = isSession ? "力量训练" : d.exercise;
    if (isSession) {
      const doneCount = d.exercises?.filter((e) => e.done).length ?? 0;
      const names = d.exercises?.slice(0, 2).map((e) => e.name).join(" · ") ?? "";
      const more = (d.exercises?.length ?? 0) > 2 ? ` +${(d.exercises?.length ?? 0) - 2}` : "";
      secondary = `${doneCount}/${d.exercises?.length ?? 0} 动作完成 · ${d.sets} 组 · ${names}${more}`;
    } else {
      // 优先使用保存的输入单位，如果没有则使用旧数据默认单位（lb）
      const displayUnit = d.input_unit || LEGACY_DEFAULT_UNITS.weight;
      const loadText = d.bodyweight || d.weight_kg <= 0
        ? "BW"
        : `${formatNumber(kgToDisplay(d.weight_kg, displayUnit))} ${displayUnit}`;
      secondary = `${loadText} × ${d.sets} × ${d.reps}`;
    }
  }

  return (
    <div className="group flex items-center gap-3 p-4 rounded-xl bg-fit-card border border-fit-border hover:border-fit-accent/40 transition-smooth animate-fade-in-up">
      <div className="w-11 h-11 rounded-lg bg-fit-accent/10 text-fit-accent flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-fit-foreground font-semibold truncate">{primary}</p>
          <span className="text-[11px] text-fit-muted shrink-0">
            {date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </span>
        </div>
        <p className="text-xs text-fit-muted mt-0.5 truncate">{secondary}</p>
        {workout.notes && <p className="text-xs text-fit-muted/80 mt-1 truncate italic">"{workout.notes}"</p>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-smooth">
        {onEdit && (
          <button
            onClick={() => onEdit(workout)}
            className="p-1.5 rounded-md text-fit-muted hover:text-fit-accent"
            aria-label="编辑"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(workout.id)}
          className="p-1.5 rounded-md text-fit-muted hover:text-destructive"
          aria-label="删除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};