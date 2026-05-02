import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Footprints, Waves, Dumbbell, Sparkles, Trash2, Plus, Pencil, type LucideIcon } from "lucide-react";
import { WorkoutType, DistanceUnit, PoolUnit, WeightUnit, SwimmingSet } from "./types";
import {
  distanceInputToMeters,
  hmsToSeconds,
  poolInputToMeters,
  weightInputToKg,
  formatDuration,
} from "./units";
import { usePreferences } from "./usePreferences";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  editingWorkout?: Workout | null;
}

export const WorkoutDialog = ({ open, onOpenChange, onSaved, editingWorkout }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const [type, setType] = useState<WorkoutType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // common
  const [workoutDate, setWorkoutDate] = useState(todayYmd());
  const [notes, setNotes] = useState("");
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("0");

  // running
  const [runDistance, setRunDistance] = useState("");
  const [runUnit, setRunUnit] = useState<DistanceUnit>(prefs.distance_unit);
  const [mood, setMood] = useState(3);

  // swimming
  const [swimUnit, setSwimUnit] = useState<PoolUnit>(prefs.pool_unit);
  const [poolLen, setPoolLen] = useState("25");
  const [laps, setLaps] = useState("40");
  const [swimStroke, setSwimStroke] = useState("自由泳");
  const [customSwimStroke, setCustomSwimStroke] = useState("");
  const [swimMood, setSwimMood] = useState(3);
  // 新增游泳片段相关状态
  const [swimSets, setSwimSets] = useState<SwimmingSet[]>([]);
  const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);  // 当前正在编辑的片段索引
  const [segmentHours, setSegmentHours] = useState("0");  // 片段时长小时
  const [segmentMinutes, setSegmentMinutes] = useState("");  // 片段时长分钟
  const [segmentSeconds, setSegmentSeconds] = useState("0");  // 片段时长秒

  // strength
  const [exercise, setExercise] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(prefs.weight_unit);
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  
  // strength session (会话模式)
  type StrengthSessionExercise = {
    id: string;
    name: string;
    done: boolean;
    sets: Array<{ weight_kg: number; reps: number; bodyweight?: boolean; done?: boolean }>;
  };
  const [strengthExercises, setStrengthExercises] = useState<StrengthSessionExercise[]>([]);

  useEffect(() => {
    if (!open) {
      // reset on close
      setTimeout(() => {
        setType(null);
        setWorkoutDate(todayYmd());
        setNotes("");
        setHours("0"); setMinutes(""); setSeconds("0");
        setRunDistance(""); setMood(3);
        setPoolLen("25"); setLaps("40"); setSwimStroke("自由泳"); setCustomSwimStroke(""); setSwimMood(3);
        setExercise(""); setWeight(""); setIsBodyweight(false); setSets(""); setReps("");
        // 重置游泳片段相关状态
        setSwimSets([]);
        setEditingSetIndex(null);
        setSegmentHours("0"); setSegmentMinutes(""); setSegmentSeconds("0");
        // 重置力量训练会话状态
        setStrengthExercises([]);
      }, 200);
    } else {
      setRunUnit(prefs.distance_unit);
      setSwimUnit(prefs.pool_unit);
      setWeightUnit(prefs.weight_unit);
      
      // 如果是编辑模式，填充数据
      if (editingWorkout) {
        populateFormFromWorkout(editingWorkout);
      }
    }
  }, [open, prefs, editingWorkout]);

  const populateFormFromWorkout = (workout: Workout) => {
    setType(workout.type);
    setWorkoutDate(workout.date.split('T')[0]);
    setNotes(workout.notes || "");
    
    if (workout.type === "running") {
      const data = workout.data as RunningData;
      setRunDistance((data.distance_meters / 1000).toFixed(2));
      setRunUnit(prefs.distance_unit);
      const hoursVal = Math.floor(data.duration_seconds / 3600);
      const minsVal = Math.floor((data.duration_seconds % 3600) / 60);
      const secsVal = data.duration_seconds % 60;
      setHours(hoursVal.toString());
      setMinutes(minsVal.toString());
      setSeconds(secsVal.toString());
      setMood(data.mood || 3);
    } else if (workout.type === "swimming") {
      const data = workout.data as SwimmingData | SwimmingMultiSetData;
      
      if ('sets' in data && Array.isArray(data.sets)) {
        // 多片段数据
        const multiSetData = data as SwimmingMultiSetData;
        setSwimSets(multiSetData.sets);
        setSwimMood(multiSetData.mood || 3);
      } else {
        // 单一数据
        const singleData = data as SwimmingData;
        setPoolLen(singleData.pool_length_meters.toString());
        setLaps(singleData.laps.toString());
        setSwimStroke(singleData.stroke);
        setSwimMood(singleData.mood || 3);
        
        const hoursVal = Math.floor(singleData.duration_seconds / 3600);
        const minsVal = Math.floor((singleData.duration_seconds % 3600) / 60);
        const secsVal = singleData.duration_seconds % 60;
        setHours(hoursVal.toString());
        setMinutes(minsVal.toString());
        setSeconds(secsVal.toString());
      }
    } else if (workout.type === "strength") {
      const data = workout.data as StrengthData;
      
      // 检查是否是会话模式（有多个动作）
      const isSessionMode = data.session === true && Array.isArray(data.exercises) && data.exercises.length > 0;
      
      if (isSessionMode) {
        // 会话模式：加载所有动作和组数据
        const sessionExercises: StrengthSessionExercise[] = data.exercises.map((ex, idx) => ({
          id: `exercise-${idx}-${Date.now()}`,
          name: ex.name,
          done: ex.done || false,
          sets: (ex.sets || []).map(set => ({
            weight_kg: set.weight_kg,
            reps: set.reps,
            bodyweight: set.bodyweight || false,
            done: set.done || false,
          })),
        }));
        setStrengthExercises(sessionExercises);
      } else {
        // 普通模式：单个动作，可以编辑
        setExercise(data.exercise || "");
        setWeight((data.weight_kg || 0).toFixed(1));
        setIsBodyweight(data.bodyweight || false);
        setSets((data.sets || 0).toString());
        setReps((data.reps || 0).toString());
      }
    }
  };

  const calculatedSwimDistance = useMemo(() => {
    const pl = parseFloat(poolLen);
    const lp = parseInt(laps);
    if (Number.isNaN(pl) || Number.isNaN(lp) || pl <= 0 || lp <= 0) {
      return { distanceInPoolUnit: 0, distanceMeters: 0 };
    }
    const distanceInPoolUnit = pl * lp;
    return {
      distanceInPoolUnit,
      distanceMeters: poolInputToMeters(distanceInPoolUnit, swimUnit),
    };
  }, [poolLen, laps, swimUnit]);

  // 计算游泳片段的汇总数据
  const swimSummary = useMemo(() => {
    const totalDistanceMeters = swimSets.reduce((sum, set) => sum + (set.pool_length_meters * set.laps), 0);
    const totalDurationSeconds = swimSets.reduce((sum, set) => sum + (set.duration_seconds || 0), 0);
    const totalDistanceDisplay = totalDistanceMeters / (swimUnit === "m" ? 1 : 1.09361); // 转换为当前单位

    return {
      totalDistanceMeters,
      totalDistanceDisplay,
      totalDurationSeconds,
      setCount: swimSets.length
    };
  }, [swimSets, swimUnit]);

  // 点击片段进行编辑
  const editSet = (index: number) => {
    const set = swimSets[index];
    setEditingSetIndex(index);
    
    // 加载片段数据到表单
    setPoolLen((set.pool_length_meters).toString());
    setLaps(set.laps.toString());
    setSwimStroke(set.stroke);
    setCustomSwimStroke("");
    
    const hoursVal = Math.floor(set.duration_seconds / 3600);
    const minsVal = Math.floor((set.duration_seconds % 3600) / 60);
    const secsVal = set.duration_seconds % 60;
    setSegmentHours(hoursVal.toString());
    setSegmentMinutes(minsVal.toString());
    setSegmentSeconds(secsVal.toString());
    
    toast.info("已加载片段到表单，修改后点击更新");
  };

  // 添加当前片段到片段列表
  const addCurrentSet = () => {
    const pl = parseFloat(poolLen);
    const lp = parseInt(laps);
    const dur = hmsToSeconds(+segmentHours, +segmentMinutes, +segmentSeconds);
    const finalStroke = swimStroke === "__custom__" ? customSwimStroke.trim() : swimStroke;

    if (!pl || !lp || !dur || !finalStroke) {
      toast.error("请填写泳姿、泳池长度、圈数和时长");
      return;
    }

    const newSet: SwimmingSet = {
      pool_length_meters: poolInputToMeters(pl, swimUnit),
      laps: lp,
      stroke: finalStroke,
      duration_seconds: dur,
    };

    if (editingSetIndex !== null) {
      // 更新现有片段
      const updatedSets = [...swimSets];
      updatedSets[editingSetIndex] = newSet;
      setSwimSets(updatedSets);
      setEditingSetIndex(null);
      toast.success("片段已更新");
    } else {
      // 添加新片段
      setSwimSets([...swimSets, newSet]);
      toast.success("已添加片段");
    }
    
    // 重置当前输入字段
    setLaps("40");
    setSwimStroke("自由泳");
    setCustomSwimStroke("");
    setSegmentHours("0");
    setSegmentMinutes("");
    setSegmentSeconds("0");
  };

  // 删除指定索引的片段
  const removeSet = (index: number) => {
    setSwimSets(swimSets.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user || !type) return;
    setSubmitting(true);

    let data: Record<string, any> = {};
    if (type === "running") {
      const d = parseFloat(runDistance);
      const dur = hmsToSeconds(+hours, +minutes, +seconds);
      if (!d || !dur) {
        toast.error("请填写距离和时长");
        setSubmitting(false);
        return;
      }
      data = {
        distance_meters: distanceInputToMeters(d, runUnit),
        duration_seconds: dur,
        mood,
      };
    } else if (type === "swimming") {
      // 如果有片段，则使用多片段格式
      if (swimSets.length > 0) {
        const totalDistanceMeters = swimSets.reduce((sum, set) => {
          return sum + (set.pool_length_meters * set.laps);
        }, 0);
        const totalDurationSeconds = swimSets.reduce((sum, set) => {
          return sum + (set.duration_seconds || 0);
        }, 0);

        data = {
          sets: swimSets,
          total_distance_meters: totalDistanceMeters,
          total_duration_seconds: totalDurationSeconds,
          mood: swimMood,
        };
      } else {
        // 否则使用旧格式
        const pl = parseFloat(poolLen);
        const lp = parseInt(laps);
        const dur = hmsToSeconds(+hours, +minutes, +seconds);
        const finalStroke = swimStroke === "__custom__" ? customSwimStroke.trim() : swimStroke;
        if (!pl || !lp || !dur || !finalStroke) {
          toast.error("请填写泳姿、泳池长度、圈数和时长");
          setSubmitting(false);
          return;
        }
        data = {
          distance_meters: calculatedSwimDistance.distanceMeters,
          pool_length_meters: poolInputToMeters(pl, swimUnit),
          laps: lp,
          stroke: finalStroke,
          mood: swimMood,
          duration_seconds: dur,
        };
      }
    } else if (type === "strength") {
      // 检查是否是会话模式
      if (strengthExercises.length > 0) {
        // 会话模式：保存多个动作
        const totalSets = strengthExercises.reduce((sum, ex) => sum + ex.sets.length, 0);
        data = {
          session: true,
          exercises: strengthExercises.map(ex => ({
            name: ex.name,
            done: ex.done,
            sets: ex.sets.map(set => ({
              weight_kg: set.weight_kg,
              reps: set.reps,
              bodyweight: set.bodyweight || false,
              done: set.done || false,
            })),
          })),
          sets: totalSets, // 总组数（用于显示）
        };
      } else {
        // 普通模式：单个动作
        const w = isBodyweight ? 0 : parseFloat(weight);
        const s = parseInt(sets);
        const r = parseInt(reps);
        if (!exercise.trim() || Number.isNaN(w) || w < 0 || !s || !r) {
          toast.error("请完整填写动作信息");
          setSubmitting(false);
          return;
        }
        data = {
          exercise: exercise.trim(),
          weight_kg: weightInputToKg(w, weightUnit),
          bodyweight: isBodyweight,
          sets: s,
          reps: r,
        };
      }
    }

    const selectedDate = new Date(`${workoutDate}T12:00:00`);
    if (Number.isNaN(selectedDate.getTime())) {
      toast.error("请选择有效日期");
      setSubmitting(false);
      return;
    }

    // 判断是创建还是更新
    if (editingWorkout) {
      const { error } = await supabase
        .from("workouts")
        .update({
          type,
          data,
          notes: notes.trim() || null,
          date: selectedDate.toISOString(),
        })
        .eq("id", editingWorkout.id);
      
      setSubmitting(false);
      if (error) {
        toast.error("更新失败");
        return;
      }
      toast.success("已更新 💪");
    } else {
      const { error } = await supabase.from("workouts").insert({
        user_id: user.id,
        type,
        data,
        notes: notes.trim() || null,
        date: selectedDate.toISOString(),
      });
      setSubmitting(false);
      if (error) {
        toast.error("保存失败");
        return;
      }
      toast.success("已记录 💪");
    }
    
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-fit-card border-fit-border text-fit-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-fit-foreground">
            {editingWorkout ? `编辑 ${typeLabel(type ?? editingWorkout.type)}` : (type ? `记录 ${typeLabel(type)}` : "选择运动类型")}
          </DialogTitle>
        </DialogHeader>

        {!type ? (
          <div className="grid grid-cols-3 gap-3 py-2">
            <TypeButton icon={Footprints} label="跑步" onClick={() => setType("running")} />
            <TypeButton icon={Waves} label="游泳" onClick={() => setType("swimming")} />
            <TypeButton
              icon={Dumbbell}
              label="力量会话"
              onClick={() => {
                onOpenChange(false);
                navigate("/fit/strength/session");
              }}
            />
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
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

            {type === "running" && (
              <>
                <DistanceField
                  label="距离"
                  value={runDistance}
                  onChange={setRunDistance}
                  unit={runUnit}
                  onUnit={(u) => setRunUnit(u as DistanceUnit)}
                  units={["km", "mi"]}
                />
                <DurationField h={hours} m={minutes} s={seconds} setH={setHours} setM={setMinutes} setS={setSeconds} />
                <div>
                  <Label className="text-fit-muted text-xs mb-2 block">心情</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMood(n)}
                        className={cn(
                          "flex-1 h-10 rounded-lg text-lg transition-smooth",
                          mood === n
                            ? "bg-fit-accent text-fit-accent-foreground"
                            : "bg-fit-surface text-fit-muted hover:text-fit-foreground",
                        )}
                      >
                        {["😞", "😕", "😐", "🙂", "🤩"][n - 1]}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {type === "swimming" && (
              <>
                {/* 显示片段汇总 */}
                {swimSets.length > 0 && (
                  <div className="rounded-lg border border-fit-accent/35 bg-fit-accent/10 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-fit-accent text-xs font-semibold">
                        <Sparkles className="w-4 h-4" />
                        当前汇总 ({swimSummary.setCount} 个片段)
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-fit-muted text-xs">总距离</p>
                        <p className="text-fit-foreground font-semibold">
                          {Math.round(swimSummary.totalDistanceDisplay)} {swimUnit}
                          <span className="text-fit-muted font-normal text-xs ml-1">
                            ({Math.round(swimSummary.totalDistanceMeters)} m)
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-fit-muted text-xs">总时长</p>
                        <p className="text-fit-foreground font-semibold">
                          {formatDuration(swimSummary.totalDurationSeconds)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="border-t border-fit-border/50 pt-2 mt-2">
                      <p className="text-fit-muted text-xs mb-2">已添加片段</p>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {swimSets.map((set, idx) => (
                          <div 
                            key={idx} 
                            className={cn(
                              "flex items-center justify-between bg-fit-surface rounded px-2 py-1.5 text-xs transition-smooth",
                              editingSetIndex === idx ? "border border-fit-accent" : ""
                            )}
                          >
                            <div 
                              className="flex-1 cursor-pointer"
                              onClick={() => editSet(idx)}
                            >
                              <span className="text-fit-foreground font-medium">{set.stroke}</span>
                              <span className="text-fit-muted ml-2">
                                {set.laps}圈 × {set.pool_length_meters}m
                              </span>
                              <span className="text-fit-muted ml-2">
                                {formatDuration(set.duration_seconds)}
                              </span>
                              {editingSetIndex === idx && (
                                <span className="ml-2 text-fit-accent font-semibold">✏️ 编辑中</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => editSet(idx)}
                                className="text-fit-muted hover:text-fit-accent transition-smooth p-1"
                                title="编辑片段"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeSet(idx)}
                                className="text-fit-muted hover:text-destructive transition-smooth p-1"
                                title="删除片段"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3 border border-fit-border rounded-lg p-3">
                  <p className="text-fit-muted text-xs font-semibold">
                    {swimSets.length === 0 ? "添加第一个片段" : "添加下一段"}
                  </p>

                  <div>
                    <Label className="text-fit-muted text-xs mb-2 block">泳姿 / 训练内容</Label>
                    <div className="flex flex-wrap gap-2">
                      {["自由泳", "蛙泳", "仰泳", "蝶泳", "混合泳"].map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSwimStroke(option)}
                          className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-semibold transition-smooth border",
                            swimStroke === option
                              ? "bg-fit-accent text-fit-accent-foreground border-fit-accent"
                              : "bg-fit-surface text-fit-muted border-fit-border hover:text-fit-foreground",
                          )}
                        >
                          {option}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSwimStroke("__custom__")}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-xs font-semibold transition-smooth border",
                          swimStroke === "__custom__"
                            ? "bg-fit-accent text-fit-accent-foreground border-fit-accent"
                            : "bg-fit-surface text-fit-muted border-fit-border hover:text-fit-foreground",
                        )}
                      >
                        自定义
                      </button>
                    </div>
                    {swimStroke === "__custom__" && (
                      <Input
                        value={customSwimStroke}
                        onChange={(e) => setCustomSwimStroke(e.target.value)}
                        placeholder="如: 自由泳打腿 / 窄手仰泳练习"
                        className="mt-2 bg-fit-surface border-fit-border text-fit-foreground"
                      />
                    )}
                  </div>

                  <div>
                    <Label className="text-fit-muted text-xs mb-2 block">泳池长度</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => { setSwimUnit("m"); setPoolLen("25"); }}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-xs font-semibold transition-smooth border",
                          swimUnit === "m" && poolLen === "25"
                            ? "bg-fit-accent text-fit-accent-foreground border-fit-accent"
                            : "bg-fit-surface text-fit-muted border-fit-border hover:text-fit-foreground",
                        )}
                      >
                        25m
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSwimUnit("yd"); setPoolLen("25"); }}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-xs font-semibold transition-smooth border",
                          swimUnit === "yd" && poolLen === "25"
                            ? "bg-fit-accent text-fit-accent-foreground border-fit-accent"
                            : "bg-fit-surface text-fit-muted border-fit-border hover:text-fit-foreground",
                        )}
                      >
                        25yd
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSwimUnit("m"); setPoolLen("50"); }}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-xs font-semibold transition-smooth border",
                          swimUnit === "m" && poolLen === "50"
                            ? "bg-fit-accent text-fit-accent-foreground border-fit-accent"
                            : "bg-fit-surface text-fit-muted border-fit-border hover:text-fit-foreground",
                        )}
                      >
                        50m
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        inputMode="decimal"
                        value={poolLen}
                        onChange={(e) => setPoolLen(e.target.value)}
                        className="bg-fit-surface border-fit-border text-fit-foreground flex-1"
                      />
                      <div className="flex bg-fit-surface border border-fit-border rounded-md p-0.5">
                        {["m", "yd"].map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setSwimUnit(u as PoolUnit)}
                            className={cn(
                              "px-3 text-xs font-semibold rounded-sm transition-smooth",
                              swimUnit === u ? "bg-fit-accent text-fit-accent-foreground" : "text-fit-muted",
                            )}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-fit-muted text-xs mb-2 block">圈数</Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLaps((v) => String(Math.max(1, (parseInt(v) || 1) - 1)))}
                        className="w-10 h-10 rounded-md bg-fit-surface border border-fit-border text-fit-muted hover:text-fit-foreground transition-smooth"
                      >
                        -
                      </button>
                      <Input
                        inputMode="numeric"
                        value={laps}
                        onChange={(e) => setLaps(e.target.value)}
                        className="bg-fit-surface border-fit-border text-fit-foreground text-center"
                      />
                      <button
                        type="button"
                        onClick={() => setLaps((v) => String(Math.max(1, (parseInt(v) || 0) + 1)))}
                        className="w-10 h-10 rounded-md bg-fit-surface border border-fit-border text-fit-muted hover:text-fit-foreground transition-smooth"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-fit-accent/35 bg-fit-accent/10 p-3">
                    <div className="flex items-center gap-2 text-fit-accent text-xs font-semibold">
                      <Sparkles className="w-4 h-4" />
                      当前片段距离
                    </div>
                    <p className="mt-1 text-sm text-fit-foreground font-semibold">
                      {Math.round(calculatedSwimDistance.distanceInPoolUnit)} {swimUnit}
                      <span className="text-fit-muted font-normal">
                        {" "}
                        ({Math.round(calculatedSwimDistance.distanceMeters)} m)
                      </span>
                    </p>
                  </div>

                  <DurationField 
                    h={segmentHours} 
                    m={segmentMinutes} 
                    s={segmentSeconds} 
                    setH={setSegmentHours} 
                    setM={setSegmentMinutes} 
                    setS={setSegmentSeconds} 
                  />

                  <Button
                    type="button"
                    onClick={addCurrentSet}
                    className={cn(
                      "w-full text-fit-accent-foreground",
                      editingSetIndex !== null 
                        ? "bg-fit-accent hover:bg-fit-accent/90" 
                        : "bg-fit-accent hover:bg-fit-accent/90"
                    )}
                  >
                    {editingSetIndex !== null ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        更新片段
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        {swimSets.length === 0 ? "添加片段" : "添加下一段"}
                      </>
                    )}
                  </Button>
                  
                  {editingSetIndex !== null && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setEditingSetIndex(null);
                        setLaps("40");
                        setSwimStroke("自由泳");
                        setCustomSwimStroke("");
                        setSegmentHours("0");
                        setSegmentMinutes("");
                        setSegmentSeconds("0");
                      }}
                      className="w-full text-fit-muted hover:text-fit-foreground"
                    >
                      取消编辑
                    </Button>
                  )}
                </div>

                <div>
                  <Label className="text-fit-muted text-xs mb-2 block">整体心情</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSwimMood(n)}
                        className={cn(
                          "flex-1 h-10 rounded-lg text-lg transition-smooth",
                          swimMood === n
                            ? "bg-fit-accent text-fit-accent-foreground"
                            : "bg-fit-surface text-fit-muted hover:text-fit-foreground",
                        )}
                      >
                        {["😞", "😕", "😐", "🙂", "🤩"][n - 1]}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {type === "strength" && (
              <>
                {/* 会话模式：多个动作 */}
                {strengthExercises.length > 0 ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-fit-accent/35 bg-fit-accent/10 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-fit-accent text-xs font-semibold">
                          <Dumbbell className="w-4 h-4" />
                          力量训练会话 ({strengthExercises.length} 个动作)
                        </div>
                      </div>
                      
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {strengthExercises.map((ex, exIdx) => (
                          <div key={ex.id} className="bg-fit-surface rounded-lg p-3 border border-fit-border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-fit-foreground font-semibold text-sm">{ex.name}</span>
                              <button
                                type="button"
                                onClick={() => setStrengthExercises(strengthExercises.filter((_, i) => i !== exIdx))}
                                className="text-fit-muted hover:text-destructive transition-smooth"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="space-y-1.5">
                              {ex.sets.map((set, setIdx) => (
                                <div key={setIdx} className="flex items-center gap-2 text-xs text-fit-muted">
                                  <span>第{setIdx + 1}组:</span>
                                  <span>{set.bodyweight ? "BW" : `${set.weight_kg}kg`}</span>
                                  <span>× {set.reps}次</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="text-center text-xs text-fit-muted">
                      <p>会话模式编辑功能开发中...</p>
                      <p className="mt-1">如需修改，请在专门的会话页面进行</p>
                    </div>
                  </div>
                ) : (
                  /* 普通模式：单个动作 */
                  <>
                    <div>
                      <Label className="text-fit-muted text-xs mb-2 block">动作名称</Label>
                      <Input
                        value={exercise}
                        onChange={(e) => setExercise(e.target.value)}
                        placeholder="如:卧推"
                        className="bg-fit-surface border-fit-border text-fit-foreground"
                      />
                    </div>
                    <DistanceField
                      label="重量"
                      value={isBodyweight ? "0" : weight}
                      onChange={setWeight}
                      unit={weightUnit}
                      onUnit={(u) => setWeightUnit(u as WeightUnit)}
                      units={["kg", "lb"]}
                      disabled={isBodyweight}
                      displayValue={isBodyweight ? "BW" : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isBodyweight;
                        setIsBodyweight(next);
                        if (next) setWeight("0");
                      }}
                      className={cn(
                        "w-full h-10 rounded-lg border text-sm font-semibold transition-smooth",
                        isBodyweight
                          ? "bg-fit-accent text-fit-accent-foreground border-fit-accent"
                          : "bg-fit-surface text-fit-muted border-fit-border hover:text-fit-foreground",
                      )}
                    >
                      {isBodyweight ? "已启用：自重 / 无负重 (BW)" : "切换为：自重 / 无负重"}
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-fit-muted text-xs mb-2 block">组数</Label>
                        <Input
                          inputMode="numeric"
                          value={sets}
                          onChange={(e) => setSets(e.target.value)}
                          className="bg-fit-surface border-fit-border text-fit-foreground"
                        />
                      </div>
                      <div>
                        <Label className="text-fit-muted text-xs mb-2 block">每组次数</Label>
                        <Input
                          inputMode="numeric"
                          value={reps}
                          onChange={(e) => setReps(e.target.value)}
                          className="bg-fit-surface border-fit-border text-fit-foreground"
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            <div>
              <Label className="text-fit-muted text-xs mb-2 block">备注 (可选)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="bg-fit-surface border-fit-border text-fit-foreground resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {type && (
            <Button
              variant="ghost"
              onClick={() => {
                setType(null);
                // 重置表单
                setWorkoutDate(todayYmd());
                setNotes("");
                setHours("0"); setMinutes(""); setSeconds("0");
                setRunDistance(""); setMood(3);
                setPoolLen("25"); setLaps("40"); setSwimStroke("自由泳"); setCustomSwimStroke(""); setSwimMood(3);
                setExercise(""); setWeight(""); setIsBodyweight(false); setSets(""); setReps("");
                setSwimSets([]);
                setSegmentHours("0"); setSegmentMinutes(""); setSegmentSeconds("0");
              }}
              className="text-fit-muted hover:text-fit-foreground hover:bg-fit-surface"
            >
              返回
            </Button>
          )}
          {type && (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-fit-accent text-fit-accent-foreground hover:bg-fit-accent/90 font-semibold"
            >
              {submitting ? "保存中..." : (editingWorkout ? "更新记录" : "保存记录")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const typeLabel = (t: WorkoutType) => ({ running: "跑步", swimming: "游泳", strength: "力量训练" }[t]);

const TypeButton = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-2 py-5 rounded-xl bg-fit-surface border border-fit-border hover:border-fit-accent hover:text-fit-accent transition-smooth text-fit-foreground"
  >
    <Icon className="w-7 h-7" strokeWidth={2} />
    <span className="text-sm font-medium">{label}</span>
  </button>
);

const DistanceField = ({
  label, value, onChange, unit, onUnit, units, disabled, displayValue,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  onUnit: (u: string) => void;
  units: string[];
  disabled?: boolean;
  displayValue?: string;
}) => (
  <div>
    <Label className="text-fit-muted text-xs mb-2 block">{label}</Label>
    <div className="flex gap-2">
      <Input
        inputMode="decimal"
        value={displayValue ?? value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-fit-surface border-fit-border text-fit-foreground flex-1"
      />
      <div className="flex bg-fit-surface border border-fit-border rounded-md p-0.5">
        {units.map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => onUnit(u)}
            disabled={disabled}
            className={cn(
              "px-3 text-xs font-semibold rounded-sm transition-smooth",
              unit === u ? "bg-fit-accent text-fit-accent-foreground" : "text-fit-muted",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            {u}
          </button>
        ))}
      </div>
    </div>
  </div>
);

function todayYmd() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DurationField = ({
  h, m, s, setH, setM, setS,
}: {
  h: string; m: string; s: string;
  setH: (v: string) => void; setM: (v: string) => void; setS: (v: string) => void;
}) => (
  <div>
    <Label className="text-fit-muted text-xs mb-2 block">时长</Label>
    <div className="grid grid-cols-3 gap-2">
      {[
        { v: h, set: setH, ph: "时" },
        { v: m, set: setM, ph: "分" },
        { v: s, set: setS, ph: "秒" },
      ].map((f, i) => (
        <Input
          key={i}
          inputMode="numeric"
          value={f.v}
          placeholder={f.ph}
          onChange={(e) => f.set(e.target.value)}
          className="bg-fit-surface border-fit-border text-fit-foreground text-center"
        />
      ))}
    </div>
  </div>
);