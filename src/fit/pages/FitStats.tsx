import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Workout } from "../types";
import { usePreferences } from "../usePreferences";
import {
  workoutDistanceMeters,
  workoutDurationSeconds,
  estimateWorkoutKcal,
  formatDuration,
  formatNumber,
  metersToDisplay,
} from "../units";
import { FitEmptyState } from "../EmptyState";
import { Footprints, Waves, Dumbbell, Target } from "lucide-react";
import { cn } from "@/lib/utils";

type Range = "week" | "month";

const FitStats = () => {
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [range, setRange] = useState<Range>("week");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("workouts")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .then(({ data }) => {
        setWorkouts((data ?? []) as unknown as Workout[]);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [user]);

  const filtered = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - (range === "week" ? 6 : 29));
    start.setHours(0, 0, 0, 0);
    return workouts.filter((w) => new Date(w.date) >= start);
  }, [workouts, range]);

  const totals = useMemo(() => {
    let meters = 0, seconds = 0, kcal = 0;
    const byType = { running: 0, swimming: 0, strength: 0, swimming_set: 0 };
    filtered.forEach((w) => {
      byType[w.type]++;
      meters += workoutDistanceMeters(w);
      seconds += workoutDurationSeconds(w);
      kcal += estimateWorkoutKcal(w);
    });
    return { meters, seconds, kcal, byType, count: filtered.length };
  }, [filtered]);

  // Bar chart: count per day
  const days = range === "week" ? 7 : 30;
  const chartData = useMemo(() => {
    const arr = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      d.setHours(0, 0, 0, 0);
      return { date: d, count: 0 };
    });
    filtered.forEach((w) => {
      const wd = new Date(w.date); wd.setHours(0, 0, 0, 0);
      const idx = arr.findIndex((x) => x.date.getTime() === wd.getTime());
      if (idx >= 0) arr[idx].count++;
    });
    return arr;
  }, [filtered, days]);

  const maxCount = Math.max(1, ...chartData.map((x) => x.count));
  const totalType =
    totals.byType.running + totals.byType.swimming + totals.byType.strength + totals.byType.swimming_set || 1;

  return (
    <div className="space-y-6">
      <div className="flex gap-1 p-1 bg-fit-card rounded-lg border border-fit-border" role="tablist" aria-label="统计范围">
        {(["week", "month"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            role="tab"
            aria-selected={range === r}
            className={cn(
              "flex-1 py-1.5 text-sm font-medium rounded-md transition-smooth",
              range === r ? "bg-fit-accent text-fit-accent-foreground" : "text-fit-muted",
            )}
          >
            {r === "week" ? "本周" : "近30天"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 rounded-xl bg-fit-card animate-pulse" />
      ) : totals.count === 0 ? (
        <FitEmptyState message="此时段还没有数据" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="次数" value={totals.count.toString()} />
            <Stat label="时长" value={formatDuration(totals.seconds)} />
            <Stat label="距离" value={`${formatNumber(metersToDisplay(totals.meters, prefs.distance_unit))} ${prefs.distance_unit}`} />
          </div>
          <Stat label="预估消耗" value={`${totals.kcal} kcal`} large />

          <div className="p-4 rounded-xl bg-fit-card border border-fit-border">
            <h3 className="text-xs text-fit-muted uppercase tracking-wider mb-4">每日训练次数</h3>
            <div className="flex items-end justify-between gap-1 h-32">
              {chartData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-fit-accent rounded-sm transition-all"
                    style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: d.count ? "4px" : "0" }}
                  />
                  {(range === "week" || i % 5 === 0) && (
                    <span className="text-[9px] text-fit-muted">{d.date.getDate()}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-fit-card border border-fit-border">
            <h3 className="text-xs text-fit-muted uppercase tracking-wider mb-4">运动类型分布</h3>
            <div className="space-y-3">
              <TypeRow icon={Footprints} label="跑步" count={totals.byType.running} total={totalType} />
              <TypeRow icon={Waves} label="游泳" count={totals.byType.swimming} total={totalType} />
              <TypeRow icon={Dumbbell} label="力量" count={totals.byType.strength} total={totalType} />
              <TypeRow icon={Target} label="专项组" count={totals.byType.swimming_set} total={totalType} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Stat = ({ label, value, large }: { label: string; value: string; large?: boolean }) => (
  <div className={cn("p-3 rounded-xl bg-fit-card border border-fit-border", large && "col-span-3")}>
    <div className="text-[10px] text-fit-muted uppercase tracking-wider">{label}</div>
    <div className={cn("font-bold text-fit-foreground tabular-nums mt-1", large ? "text-2xl text-fit-accent" : "text-base")}>{value}</div>
  </div>
);

const TypeRow = ({
  icon: Icon, label, count, total,
}: { icon: React.ComponentType<{ className?: string }>; label: string; count: number; total: number }) => {
  const pct = (count / total) * 100;
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-fit-muted" />
      <span className="text-sm text-fit-foreground w-12">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-fit-surface overflow-hidden">
        <div className="h-full bg-fit-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-fit-muted tabular-nums w-12 text-right">{count} 次</span>
    </div>
  );
};

export default FitStats;
