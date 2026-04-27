import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Workout } from "../types";
import { WorkoutCard } from "../WorkoutCard";
import { SummaryCard } from "../SummaryCard";
import { FitEmptyState } from "../EmptyState";
import { toast } from "sonner";

interface Props {
  reloadKey: number;
}

const FitHistory = ({ reloadKey }: Props) => {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("workouts")
      .select("*")
      .order("date", { ascending: false });
    if (error) toast.error("加载失败");
    else setWorkouts((data ?? []) as unknown as Workout[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, reloadKey]);

  const handleDelete = async (id: string) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (error) {
      toast.error("删除失败");
      load();
    } else toast.success("已删除");
  };

  const sections = workouts.reduce<{ key: string; title: string; items: Workout[] }[]>((acc, workout) => {
    const dayKey = localDayKey(workout.date);
    const existing = acc[acc.length - 1];
    if (existing && existing.key === dayKey) {
      existing.items.push(workout);
      return acc;
    }
    acc.push({
      key: dayKey,
      title: formatDayTitle(workout.date),
      items: [workout],
    });
    return acc;
  }, []);

  return (
    <div className="space-y-5">
      <SummaryCard workouts={workouts} />

      <div>
        <h2 className="text-sm font-semibold text-fit-muted uppercase tracking-wider mb-3 px-1">最近记录</h2>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-fit-card animate-pulse" />
            ))}
          </div>
        ) : workouts.length === 0 ? (
          <FitEmptyState />
        ) : (
          <div className="space-y-4">
            {sections.map((section) => (
              <section key={section.key}>
                <h3 className="text-xs text-fit-muted mb-2 px-1">{section.title}</h3>
                <div className="space-y-2">
                  {section.items.map((w) => (
                    <WorkoutCard key={w.id} workout={w} onDelete={handleDelete} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FitHistory;

function localDayKey(isoDate: string) {
  const d = new Date(isoDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayTitle(isoDate: string) {
  const d = new Date(isoDate);
  const today = localDayKey(new Date().toISOString());
  const key = localDayKey(isoDate);
  if (key === today) return "今天";
  return d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", weekday: "short" });
}
