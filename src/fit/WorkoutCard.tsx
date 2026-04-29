import { Footprints, Waves, Dumbbell, Trash2 } from "lucide-react";
import { Workout, RunningData, SwimmingData, StrengthData } from "./types";
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
};

export const WorkoutCard = ({ workout, onDelete }: { workout: Workout; onDelete: (id: string) => void }) => {
  const { prefs } = usePreferences();
  const Icon = ICONS[workout.type];
  const date = new Date(workout.date);

  const moods = ["😞", "😕", "😐", "🙂", "🤩"];

  let primary = "";
  let secondary = "";

  if (workout.type === "running") {
    const d = workout.data as RunningData;
    primary = `${formatNumber(metersToDisplay(d.distance_meters, prefs.distance_unit))} ${prefs.distance_unit}`;
    secondary = `${formatDuration(d.duration_seconds)} · ${moods[d.mood - 1] ?? ""}`;
  } else if (workout.type === "swimming") {
    const d = workout.data as SwimmingData;
    const swimMood = d.mood ? `${moods[d.mood - 1] ?? ""} · ` : "";
    const stroke = d.stroke ? `${d.stroke} · ` : "";
    primary = `${formatNumber(poolMetersToDisplay(d.distance_meters, prefs.pool_unit), 0)} ${prefs.pool_unit}`;
    secondary = `${swimMood}${stroke}${formatDuration(d.duration_seconds)} · 池长 ${formatNumber(poolMetersToDisplay(d.pool_length_meters, prefs.pool_unit), 0)}${prefs.pool_unit} · ${d.laps ?? 0} 圈`;
  } else {
    const d = workout.data as StrengthData;
    const isSession = !!d.session && Array.isArray(d.exercises) && d.exercises.length > 0;
    primary = isSession ? "力量训练会话" : d.exercise;
    if (isSession) {
      const doneCount = d.exercises?.filter((e) => e.done).length ?? 0;
      const names = d.exercises?.slice(0, 2).map((e) => e.name).join(" · ") ?? "";
      const more = (d.exercises?.length ?? 0) > 2 ? ` +${(d.exercises?.length ?? 0) - 2}` : "";
      secondary = `${doneCount}/${d.exercises?.length ?? 0} 动作完成 · ${d.sets} 组 · ${names}${more}`;
    } else {
      const loadText = d.bodyweight || d.weight_kg <= 0
        ? "BW"
        : `${formatNumber(kgToDisplay(d.weight_kg, prefs.weight_unit))} ${prefs.weight_unit}`;
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
      <button
        onClick={() => onDelete(workout.id)}
        className="opacity-0 group-hover:opacity-100 transition-smooth p-1.5 rounded-md text-fit-muted hover:text-destructive"
        aria-label="删除"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};
