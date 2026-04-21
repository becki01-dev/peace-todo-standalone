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
          <div className="space-y-2">
            {workouts.map((w) => (
              <WorkoutCard key={w.id} workout={w} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FitHistory;
