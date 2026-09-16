// 力量训练历史:聚合每个动作的最近使用、出现次数,以及用户登记过的动作名;参考页用它显示「最近练过 / 很久没练 / 我练过的」
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exerciseUsageByExercise, lastUsedByExercise, type ExerciseUsage } from "./exerciseLib";
import type { Workout } from "./types";

export interface ExerciseHistoryData {
  /** 原始动作名 → 最近一次训练日期(ISO) */
  lastUsed: Map<string, string>;
  /** 原始动作名 → 出现次数 + 最近日期 */
  usage: Map<string, ExerciseUsage>;
  /** user_exercises 中登记过的动作名(包含最近 200 条训练里没出现的) */
  knownNames: string[];
  loading: boolean;
}

export const useExerciseHistory = (): ExerciseHistoryData => {
  const { user } = useAuth();
  const [lastUsed, setLastUsed] = useState<Map<string, string>>(new Map());
  const [usage, setUsage] = useState<Map<string, ExerciseUsage>>(new Map());
  const [knownNames, setKnownNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLastUsed(new Map());
      setUsage(new Map());
      setKnownNames([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const [workoutsRes, exercisesRes] = await Promise.all([
          supabase
            .from("workouts")
            .select("type, data, date")
            .eq("user_id", user.id)
            .eq("type", "strength")
            .order("date", { ascending: false })
            .limit(200),
          supabase.from("user_exercises").select("name").eq("user_id", user.id),
        ]);
        if (cancelled) return;

        const workouts = (workoutsRes.data ?? []) as unknown as Workout[];
        const nextUsage = exerciseUsageByExercise(workouts);
        const names = new Set<string>();

        ((exercisesRes.data ?? []) as Array<{ name?: string | null }>).forEach((row) => {
          const name = row.name?.trim();
          if (!name) return;
          names.add(name);
          if (!nextUsage.has(name)) nextUsage.set(name, { count: 0, lastUsed: null });
        });
        nextUsage.forEach((_value, name) => names.add(name));

        setLastUsed(lastUsedByExercise(workouts));
        setUsage(nextUsage);
        setKnownNames([...names]);
      } catch {
        if (cancelled) return;
        setLastUsed(new Map());
        setUsage(new Map());
        setKnownNames([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { lastUsed, usage, knownNames, loading };
};
