import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Plus, Search, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "./usePreferences";
import { formatNumber, kgToDisplay, weightInputToKg } from "./units";
import {
  BODY_PARTS,
  BODY_PART_LABELS,
  PRESET_DEFS,
  displayName,
  exerciseDefaults,
  exerciseSearchMatch,
  frequentExerciseNames,
  normalizeExerciseName,
  resolveBodyPart,
  type BodyPart,
  type UserExercise,
} from "./exerciseLib";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { currentTimeHm, todayYmd } from "./dates";
import type { StrengthData, WeightUnit, Workout } from "./types";

export type StrengthFormMode = "create" | "edit" | "copy";

interface StrengthFormProps {
  mode: StrengthFormMode;
  /** edit/copy 模式必传,页面 fetch 完成后才挂载表单 */
  initialWorkout?: Workout;
  onSaved: () => void;
}

type SessionSet = {
  weight: string;
  reps: string;
  bodyweight: boolean;
  done: boolean;
  weight_unit?: WeightUnit;
};

type SessionExercise = {
  id: string;
  name: string;
  done: boolean;
  body_part: BodyPart;
  sets: SessionSet[];
};

// randomUUID 仅在安全上下文(https/localhost)可用,局域网 http 访问会缺失,给个回退
const createId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// 本地日期/时间(不用 toISOString,避免 UTC 与本地混用导致跨日错位)
const localYmd = (iso: string) => {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

const localHm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** 存储的 StrengthData → 编辑用 SessionExercise[];legacy 单动作格式包成单动作回退 */
function workoutToExercises(workout: Workout | undefined, defaultUnit: WeightUnit): SessionExercise[] {
  if (!workout) return [];
  const data = workout.data as StrengthData;

  if (data.session === true && Array.isArray(data.exercises) && data.exercises.length > 0) {
    return data.exercises.map((ex, idx) => {
      const unit = ex.input_unit || defaultUnit;
      return {
        id: `exercise-${idx}-${Date.now()}`,
        name: ex.name,
        done: ex.done || false,
        // 优先恢复保存时选定的部位;老记录无该字段才重新解析兜底
        body_part: ex.body_part ?? resolveBodyPart(ex.name, []),
        sets: (ex.sets || []).map((set) => ({
          weight: set.bodyweight ? "" : formatNumber(kgToDisplay(set.weight_kg, unit), 2),
          reps: String(set.reps),
          bodyweight: set.bodyweight || false,
          done: set.done || false,
          weight_unit: unit,
        })),
      };
    });
  }

  // 旧数据或非标准数据:转换为单个动作的会话模式以便编辑
  const unit = data.input_unit || defaultUnit;
  return [
    {
      id: `exercise-legacy-${Date.now()}`,
      name: data.exercise || "未知动作",
      done: false,
      body_part: resolveBodyPart(data.exercise || "", []),
      sets: [
        {
          weight: data.bodyweight ? "" : formatNumber(kgToDisplay(data.weight_kg || 0, unit), 2),
          reps: String(data.reps || 0),
          bodyweight: data.bodyweight || false,
          done: false,
          weight_unit: unit,
        },
      ],
    },
  ];
}

export const StrengthForm = ({ mode, initialWorkout, onSaved }: StrengthFormProps) => {
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const [workoutDate, setWorkoutDate] = useState(() =>
    mode === "edit" && initialWorkout ? localYmd(initialWorkout.date) : todayYmd(),
  );
  const [workoutTime, setWorkoutTime] = useState(() =>
    mode === "edit" && initialWorkout ? localHm(initialWorkout.date) : currentTimeHm(),
  );
  // 训练时长(分钟,字符串态):create 默认空;edit 只读显示;copy 预填原值可改
  const [durationMin, setDurationMin] = useState(() => {
    if (!initialWorkout) return "";
    const seconds = (initialWorkout.data as StrengthData).duration_seconds;
    return seconds ? String(seconds / 60) : "";
  });
  const [notes, setNotes] = useState(() => initialWorkout?.notes ?? "");
  const [customExercise, setCustomExercise] = useState("");
  const [exercises, setExercises] = useState<SessionExercise[]>(() =>
    initialWorkout ? workoutToExercises(initialWorkout, prefs.weight_unit) : [],
  );
  const [saving, setSaving] = useState(false);
  // 动作字典与历史常用动作(表单加载时拉取,失败静默:预设兜底)
  const [dict, setDict] = useState<UserExercise[]>([]);
  const [frequent, setFrequent] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from("user_exercises")
        .select("name, body_part, bodyweight_default, default_reps")
        .eq("user_id", user.id),
      supabase
        .from("workouts")
        .select("type, data")
        .eq("user_id", user.id)
        .eq("type", "strength")
        .order("date", { ascending: false })
        .limit(30),
    ])
      .then(([exRes, wRes]) => {
        setDict((exRes.data ?? []) as UserExercise[]);
        setFrequent(frequentExerciseNames((wRes.data ?? []) as Workout[], 8));
      })
      .catch(() => {});
  }, [user]);

  const totalSets = exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const editing = mode === "edit";

  // 常用 Top 8:历史频率优先,不足用预设补足
  const quickNames = useMemo(() => {
    const names = [...frequent];
    for (const p of PRESET_DEFS) {
      if (names.length >= 8) break;
      if (!names.includes(p.name)) names.push(p.name);
    }
    return names;
  }, [frequent]);

  // 全部动作(下拉菜单):字典 + 预设去重,常用在前,其余按中文排序
  const allExerciseDefs = useMemo(() => {
    const map = new Map<string, UserExercise>();
    dict.forEach((e) => map.set(e.name, e));
    PRESET_DEFS.forEach((p) => {
      if (!map.has(p.name)) {
        map.set(p.name, {
          name: p.name,
          body_part: p.body_part,
          bodyweight_default: p.bodyweight,
          default_reps: p.default_reps,
        });
      }
    });
    const freqIndex = new Map(frequent.map((n, i) => [n, i]));
    return [...map.values()].sort(
      (a, b) => (freqIndex.get(a.name) ?? 99) - (freqIndex.get(b.name) ?? 99) || a.name.localeCompare(b.name, "zh"),
    );
  }, [dict, frequent]);

  const menuFiltered = useMemo(() => {
    const q = menuSearch.trim();
    if (!q) return allExerciseDefs;
    return allExerciseDefs.filter((e) => exerciseSearchMatch(e.name, q));
  }, [allExerciseDefs, menuSearch]);

  const addExercise = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const normalized = normalizeExerciseName(trimmed);
    if (normalized !== trimmed) toast.info(`已识别「${trimmed}」→「${normalized}」`);
    const defs = exerciseDefaults(normalized, dict);
    setExercises((prev) => [
      ...prev,
      {
        id: createId(),
        name: normalized,
        done: false,
        body_part: resolveBodyPart(normalized, dict),
        sets: [
          {
            weight: "",
            reps: defs.default_reps ? String(defs.default_reps) : "10",
            bodyweight: defs.bodyweight,
            done: false,
            weight_unit: prefs.weight_unit,
          },
        ],
      },
    ]);
    setCustomExercise("");
    setMenuSearch("");
  };

  const removeExercise = (id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  };

  const patchExercise = (id: string, updater: (exercise: SessionExercise) => SessionExercise) => {
    setExercises((prev) => prev.map((e) => (e.id === id ? updater(e) : e)));
  };

  const patchSet = (exerciseId: string, setIdx: number, updater: (set: SessionSet) => SessionSet) => {
    patchExercise(exerciseId, (e0) => {
      const sets = [...e0.sets];
      sets[setIdx] = updater(sets[setIdx]);
      return { ...e0, sets };
    });
  };

  const addSet = (exerciseId: string) => {
    patchExercise(exerciseId, (exercise) => {
      const last = exercise.sets[exercise.sets.length - 1];
      return {
        ...exercise,
        sets: [
          ...exercise.sets,
          {
            weight: last?.weight ?? "",
            reps: last?.reps ?? "",
            bodyweight: last?.bodyweight ?? false,
            done: false,
            weight_unit: last?.weight_unit ?? prefs.weight_unit,
          },
        ],
      };
    });
  };

  const removeSet = (exerciseId: string, setIdx: number) => {
    patchExercise(exerciseId, (e0) => ({ ...e0, sets: e0.sets.filter((_, i) => i !== setIdx) }));
  };

  const setUnit = (exerciseId: string, unit: WeightUnit) => {
    // 更新该动作下所有组的单位,保持一致性(不换算数值,与现状一致)
    patchExercise(exerciseId, (e0) => ({
      ...e0,
      sets: e0.sets.map((s) => ({ ...s, weight_unit: unit })),
    }));
  };

  const handleFinish = async () => {
    if (!user) return;
    if (exercises.length === 0) {
      toast.error("请先添加至少一个动作");
      return;
    }

    let normalized: Array<{
      name: string;
      done: boolean;
      body_part: BodyPart;
      input_unit?: WeightUnit;
      sets: Array<{ weight_kg: number; reps: number; bodyweight: boolean; done: boolean }>;
    }>;
    let durationSeconds: number | undefined;
    try {
      normalized = exercises.map((exercise) => {
        if (!exercise.name.trim()) throw new Error("动作名称不能为空");
        if (exercise.sets.length === 0) throw new Error(`动作 ${exercise.name} 至少需要一组`);

        // 确定该动作的单位(使用第一个组的单位)
        const actionUnit = exercise.sets[0]?.weight_unit || prefs.weight_unit;

        const sets = exercise.sets.map((set) => {
          const reps = parseInt(set.reps);
          if (!reps || reps < 1) throw new Error(`动作 ${exercise.name} 组次数必须大于 0`);

          const rawWeight = set.bodyweight ? 0 : parseFloat(set.weight);
          if (Number.isNaN(rawWeight) || rawWeight < 0) {
            throw new Error(`动作 ${exercise.name} 重量无效`);
          }

          return {
            weight_kg: weightInputToKg(rawWeight, set.weight_unit || prefs.weight_unit),
            reps,
            bodyweight: set.bodyweight,
            done: set.done,
          };
        });

        return {
          name: normalizeExerciseName(exercise.name.trim()),
          done: exercise.done,
          body_part: exercise.body_part,
          input_unit: actionUnit,
          sets,
        };
      });

      // 时长必填(创建/复制);编辑模式只读,原记录无时长时允许保持「未记录」
      const dMin = durationMin.trim();
      if (dMin === "") {
        if (!editing) throw new Error("请填写训练时长");
      } else {
        const n = parseFloat(dMin);
        if (Number.isNaN(n) || n < 0) throw new Error("训练时长无效");
        durationSeconds = Math.round(n * 60);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "训练数据无效");
      return;
    }

    const totalReps = normalized.reduce(
      (sum, exercise) => sum + exercise.sets.reduce((acc, set) => acc + set.reps, 0),
      0,
    );
    const totalSetCount = normalized.reduce((sum, exercise) => sum + exercise.sets.length, 0);
    const date = new Date(`${workoutDate}T${workoutTime}:00`);
    if (Number.isNaN(date.getTime())) {
      toast.error("请选择有效日期和时间");
      return;
    }

    const payload = {
      data: {
        session: true,
        exercise: normalized.length === 1 ? normalized[0].name : "综合力量训练",
        weight_kg: 0,
        sets: totalSetCount,
        reps: Math.max(1, Math.round(totalReps / Math.max(1, totalSetCount))),
        ...(durationSeconds !== undefined ? { duration_seconds: durationSeconds } : {}),
        exercises: normalized,
      },
      notes: notes.trim() || null,
      date: date.toISOString(),
    };

    setSaving(true);
    const { error } =
      editing && initialWorkout
        ? await supabase.from("workouts").update(payload).eq("id", initialWorkout.id)
        : await supabase.from("workouts").insert({ user_id: user.id, type: "strength", ...payload });
    setSaving(false);

    if (error) {
      toast.error("保存训练失败");
      return;
    }

    // 登记动作字典(非关键操作,不阻塞保存成功反馈;失败静默,统计有 PRESET_DEFS 兜底)
    const dictRows = normalized.map((ex) => ({
      user_id: user.id,
      name: ex.name,
      body_part: ex.body_part,
      bodyweight_default: ex.sets[0]?.bodyweight ?? false,
      default_reps: ex.sets[0]?.reps ?? null,
    }));
    supabase
      .from("user_exercises")
      .upsert(dictRows, { onConflict: "user_id,name" })
      .then(({ error }) => {
        if (error) console.warn("user_exercises upsert failed:", error);
      })
      .catch(() => {});

    toast.success(editing ? "记录已更新" : "本次训练已完成");
    onSaved();
  };

  return (
    <div className="space-y-4 pb-28">
      <div className="p-4 rounded-xl bg-fit-card border border-fit-border space-y-3">
        <h2 className="text-sm font-semibold text-fit-foreground">本次训练记录</h2>
        {editing ? (
          <>
            <div>
              <Label className="text-fit-muted text-xs mb-2 block">日期</Label>
              <div className="text-sm text-fit-foreground">{workoutDate}</div>
            </div>
            <div>
              <Label className="text-fit-muted text-xs mb-2 block">时间</Label>
              <div className="text-sm text-fit-foreground">{workoutTime}</div>
            </div>
            <div>
              <Label className="text-fit-muted text-xs mb-2 block">训练时长</Label>
              <div className="text-sm text-fit-foreground">{durationMin ? `${durationMin} 分钟` : "未记录"}</div>
            </div>
          </>
        ) : (
          <>
            <div>
              <Label className="text-fit-muted text-xs mb-2 block">日期</Label>
              <Input
                type="date"
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                max={todayYmd()}
                className="bg-fit-surface border-fit-border text-fit-foreground"
              />
            </div>
            <div>
              <Label className="text-fit-muted text-xs mb-2 block">时间</Label>
              <Input
                type="time"
                value={workoutTime}
                onChange={(e) => setWorkoutTime(e.target.value)}
                className="bg-fit-surface border-fit-border text-fit-foreground"
              />
            </div>
            <div>
              <Label className="text-fit-muted text-xs mb-2 block">训练时长(分钟)</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={durationMin}
                placeholder="如 45"
                onChange={(e) => setDurationMin(e.target.value)}
                className="bg-fit-surface border-fit-border text-fit-foreground"
              />
            </div>
          </>
        )}
      </div>

      <div className="p-4 rounded-xl bg-fit-card border border-fit-border space-y-3">
        <Label className="text-fit-muted text-xs block">最近常做</Label>
        <div className="flex flex-wrap gap-2">
          {quickNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => addExercise(name)}
              className="px-3 py-1.5 rounded-md bg-fit-surface border border-fit-border text-xs font-semibold text-fit-muted hover:text-fit-foreground transition-smooth"
            >
              {displayName(name)}
            </button>
          ))}
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="px-3 py-1.5 rounded-md bg-fit-surface border border-fit-border text-xs font-semibold text-fit-muted hover:text-fit-foreground transition-smooth flex items-center gap-1"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                更多动作
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2 bg-fit-card border-fit-border text-fit-foreground" align="start">
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-fit-muted" />
                <Input
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="搜索动作"
                  className="bg-fit-surface border-fit-border text-fit-foreground pl-8 h-9"
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-0.5">
                {menuFiltered.length === 0 && <p className="text-xs text-fit-muted px-2 py-1">无匹配动作</p>}
                {menuFiltered.map((def) => (
                  <button
                    key={def.name}
                    type="button"
                    onClick={() => {
                      addExercise(def.name);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm text-fit-foreground hover:bg-fit-surface transition-smooth"
                  >
                    <span className="flex-1 truncate">{displayName(def.name)}</span>
                    {def.bodyweight_default && <span className="text-[10px] font-bold text-fit-accent shrink-0">BW</span>}
                    <span className="text-[10px] text-fit-muted shrink-0">{BODY_PART_LABELS[def.body_part]}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex gap-2">
          <Input
            value={customExercise}
            onChange={(e) => setCustomExercise(e.target.value)}
            placeholder="自定义动作名称"
            className="bg-fit-surface border-fit-border text-fit-foreground"
          />
          <Button
            type="button"
            onClick={() => addExercise(customExercise)}
            className="bg-fit-accent text-fit-accent-foreground hover:bg-fit-accent/90"
          >
            <Plus className="w-4 h-4 mr-1" />
            添加动作
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {exercises.map((exercise) => (
          <section key={exercise.id} className="p-4 rounded-xl bg-fit-card border border-fit-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => patchExercise(exercise.id, (e) => ({ ...e, done: !e.done }))}
                  aria-label={`标记动作 ${exercise.name} 完成`}
                  className={cn(
                    "w-6 h-6 rounded-md border flex items-center justify-center transition-smooth shrink-0",
                    exercise.done
                      ? "bg-fit-accent border-fit-accent text-fit-accent-foreground"
                      : "bg-fit-surface border-fit-border text-fit-muted",
                  )}
                >
                  <Check className="w-4 h-4" />
                </button>
                <Input
                  value={exercise.name}
                  onChange={(e) => patchExercise(exercise.id, (ex) => ({ ...ex, name: e.target.value }))}
                  aria-label="动作名称"
                  className="bg-transparent border-fit-border text-fit-foreground font-semibold h-9 px-2"
                />
                <div className="flex rounded-md border border-fit-border overflow-hidden shrink-0">
                  {(["kg", "lb"] as WeightUnit[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(exercise.id, u)}
                      className={cn(
                        "px-2 py-1.5 text-xs font-semibold transition-smooth",
                        (exercise.sets[0]?.weight_unit || prefs.weight_unit) === u
                          ? "bg-fit-accent text-fit-accent-foreground"
                          : "bg-fit-surface text-fit-muted hover:text-fit-foreground",
                        u === "lb" && "border-l border-fit-border",
                      )}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeExercise(exercise.id)}
                className="p-1.5 rounded-md text-fit-muted hover:text-destructive transition-smooth shrink-0"
                aria-label="删除动作"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {displayName(exercise.name) !== exercise.name && (
              <p className="text-[11px] text-fit-muted">{displayName(exercise.name)}</p>
            )}

            <div className="flex items-center gap-2">
              <select
                value={exercise.body_part}
                onChange={(e) => patchExercise(exercise.id, (ex) => ({ ...ex, body_part: e.target.value as BodyPart }))}
                aria-label="锻炼部位"
                className="bg-fit-surface border border-fit-border text-fit-foreground text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-fit-accent"
              >
                {BODY_PARTS.map((p) => (
                  <option key={p} value={p}>
                    {BODY_PART_LABELS[p]}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-fit-muted">部位(统计用)</span>
            </div>

            <div className="space-y-2">
              {exercise.sets.map((set, i) => (
                <div
                  key={`${exercise.id}-${i}`}
                  className="grid grid-cols-2 gap-x-2 gap-y-1.5 items-center sm:grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-2"
                >
                  <span className="col-start-1 row-start-1 sm:col-start-1 sm:row-start-1 text-xs text-fit-muted">
                    第 {i + 1} 组
                  </span>
                  <div className="col-start-1 row-start-2 sm:col-start-2 sm:row-start-1 flex items-center gap-1 min-w-0">
                    <Input
                      value={set.bodyweight ? "BW" : set.weight}
                      onChange={(e) => patchSet(exercise.id, i, (s) => ({ ...s, weight: e.target.value }))}
                      disabled={set.bodyweight}
                      placeholder="重量"
                      className="bg-fit-surface border-fit-border text-fit-foreground text-center w-full min-w-0 h-10"
                    />
                    {/* 单位后缀提示:一眼看出左框是重量 */}
                    {!set.bodyweight && (
                      <span className="text-xs text-fit-muted shrink-0">{set.weight_unit || prefs.weight_unit}</span>
                    )}
                  </div>
                  <div className="col-start-2 row-start-2 sm:col-start-3 sm:row-start-1 flex items-center gap-1 min-w-0">
                    <Input
                      value={set.reps}
                      onChange={(e) => patchSet(exercise.id, i, (s) => ({ ...s, reps: e.target.value }))}
                      inputMode="numeric"
                      placeholder="次数"
                      className="bg-fit-surface border-fit-border text-fit-foreground text-center w-full min-w-0 h-10"
                    />
                    <span className="text-xs text-fit-muted shrink-0">次</span>
                  </div>
                  <div className="col-start-2 row-start-1 sm:col-start-4 sm:row-start-1 flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        patchSet(exercise.id, i, (s) => ({
                          ...s,
                          bodyweight: !s.bodyweight,
                          weight: "0",
                        }))
                      }
                      className={cn(
                        "h-10 px-2 rounded-md border text-xs font-semibold transition-smooth",
                        set.bodyweight
                          ? "bg-fit-accent border-fit-accent text-fit-accent-foreground"
                          : "bg-fit-surface border-fit-border text-fit-muted hover:text-fit-foreground",
                      )}
                    >
                      BW
                    </button>
                    <button
                      type="button"
                      onClick={() => patchSet(exercise.id, i, (s) => ({ ...s, done: !s.done }))}
                      aria-label={`标记第 ${i + 1} 组完成`}
                      className={cn(
                        "h-10 w-9 rounded-md border flex items-center justify-center transition-smooth",
                        set.done
                          ? "bg-fit-accent border-fit-accent text-fit-accent-foreground"
                          : "bg-fit-surface border-fit-border text-fit-muted",
                      )}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSet(exercise.id, i)}
                      aria-label="删除该组"
                      className="h-10 w-9 rounded-md flex items-center justify-center text-fit-muted hover:text-destructive transition-smooth"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => addSet(exercise.id)}
              className="flex-1 bg-fit-surface border-fit-border text-fit-foreground hover:bg-fit-surface/80"
            >
              <Plus className="w-4 h-4 mr-1" />
              添加一组
            </Button>
          </section>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-fit-card border border-fit-border space-y-3">
        <Label className="text-fit-muted text-xs block">备注 (可选)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="bg-fit-surface border-fit-border text-fit-foreground resize-none"
        />
      </div>

      <div className="fixed bottom-5 left-0 right-0 px-4 z-20">
        <div className="max-w-2xl mx-auto">
          <Button
            onClick={handleFinish}
            disabled={saving}
            className="w-full h-12 text-base font-semibold bg-fit-accent text-fit-accent-foreground hover:bg-fit-accent/90 shadow-fit-glow"
          >
            {saving
              ? "保存中..."
              : editing
                ? `更新记录 (${exercises.length} 动作 / ${totalSets} 组)`
                : `完成训练 (${exercises.length} 动作 / ${totalSets} 组)`}
          </Button>
        </div>
      </div>
    </div>
  );
};
