import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  EXERCISE_DICT_ADMIN_EMAIL,
  ExerciseDict,
  ExerciseDictEntry,
  dictFromRows,
  emptyDict,
} from "./exerciseLib";

interface Ctx {
  dict: ExerciseDict;
  rows: ExerciseDictEntry[];
  loading: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}

const ExerciseDictContext = createContext<Ctx | undefined>(undefined);

/** 全局动作字典(DB exercise_dictionary 表):登录后加载一次,编辑页增删改后 refresh 重拉 */
export const ExerciseDictProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<ExerciseDictEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("exercise_dictionary")
        .select("id, kind, key, value")
        .order("kind", { ascending: true })
        .order("key", { ascending: true });
      if (error) throw error;
      setRows((data ?? []) as ExerciseDictEntry[]);
    } catch {
      // 表未建/离线:空字典降级(显示原名),表单仍可用
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dict = useMemo(() => dictFromRows(rows), [rows]);
  const isAdmin = !!user && user.email?.toLowerCase() === EXERCISE_DICT_ADMIN_EMAIL.toLowerCase();

  return (
    <ExerciseDictContext.Provider value={{ dict, rows, loading, isAdmin, refresh }}>
      {children}
    </ExerciseDictContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- Provider 与 hook 同文件是项目惯例,改动时降级为全量刷新
export const useExerciseDict = () => {
  const ctx = useContext(ExerciseDictContext);
  if (!ctx) throw new Error("useExerciseDict must be used within ExerciseDictProvider");
  return ctx;
};
