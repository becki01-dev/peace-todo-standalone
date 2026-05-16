import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "../usePreferences";
import { weightInputToKg } from "../units";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SessionSet = {
  weight: string;
  reps: string;
  bodyweight: boolean;
  done: boolean;
  weight_unit?: "kg" | "lb";
};

type SessionExercise = {
  id: string;
  name: string;
  done: boolean;
  sets: SessionSet[];
};

const PRESET_EXERCISES = [
  "深蹲",
  "硬拉",
  "卧推",
  "引体向上",
  "俯卧撑",
  "肩推",
  "划船",
  "弓步",
];

const FitStrengthSession = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const { onWorkoutSaved } = useOutletContext<{ onWorkoutSaved: () => void }>();
  const [workoutDate, setWorkoutDate] = useState(todayYmd());
  const [workoutTime, setWorkoutTime] = useState(currentTimeHm());  // 修改：使用当前时间而不是固定的 12:00
  const [notes, setNotes] = useState("");
  const [customExercise, setCustomExercise] = useState("");
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [saving, setSaving] = useState(false);

  const totalSets = useMemo(
    () => exercises.reduce((sum, e) => sum + e.sets.length, 0),
    [exercises],
  );

  const addExercise = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setExercises((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: trimmed,
        done: false,
        sets: [{ weight: "", reps: "10", bodyweight: false, done: false, weight_unit: prefs.weight_unit }],
      },
    ]);
    setCustomExercise("");
  };

  const removeExercise = (id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  };

  const patchExercise = (id: string, updater: (exercise: SessionExercise) => SessionExercise) => {
    setExercises((prev) => prev.map((e) => (e.id === id ? updater(e) : e)));
  };

  const addSetCopy = (exerciseId: string) => {
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

  const copyLastSet = (exerciseId: string) => {
    patchExercise(exerciseId, (exercise) => {
      if (exercise.sets.length < 2) return exercise;
      const source = exercise.sets[exercise.sets.length - 2];
      const next = [...exercise.sets];
      next[next.length - 1] = {
        ...next[next.length - 1],
        weight: source.weight,
        reps: source.reps,
        bodyweight: source.bodyweight,
        weight_unit: source.weight_unit,
      };
      return { ...exercise, sets: next };
    });
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
      input_unit?: WeightUnit; // 添加 input_unit 字段
      sets: Array<{ weight_kg: number; reps: number; bodyweight: boolean; done: boolean }>;
    }>;
    try {
      normalized = exercises.map((exercise) => {
        if (!exercise.name.trim()) throw new Error("动作名称不能为空");
        if (exercise.sets.length === 0) throw new Error(`动作 ${exercise.name} 至少需要一组`);

        // 确定该动作的单位（使用第一个组的单位）
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
          name: exercise.name.trim(),
          done: exercise.done,
          input_unit: actionUnit, // 保存动作的输入单位
          sets,
        };
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "训练数据无效");
      return;
    }

    const totalReps = normalized.reduce(
      (sum, exercise) => sum + exercise.sets.reduce((acc, set) => acc + set.reps, 0),
      0,
    );
    const date = new Date(`${workoutDate}T${workoutTime}:00`);  // 修改：使用用户选择的时间
    if (Number.isNaN(date.getTime())) {
      toast.error("请选择有效日期和时间");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("workouts").insert({
      user_id: user.id,
      type: "strength",
      notes: notes.trim() || null,
      date: date.toISOString(),
      data: {
        session: true,
        exercise: normalized.length === 1 ? normalized[0].name : "综合力量训练",
        weight_kg: 0,
        sets: totalSets,
        reps: Math.max(1, Math.round(totalReps / Math.max(1, totalSets))),
        exercises: normalized,
      },
    });
    setSaving(false);

    if (error) {
      toast.error("保存训练失败");
      return;
    }

    toast.success("本次训练已完成");
    onWorkoutSaved();
    navigate("/fit");
  };

  return (
    <div className="space-y-4 pb-28">
      <div className="p-4 rounded-xl bg-fit-card border border-fit-border space-y-3">
        <h2 className="text-sm font-semibold text-fit-foreground">本次训练记录</h2>
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
      </div>

      <div className="p-4 rounded-xl bg-fit-card border border-fit-border space-y-3">
        <Label className="text-fit-muted text-xs block">添加动作</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_EXERCISES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => addExercise(name)}
              className="px-3 py-1.5 rounded-md bg-fit-surface border border-fit-border text-xs font-semibold text-fit-muted hover:text-fit-foreground transition-smooth"
            >
              {name}
            </button>
          ))}
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => patchExercise(exercise.id, (e) => ({ ...e, done: !e.done }))}
                  className={cn(
                    "w-6 h-6 rounded-md border flex items-center justify-center transition-smooth",
                    exercise.done
                      ? "bg-fit-accent border-fit-accent text-fit-accent-foreground"
                      : "bg-fit-surface border-fit-border text-fit-muted",
                  )}
                >
                  <Check className="w-4 h-4" />
                </button>
                <h3 className="font-semibold text-fit-foreground">{exercise.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => removeExercise(exercise.id)}
                className="p-1.5 rounded-md text-fit-muted hover:text-destructive transition-smooth"
                aria-label="删除动作"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {exercise.sets.map((set, i) => (
                <div key={`${exercise.id}-${i}`} className="grid grid-cols-[72px_1fr_auto_1fr_56px] gap-2 items-center">
                  <span className="text-xs text-fit-muted">第 {i + 1} 组</span>
                  <div className="flex gap-1">
                    <Input
                      value={set.bodyweight ? "BW" : set.weight}
                      onChange={(e) =>
                        patchExercise(exercise.id, (e0) => {
                          const sets = [...e0.sets];
                          sets[i] = { ...sets[i], weight: e.target.value };
                          return { ...e0, sets };
                        })
                      }
                      disabled={set.bodyweight}
                      placeholder="重量"
                      className="bg-fit-surface border-fit-border text-fit-foreground text-center flex-1"
                    />
                    {!set.bodyweight && (
                      <div className="flex rounded-md border border-fit-border overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            patchExercise(exercise.id, (e0) => {
                              // 更新该动作下所有组的单位，保持一致性
                              const sets = e0.sets.map(s => ({ ...s, weight_unit: "kg" as const }));
                              return { ...e0, sets };
                            })
                          }
                          className={cn(
                            "px-2 py-1.5 text-xs font-semibold transition-smooth",
                            (set.weight_unit || prefs.weight_unit) === "kg"
                              ? "bg-fit-accent text-fit-accent-foreground"
                              : "bg-fit-surface text-fit-muted hover:text-fit-foreground",
                          )}
                        >
                          kg
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            patchExercise(exercise.id, (e0) => {
                              // 更新该动作下所有组的单位，保持一致性
                              const sets = e0.sets.map(s => ({ ...s, weight_unit: "lb" as const }));
                              return { ...e0, sets };
                            })
                          }
                          className={cn(
                            "px-2 py-1.5 text-xs font-semibold transition-smooth border-l border-fit-border",
                            (set.weight_unit || prefs.weight_unit) === "lb"
                              ? "bg-fit-accent text-fit-accent-foreground"
                              : "bg-fit-surface text-fit-muted hover:text-fit-foreground",
                          )}
                        >
                          lb
                        </button>
                      </div>
                    )}
                  </div>
                  <Input
                    value={set.reps}
                    onChange={(e) =>
                      patchExercise(exercise.id, (e0) => {
                        const sets = [...e0.sets];
                        sets[i] = { ...sets[i], reps: e.target.value };
                        return { ...e0, sets };
                      })
                    }
                    inputMode="numeric"
                    placeholder="次数"
                    className="bg-fit-surface border-fit-border text-fit-foreground text-center"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patchExercise(exercise.id, (e0) => {
                        const sets = [...e0.sets];
                        sets[i] = { ...sets[i], done: !sets[i].done };
                        return { ...e0, sets };
                      })
                    }
                    className={cn(
                      "h-10 rounded-md border flex items-center justify-center transition-smooth",
                      set.done
                        ? "bg-fit-accent border-fit-accent text-fit-accent-foreground"
                        : "bg-fit-surface border-fit-border text-fit-muted",
                    )}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <div className="col-span-5 -mt-1">
                    <button
                      type="button"
                      onClick={() =>
                        patchExercise(exercise.id, (e0) => {
                          const sets = [...e0.sets];
                          sets[i] = { ...sets[i], bodyweight: !sets[i].bodyweight, weight: "0" };
                          return { ...e0, sets };
                        })
                      }
                      className="text-[11px] text-fit-muted hover:text-fit-accent transition-smooth"
                    >
                      {set.bodyweight ? "已设为自重(BW)" : "设为自重(BW)"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => addSetCopy(exercise.id)}
                className="flex-1 bg-fit-surface border-fit-border text-fit-foreground hover:bg-fit-surface/80"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Set
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => copyLastSet(exercise.id)}
                className="flex-1 bg-fit-surface border-fit-border text-fit-foreground hover:bg-fit-surface/80"
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy Last Set
              </Button>
            </div>
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
            {saving ? "保存中..." : `完成训练 (${exercises.length} 动作 / ${totalSets} 组)`}
          </Button>
        </div>
      </div>
    </div>
  );
};

function todayYmd() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentTimeHm() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export default FitStrengthSession;
