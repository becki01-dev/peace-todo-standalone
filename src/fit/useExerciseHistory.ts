// 力量训练历史:动作名 -> 最近一次训练时间(ISO);参考页用它显示「最近练过 / 很久没练」
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lastUsedByExercise } from "./exerciseLib";
import type { Workout } from "./types";

export const useExerciseHistory = () => {
  const { user } = useAuth();
  const [lastUsed, setLastUsed] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLastUsed(new Map());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("workouts")
      .select("type, data, date")
      .eq("user_id", user.id)
      .eq("type", "strength")
      .order("date", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (cancelled) return;
        setLastUsed(lastUsedByExercise((data ?? []) as unknown as Workout[]));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLastUsed(new Map());
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { lastUsed, loading };
};