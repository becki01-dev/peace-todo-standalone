import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Workout } from "../types";
import { usePreferences } from "../usePreferences";
import { formatNumber, kgToDisplay } from "../units";
import {
  BODY_PART_LABELS,
  displayName,
  exerciseSearchMatch,
  frequentExerciseNames,
  resolveBodyPart,
  type UserExercise,
} from "../exerciseLib";
import { buildWeightAt, type BodyWeightRecord } from "../stats";
import { exerciseLogs, prSeries, prBreakthroughs, currentPr } from "../pr";
import { TrendChart } from "../TrendChart";
import { FitEmptyState } from "../EmptyState";
import { Input } from "@/components/ui/input";
import { Search, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

// 与 FitStats 力量折线一致(品牌绿)
const PR_COLOR = "hsl(84 100% 59%)";

const shortDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

interface Props {
  workouts: Workout[];
  loading: boolean;
}

/** 动作纪录(PR):动作选择 + 当前 1RM + 突破历史 + 1RM 趋势 */
const FitPr = ({ workouts, loading }: Props) => {
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const [weightHistory, setWeightHistory] = useState<BodyWeightRecord[]>([]);
  const [exerciseDict, setExerciseDict] = useState<UserExercise[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("body_weight_history")
      .select("date, weight_kg")
      .eq("user_id", user.id)
      .then(({ data }) => setWeightHistory((data ?? []) as BodyWeightRecord[]))
      .catch(() => {});
    supabase
      .from("user_exercises")
      .select("name, body_part")
      .eq("user_id", user.id)
      .then(({ data }) => setExerciseDict((data ?? []) as UserExercise[]))
      .catch(() => {});
  }, [user]);

  // 全部历史动作名(搜索用,不受 frequent 截断限制)
  const allNames = useMemo(() => {
    const set = new Set<string>();
    workouts.forEach((w) => {
      if (w.type !== "strength") return;
      const d = w.data as { exercise?: string; exercises?: Array<{ name: string }> };
      if (Array.isArray(d.exercises)) d.exercises.forEach((e) => set.add(e.name));
      else if (d.exercise) set.add(d.exercise);
    });
    return [...set];
  }, [workouts]);

  // 候选:搜索词时按匹配过滤全部名字;否则按出现频率取前 30
  const candidates = useMemo(() => {
    const q = search.trim();
    return q ? allNames.filter((n) => exerciseSearchMatch(n, q)) : frequentExerciseNames(workouts, 30);
  }, [allNames, workouts, search]);

  const active = candidates.includes(selected ?? "") ? selected : candidates[0] ?? null;

  const pr = useMemo(() => {
    if (!active) return null;
    // 体重:历史阶梯优先(按训练日期取当天或之前最近一次),无记录时用偏好当前体重兜底
    const step = buildWeightAt(weightHistory);
    const fallback = prefs.body_weight_kg ?? null;
    const weightAt = (d: Date) => step(d) ?? fallback;
    const series = prSeries(exerciseLogs(workouts, active, weightAt));
    const breakthroughs = prBreakthroughs(series);
    return { series, breakthroughs, current: currentPr(breakthroughs) };
  }, [active, workouts, weightHistory, prefs.body_weight_kg]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-fit-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (workouts.length === 0) return <FitEmptyState />;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fit-muted pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索动作"
          className="pl-9"
        />
      </div>

      {candidates.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="动作选择">
          {candidates.map((n) => (
            <button
              key={n}
              onClick={() => setSelected(n)}
              role="tab"
              aria-selected={active === n}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-sm transition-smooth border",
                active === n
                  ? "bg-fit-accent text-fit-accent-foreground border-fit-accent"
                  : "bg-fit-card border-fit-border text-fit-muted",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-fit-muted px-1">没有匹配的动作</p>
      )}

      {active && pr ? (
        <>
          <div className="p-4 rounded-xl bg-fit-card border border-fit-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{displayName(active)}</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-fit-accent/10 text-fit-accent">
                {BODY_PART_LABELS[resolveBodyPart(active, exerciseDict)]}
              </span>
            </div>
            {pr.current ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tabular-nums text-fit-accent">
                    {formatNumber(kgToDisplay(pr.current.est1rm, prefs.weight_unit), 1)}
                  </span>
                  <span className="text-sm text-fit-muted">{prefs.weight_unit} · 预估 1RM</span>
                </div>
                <p className="text-xs text-fit-muted mt-1.5">
                  最佳组 {formatNumber(kgToDisplay(pr.current.weight_kg, prefs.weight_unit), 1)} {prefs.weight_unit} ×{" "}
                  {pr.current.reps} 次 · {shortDate(pr.current.date)}
                </p>
              </>
            ) : (
              <p className="text-sm text-fit-muted">暂无有效记录(自重组需在个人设置登记体重)</p>
            )}
          </div>

          {pr.series.length > 1 && (
            <div className="p-4 rounded-xl bg-fit-card border border-fit-border">
              <h4 className="text-xs font-semibold text-fit-muted uppercase tracking-wider mb-3">1RM 趋势</h4>
              <TrendChart
                series={[
                  {
                    key: "pr",
                    label: "1RM",
                    color: PR_COLOR,
                    values: pr.series.map((p) => kgToDisplay(p.est1rm, prefs.weight_unit)),
                  },
                ]}
                ariaLabel={`${displayName(active)} 1RM 趋势`}
                xLabels={pr.series.map((p) => shortDate(p.date))}
              />
            </div>
          )}

          {pr.breakthroughs.length > 0 && (
            <div className="p-4 rounded-xl bg-fit-card border border-fit-border">
              <h4 className="text-xs font-semibold text-fit-muted uppercase tracking-wider mb-3">突破历史</h4>
              <ul className="space-y-2">
                {[...pr.breakthroughs].reverse().map((p, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-fit-muted">
                      <Trophy className="w-3.5 h-3.5 text-fit-accent" />
                      {shortDate(p.date)}
                    </span>
                    <span className="tabular-nums font-medium">
                      {formatNumber(kgToDisplay(p.est1rm, prefs.weight_unit), 1)} {prefs.weight_unit}
                      <span className="text-fit-muted text-xs ml-1.5">
                        {formatNumber(kgToDisplay(p.weight_kg, prefs.weight_unit), 1)}×{p.reps}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default FitPr;
