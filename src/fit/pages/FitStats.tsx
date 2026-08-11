import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Workout, WorkoutType } from "../types";
import { usePreferences } from "../usePreferences";
import {
  formatDuration,
  formatNumber,
  metersToDisplay,
  kgToDisplay,
  workoutDistanceMeters,
  workoutVolumeKg,
  hasBodyweightGroups,
  exerciseAggs,
} from "../units";
import {
  BODY_PARTS,
  BODY_PART_LABELS,
  resolveBodyPart,
  type BodyPart,
  type UserExercise,
} from "../exerciseLib";
import {
  rangeWindow,
  shiftWindow,
  inWindowRange,
  sumWorkouts,
  pctChange,
  formatPct,
  bucketWindow,
  seriesByType,
  ymdDaysAgo,
  buildWeightAt,
  BodyWeightRecord,
} from "../stats";
import { todayYmd } from "../dates";
import { FitEmptyState } from "../EmptyState";
import { TrendChart } from "../TrendChart";
import { Footprints, Waves, Dumbbell, Target, TrendingUp, TrendingDown, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Range = "week" | "month" | "custom";

const RANGE_TABS: [Range, string][] = [
  ["week", "本周"],
  ["month", "近30天"],
  ["custom", "自定义"],
];

const TYPE_DEFS: { key: WorkoutType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "running", label: "跑步", icon: Footprints },
  { key: "swimming", label: "游泳", icon: Waves },
  { key: "strength", label: "力量", icon: Dumbbell },
  { key: "swimming_set", label: "专项组", icon: Target },
];

// 折线颜色:跑步=品牌绿,游泳=sky-400(区分度过 dataviz validator),力量=品牌绿(单线卡标题即身份)
const LINE_COLORS = {
  running: "hsl(84 100% 59%)",
  swimming: "hsl(199 93% 60%)",
  strength: "hsl(84 100% 59%)",
};

