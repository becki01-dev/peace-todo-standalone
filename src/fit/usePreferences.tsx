import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserPreferences, DistanceUnit, WeightUnit, PoolUnit } from "./types";

const DEFAULTS: Omit<UserPreferences, "user_id"> = {
  distance_unit: "mi",
  weight_unit: "lb",
  pool_unit: "yd",
};

interface Ctx {
  prefs: Omit<UserPreferences, "user_id">;
  loading: boolean;
  update: (p: Partial<Omit<UserPreferences, "user_id">>) => Promise<void>;
}

const PrefsContext = createContext<Ctx | undefined>(undefined);

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPrefs(DEFAULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrefs({
            distance_unit: data.distance_unit as DistanceUnit,
            weight_unit: data.weight_unit as WeightUnit,
            pool_unit: data.pool_unit as PoolUnit,
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [user]);

  const update = useCallback(
    async (p: Partial<Omit<UserPreferences, "user_id">>) => {
      if (!user) return;
      const next = { ...prefs, ...p };
      setPrefs(next);
      await supabase.from("user_preferences").upsert({ user_id: user.id, ...next });
    },
    [prefs, user],
  );

  return <PrefsContext.Provider value={{ prefs, loading, update }}>{children}</PrefsContext.Provider>;
};

export const usePreferences = () => {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
};
