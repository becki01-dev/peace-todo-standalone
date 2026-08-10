import { useEffect, useMemo, useState } from "react";
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
} from "../units";
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
} from "../stats";
import { todayYmd } from "../dates";
import { FitEmptyState } from "../EmptyState";
import { TrendChart } from "../TrendChart";
import { Footprints, Waves, Dumbbell, Target, TrendingUp, TrendingDown, Check } from "lucide-react";
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
  const visible = useMemo(
    () => (typeFilter ? inWindow.filter((w) => w.type === typeFilter) : inWindow),
    [inWindow, typeFilter],
  );
  const totals = useMemo(() => sumWorkouts(visible), [visible]); // 四卡 + 柱状图

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

  // 重量卡:力量线(显示单位跟随偏好,内部按 kg 累加)
  const weightSeries = useMemo(() => {
    const s = [
      {
        key: "strength",
        label: "力量",
        color: LINE_COLORS.strength,
        values: seriesByType(visible, buckets, workoutVolumeKg).strength.map((v) => kgToDisplay(v, prefs.weight_unit)),
      },
    ];
    return s.filter((x) => x.values.some((v) => v > 0));
  }, [visible, buckets, prefs.weight_unit]);

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