const FitStats = () => {
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [range, setRange] = useState<Range>("week");
  const [customStart, setCustomStart] = useState(() => ymdDaysAgo(6)); // 切到自定义档默认近 7 天
  const [customEnd, setCustomEnd] = useState(todayYmd);
  const [typeFilter, setTypeFilter] = useState<WorkoutType | null>(null);
  const [partFilter, setPartFilter] = useState<BodyPart | null>(null);
  const [loading, setLoading] = useState(true);
  const [weightHistory, setWeightHistory] = useState<BodyWeightRecord[]>([]);
  const [exerciseDict, setExerciseDict] = useState<UserExercise[]>([]);

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

  // 体重历史:阶梯查找,训练日期取"当天或之前最近一次"体重
  useEffect(() => {
    if (!user) return;
    supabase
      .from("body_weight_history")
      .select("date, weight_kg")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setWeightHistory((data ?? []) as BodyWeightRecord[]);
      })
      .catch(() => {});
  }, [user]);

  // 动作字典:部位归属(未登记动作由 PRESET_DEFS 兜底 → 全身)
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_exercises")
      .select("name, body_part")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setExerciseDict((data ?? []) as UserExercise[]);
      })
      .catch(() => {});
  }, [user]);

  const weightAt = useMemo(() => buildWeightAt(weightHistory), [weightHistory]);

  // 窗口:[start, endExclusive) 半开区间;自定义起>止或非法 → null
  const window = useMemo(() => rangeWindow(range, customStart, customEnd), [range, customStart, customEnd]);
  const invalidCustom = range === "custom" && window === null;

  const inWindow = useMemo(
    () => (window ? workouts.filter((w) => inWindowRange(w, window)) : []),
    [workouts, window],
  );

  // 上一等长区间(环比同口径:吃类型筛选)
  const prevWindow = useMemo(() => (window ? shiftWindow(window) : null), [window]);
  const prevSums = useMemo(
    () =>
      sumWorkouts(
        prevWindow
          ? workouts.filter((w) => inWindowRange(w, prevWindow) && (!typeFilter || w.type === typeFilter))
          : [],
      ),
    [workouts, prevWindow, typeFilter],
  );

  const rangeSums = useMemo(() => sumWorkouts(inWindow), [inWindow]); // 分布卡片:不吃类型筛选
  // 部位筛选:保留含所选部位的 strength 训练(训练级过滤,整条计入四卡/折线)
  const partVisible = useMemo(() => {
    if (!partFilter) return null;
    return inWindow.filter(
      (w) =>
        w.type === "strength" &&
        exerciseAggs(w, weightAt(new Date(w.date))).some((ex) => resolveBodyPart(ex.name, exerciseDict) === partFilter),
    );
  }, [inWindow, partFilter, exerciseDict, weightAt]);
  const visible = useMemo(() => {
    let v = typeFilter ? inWindow.filter((w) => w.type === typeFilter) : inWindow;
    if (partVisible) v = v.filter((w) => partVisible.includes(w));
    return v;
  }, [inWindow, typeFilter, partVisible]);
  const totals = useMemo(() => sumWorkouts(visible), [visible]); // 四卡 + 柱状图

  // 部位分布:窗口内力量训练的 组数/次数/重量 按部位聚合(不吃类型筛选,部位行自身可筛)
  const partTotals = useMemo(() => {
    const acc = new Map<BodyPart, { sets: number; reps: number; kg: number }>();
    BODY_PARTS.forEach((p) => acc.set(p, { sets: 0, reps: 0, kg: 0 }));
    inWindow.forEach((w) => {
      if (w.type !== "strength") return;
      exerciseAggs(w, weightAt(new Date(w.date))).forEach((ex) => {
        const t = acc.get(resolveBodyPart(ex.name, exerciseDict))!;
        t.sets += ex.setsCount;
        t.reps += ex.reps;
        t.kg += ex.kg;
      });
    });
    return acc;
  }, [inWindow, exerciseDict, weightAt]);
  const hasStrength = useMemo(() => inWindow.some((w) => w.type === "strength"), [inWindow]);
  const partGrandSets = useMemo(
    () => [...partTotals.values()].reduce((s, t) => s + t.sets, 0) || 1,
    [partTotals],
  );

  const deltas = useMemo(
    () => ({
      count: pctChange(totals.count, prevSums.count),
      seconds: pctChange(totals.seconds, prevSums.seconds),
      meters: pctChange(totals.meters, prevSums.meters),
      kcal: pctChange(totals.kcal, prevSums.kcal),
    }),
    [totals, prevSums],
  );
  const deltaLabel = range === "week" ? "vs 上周" : range === "month" ? "vs 上月" : "vs 上区间";

  const totalType =
    rangeSums.byType.running + rangeSums.byType.swimming + rangeSums.byType.strength + rangeSums.byType.swimming_set || 1;

  // 折线图:桶起点来自 window(自定义区间可能不以今天结束),超过 60 根自动聚合
  const buckets = useMemo(
    () => (window ? bucketWindow(window.start, window.endExclusive, 60) : []),
    [window],
  );

  // 距离卡:游泳线 = swimming + swimming_set(指标级合并;筛选专项组时游泳线即专项组距离)
  const distanceSeries = useMemo(() => {
    const perType = seriesByType(visible, buckets, workoutDistanceMeters);
    const s = [
      {
        key: "running",
        label: "跑步",
        color: LINE_COLORS.running,
        values: perType.running.map((v) => metersToDisplay(v, prefs.distance_unit)),
      },
      {
        key: "swimming",
        label: "游泳",
        color: LINE_COLORS.swimming,
        values: perType.swimming.map((v, i) => metersToDisplay(v + perType.swimming_set[i], prefs.distance_unit)),
      },
    ];
    return s.filter((x) => x.values.some((v) => v > 0)); // 滤空,单线时无图例
  }, [visible, buckets, prefs.distance_unit]);

  // 重量卡:力量线(显示单位跟随偏好,内部按 kg 累加;bodyweight 组按训练日期的体重注入)
  const weightSeries = useMemo(() => {
    const s = [
      {
        key: "strength",
        label: "力量",
        color: LINE_COLORS.strength,
        values: seriesByType(visible, buckets, (w) => workoutVolumeKg(w, weightAt(new Date(w.date)))).strength.map((v) =>
          kgToDisplay(v, prefs.weight_unit),
        ),
      },
    ];
    return s.filter((x) => x.values.some((v) => v > 0));
  }, [visible, buckets, weightAt, prefs.weight_unit]);

  // 窗口内自重训练的日期没有体重覆盖 → 重量卡提示条(阶梯语义:早于首次记录的训练无体重)
  const hasBodyweightMissing = useMemo(
    () => visible.some((w) => hasBodyweightGroups(w) && weightAt(new Date(w.date)) == null),
    [visible, weightAt],
  );

  const xLabels = useMemo(
    () => buckets.map((b, i) => (buckets.length <= 7 || i % 5 === 0 ? String(b.start.getDate()) : null)),
    [buckets],
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-1 p-1 bg-fit-card rounded-lg border border-fit-border" role="tablist" aria-label="统计范围">
        {RANGE_TABS.map(([r, label]) => (
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
            {label}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-fit-muted text-xs mb-2 block">起始</Label>
            <Input
              type="date"
              value={customStart}
              max={customEnd}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-fit-surface border-fit-border text-fit-foreground"
            />
          </div>
          <div>
            <Label className="text-fit-muted text-xs mb-2 block">结束</Label>
            <Input
              type="date"
              value={customEnd}
              min={customStart}
              max={todayYmd()}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-fit-surface border-fit-border text-fit-foreground"
            />
          </div>
        </div>
      )}
      {invalidCustom && <p className="text-xs text-destructive">开始日期需早于或等于结束日期</p>}

      {loading ? (
        <div className="h-40 rounded-xl bg-fit-card animate-pulse" />
      ) : invalidCustom ? (
        <FitEmptyState message="请调整起止日期" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="次数" value={totals.count.toString()} delta={deltas.count} deltaLabel={deltaLabel} />
            <Stat label="时长" value={formatDuration(totals.seconds)} delta={deltas.seconds} deltaLabel={deltaLabel} />
            <Stat
              label="距离"
              value={`${formatNumber(metersToDisplay(totals.meters, prefs.distance_unit))} ${prefs.distance_unit}`}
              delta={deltas.meters}
              deltaLabel={deltaLabel}
            />
          </div>
          <Stat label="预估消耗" value={`${totals.kcal} kcal`} large delta={deltas.kcal} deltaLabel={deltaLabel} />

          {inWindow.length > 0 && (
            <>
              <div className="p-4 rounded-xl bg-fit-card border border-fit-border">
                <h3 className="text-xs text-fit-muted uppercase tracking-wider mb-4">
                  每日训练距离 ({prefs.distance_unit})
                </h3>
                {distanceSeries.length > 0 ? (
                  <TrendChart series={distanceSeries} xLabels={xLabels} ariaLabel="每日训练距离趋势" />
                ) : (
                  <div className="h-40 flex items-center justify-center text-xs text-fit-muted">暂无距离数据</div>
                )}
              </div>
              <div className="p-4 rounded-xl bg-fit-card border border-fit-border">
                <h3 className="text-xs text-fit-muted uppercase tracking-wider mb-4">
                  每日训练重量 ({prefs.weight_unit})
                </h3>
                {hasBodyweightMissing && (
                  <Link
                    to="/fit/settings"
                    className="mb-3 flex items-center gap-1.5 rounded-md bg-fit-accent/10 border border-fit-accent/30 px-2.5 py-1.5 text-xs text-fit-accent hover:bg-fit-accent/15 transition-smooth"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    部分自重训练未计入总重量(缺少体重记录)
                  </Link>
                )}
                {weightSeries.length > 0 ? (
                  <TrendChart series={weightSeries} xLabels={xLabels} ariaLabel="每日训练总重量趋势" />
                ) : (
                  <div className="h-40 flex items-center justify-center text-xs text-fit-muted">暂无重量数据</div>
                )}
              </div>
            </>
          )}

          <div className="p-4 rounded-xl bg-fit-card border border-fit-border">
            <h3 className="text-xs text-fit-muted uppercase tracking-wider mb-4">运动类型分布</h3>
            <div className="space-y-2">
              {TYPE_DEFS.map((def) => (
                <TypeRow
                  key={def.key}
                  def={def}
                  count={rangeSums.byType[def.key]}
                  total={totalType}
                  active={typeFilter === def.key}
                  onToggle={() => setTypeFilter(typeFilter === def.key ? null : def.key)}
                />
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-fit-card border border-fit-border">
            <h3 className="text-xs text-fit-muted uppercase tracking-wider mb-4">部位分布</h3>
            {hasStrength ? (
              <div className="space-y-2">
                {BODY_PARTS.map((p) => {
                  const t = partTotals.get(p)!;
                  if (t.sets === 0 && t.reps === 0 && t.kg === 0 && partFilter !== p) return null; // 全 0 行隐藏(筛选中的除外)
                  return (
                    <PartRow
                      key={p}
                      part={p}
                      totals={t}
                      grandSets={partGrandSets}
                      active={partFilter === p}
                      onToggle={() => setPartFilter(partFilter === p ? null : p)}
                      weightUnit={prefs.weight_unit}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="h-20 flex items-center justify-center text-xs text-fit-muted">暂无力量训练数据</div>
            )}
          </div>

          {inWindow.length === 0 ? (
            <FitEmptyState message="此时段还没有数据" />
          ) : visible.length === 0 ? (
            <FitEmptyState message="该类型此时段暂无数据" />
          ) : null}
        </>
      )}
    </div>
  );
};

const Stat = ({
  label,
  value,
  large,
  delta,
  deltaLabel,
}: {
  label: string;
  value: string;
  large?: boolean;
  delta?: number | null;
  deltaLabel?: string;
}) => (
  <div className={cn("p-3 rounded-xl bg-fit-card border border-fit-border", large && "col-span-3")}>
    <div className="text-[10px] text-fit-muted uppercase tracking-wider">{label}</div>
    <div className={cn("font-bold text-fit-foreground tabular-nums mt-1", large ? "text-2xl text-fit-accent" : "text-base")}>
      {value}
    </div>
    {delta !== undefined && (
      <div
        className={cn(
          "mt-0.5 text-[10px] flex items-center gap-0.5 tabular-nums",
          delta === null || delta === 0 ? "text-fit-muted" : delta > 0 ? "text-green-500" : "text-red-500",
        )}
      >
        {delta === null ? (
          "—"
        ) : (
          <>
            {delta > 0 && <TrendingUp className="w-3 h-3" />}
            {delta < 0 && <TrendingDown className="w-3 h-3" />}
            {formatPct(delta)} {deltaLabel}
          </>
        )}
      </div>
    )}
  </div>
);

const PartRow = ({
  part,
  totals,
  grandSets,
  active,
  onToggle,
  weightUnit,
}: {
  part: BodyPart;
  totals: { sets: number; reps: number; kg: number };
  grandSets: number;
  active: boolean;
  onToggle: () => void;
  weightUnit: string;
}) => {
  const pct = (totals.sets / grandSets) * 100;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={`筛选${BODY_PART_LABELS[part]}`}
      className={cn(
        "w-full flex items-center gap-3 rounded-lg border px-3 py-2 transition-smooth",
        active ? "bg-fit-accent/10 border-fit-accent/40" : "border-transparent hover:bg-fit-surface",
      )}
    >
      <span className="text-sm text-fit-foreground w-14 text-left">{BODY_PART_LABELS[part]}</span>
      <div className="flex-1 h-2 rounded-full bg-fit-surface overflow-hidden">
        <div className="h-full bg-fit-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-fit-muted tabular-nums text-right shrink-0">
        {totals.sets} 组 · {totals.reps} 次 · {formatNumber(kgToDisplay(totals.kg, weightUnit), 0)} {weightUnit}
      </span>
      {active && <Check className="w-3.5 h-3.5 text-fit-accent" />}
    </button>
  );
};

const TypeRow = ({
  def,
  count,
  total,
  active,
  onToggle,
}: {
  def: (typeof TYPE_DEFS)[number];
  count: number;
  total: number;
  active: boolean;
  onToggle: () => void;
}) => {
  const Icon = def.icon;
  const pct = (count / total) * 100;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={`筛选${def.label}`}
      className={cn(
        "w-full flex items-center gap-3 rounded-lg border px-3 py-2 transition-smooth",
        active ? "bg-fit-accent/10 border-fit-accent/40" : "border-transparent hover:bg-fit-surface",
      )}
    >
      <Icon className={cn("w-4 h-4", active ? "text-fit-accent" : "text-fit-muted")} />
      <span className="text-sm text-fit-foreground w-12 text-left">{def.label}</span>
      <div className="flex-1 h-2 rounded-full bg-fit-surface overflow-hidden">
        <div className="h-full bg-fit-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-fit-muted tabular-nums w-12 text-right">{count} 次</span>
      {active && <Check className="w-3.5 h-3.5 text-fit-accent" />}
    </button>
  );
};

export default FitStats;
