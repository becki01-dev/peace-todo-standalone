import { useMemo, useState } from "react";
import { Workout, RunningData, SwimmingData, StrengthData } from "./types";
import { estimateKcal, formatDuration, formatNumber, metersToDisplay } from "./units";
import { usePreferences } from "./usePreferences";
import { Flame, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export const SummaryCard = ({ workouts }: { workouts: Workout[] }) => {
  const { prefs } = usePreferences();
  const [idx, setIdx] = useState(0);

  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const weekItems = workouts.filter((w) => new Date(w.date) >= weekStart);

    let kcal = 0;
    let seconds = 0;
    let meters = 0;

    weekItems.forEach((w) => {
      if (w.type === "running") {
        const d = w.data as RunningData;
        kcal += estimateKcal("running", d);
        seconds += d.duration_seconds || 0;
        meters += d.distance_meters || 0;
      } else if (w.type === "swimming") {
        const d = w.data as SwimmingData;
        kcal += estimateKcal("swimming", d);
        seconds += d.duration_seconds || 0;
        meters += d.distance_meters || 0;
      } else {
        const d = w.data as StrengthData;
        kcal += estimateKcal("strength", d);
      }
    });

    return { kcal, seconds, meters, count: weekItems.length };
  }, [workouts]);

  const cards = [
    {
      icon: Flame,
      label: "本周累计消耗",
      value: stats.kcal.toString(),
      unit: "kcal",
    },
    {
      icon: Clock,
      label: "本周运动总时长",
      value: formatDuration(stats.seconds || 0),
      unit: "",
    },
    {
      icon: MapPin,
      label: "本周累计距离",
      value: formatNumber(metersToDisplay(stats.meters, prefs.distance_unit)),
      unit: prefs.distance_unit,
    },
  ];

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const w = e.currentTarget.clientWidth;
    setIdx(Math.round(e.currentTarget.scrollLeft / w));
  };

  return (
    <div>
      <div
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ scrollbarWidth: "none" }}
      >
        {cards.map((c, i) => (
          <div
            key={i}
            className="snap-center shrink-0 w-[calc(100%-2rem)] sm:w-full p-5 rounded-2xl bg-gradient-to-br from-fit-accent/15 via-fit-card to-fit-card border border-fit-accent/30 shadow-fit-glow/20"
          >
            <div className="flex items-center gap-2 text-fit-muted text-xs mb-3">
              <c.icon className="w-4 h-4 text-fit-accent" />
              {c.label}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold text-fit-foreground tabular-nums tracking-tight">{c.value}</span>
              {c.unit && <span className="text-fit-muted text-sm font-medium">{c.unit}</span>}
            </div>
            <p className="text-xs text-fit-muted mt-2">本周 {stats.count} 次训练</p>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 mt-3">
        {cards.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 rounded-full transition-all",
              i === idx ? "w-5 bg-fit-accent" : "w-1 bg-fit-border",
            )}
          />
        ))}
      </div>
    </div>
  );
};
