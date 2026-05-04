import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Footprints, Waves, Dumbbell, Sparkles, Trash2, Plus, Pencil, Target, type LucideIcon } from "lucide-react";
import { WorkoutType, DistanceUnit, PoolUnit, WeightUnit, SwimmingSet as SwimmingMultiSet, SwimmingSetItem, SwimmingSetData, Workout, RunningData, SwimmingData, SwimmingMultiSetData, StrengthData } from "./types";
import {
  distanceInputToMeters,
  hmsToSeconds,
  poolInputToMeters,
  weightInputToKg,
  kgToDisplay,
  formatDuration,
  metersToYards,
  yardsToMeters,
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
  const [swimSets, setSwimSets] = useState<SwimmingMultiSet[]>([]);
  const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);  // 当前正在编辑的片段索引
  const [segmentHours, setSegmentHours] = useState("0");  // 片段时长小时
  const [segmentMinutes, setSegmentMinutes] = useState("");  // 片段时长分钟
  const [segmentSeconds, setSegmentSeconds] = useState("0");  // 片段时长秒

  // strength session (会话模式)
  type StrengthSessionExercise = {
    id: string;
    name: string;
    done: boolean;
    sets: Array<{ weight_kg: number; reps: number; bodyweight?: boolean; done?: boolean; weight_unit?: WeightUnit }>;
  };
  const [strengthExercises, setStrengthExercises] = useState<StrengthSessionExercise[]>([]);

  // swimming set (专项游泳组)
  type SwimmingSetItemInput = {
    id: string;
    setsCount: string; // 组数
    countPerSet: string; // 每组个数
    length: string; // 每个长度
    lengthUnit: PoolUnit; // 长度单位
    stroke: string; // 泳姿
    targetMinutes: string; // 要求时间-分钟
    targetSeconds: string; // 要求时间-秒
    completedCount: string; // 实际完成总数
  };
  const [swimmingSets, setSwimmingSets] = useState<SwimmingSetItemInput[]>([]);

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
        // 重置游泳片段相关状态
        setSwimSets([]);
        setEditingSetIndex(null);
        setSegmentHours("0"); setSegmentMinutes(""); setSegmentSeconds("0");
        // 重置力量训练会话状态
        setStrengthExercises([]);
        // 重置专项游泳组状态
        setSwimmingSets([]);
      }, 200);
    } else {
      setRunUnit(prefs.distance_unit);
      setSwimUnit(prefs.pool_unit);
      
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
          sets: (ex.sets || []).map(set => {
            // 将存储的kg值转换为显示单位
            const displayUnit = prefs.weight_unit;
            const displayWeight = kgToDisplay(set.weight_kg, displayUnit);
            
            return {
              weight_kg: displayWeight,
              reps: set.reps,
              bodyweight: set.bodyweight || false,
              done: set.done || false,
              weight_unit: displayUnit,
            };
          }),
        }));
        setStrengthExercises(sessionExercises);
      }
    } else if (workout.type === "swimming_set") {
      const data = workout.data as SwimmingSetData;
      // 加载专项游泳组数据
      const setInputs: SwimmingSetItemInput[] = data.sets.map((set, idx) => {
        const lengthInMeters = set.length_meters;
        // 根据用户偏好决定显示单位
        const displayUnit = prefs.pool_unit;
        const displayLength = displayUnit === "yd" ? metersToYards(lengthInMeters) : lengthInMeters;
        
        const targetMinutes = Math.floor(set.target_time_seconds / 60);
        const targetSeconds = set.target_time_seconds % 60;
        
        return {
          id: `swim-set-${idx}-${Date.now()}`,
          setsCount: set.sets_count.toString(),
          countPerSet: set.count_per_set.toString(),
          length: displayLength.toString(),
          lengthUnit: displayUnit,
          stroke: set.stroke || "自由泳",
          targetMinutes: targetMinutes.toString(),
          targetSeconds: targetSeconds.toString(),
          completedCount: (set.completed_count ?? 0).toString(),
        };
      });
      setSwimmingSets(setInputs);
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

  // 计算专项游泳组的汇总数据
  const swimSetSummary = useMemo(() => {
    let totalRequired = 0;
    let totalCompleted = 0;

    swimmingSets.forEach((set) => {
      const setsCount = parseInt(set.setsCount) || 0;
      const countPerSet = parseInt(set.countPerSet) || 0;
      const completed = parseInt(set.completedCount) || 0;
      totalRequired += setsCount * countPerSet;
      totalCompleted += completed;
    });

    const completionRate = totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0;

    return {
      totalRequired,
      totalCompleted,
      completionRate: Math.min(completionRate, 100), // 最多100%
    };
  }, [swimmingSets]);

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

    const newSet: SwimmingMultiSet = {
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

  // 添加专项游泳组
  const addSwimmingSet = () => {
    const newSet: SwimmingSetItemInput = {
      id: `swim-set-${Date.now()}`,
      setsCount: "",
      countPerSet: "",
      length: "",
      lengthUnit: prefs.pool_unit,
      stroke: "自由泳",
      targetMinutes: "",
      targetSeconds: "",
      completedCount: "",
    };
    setSwimmingSets([...swimmingSets, newSet]);
  };

  // 更新专项游泳组
  const updateSwimmingSet = (id: string, field: keyof SwimmingSetItemInput, value: string) => {
    setSwimmingSets(swimmingSets.map((set) => (set.id === id ? { ...set, [field]: value } : set)));
  };

  // 删除专项游泳组
  const removeSwimmingSet = (id: string) => {
    setSwimmingSets(swimmingSets.filter((set) => set.id !== id));
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
      // 统一使用会话模式数据结构
      if (strengthExercises.length === 0) {
         toast.error("请至少添加一个动作");
         setSubmitting(false);
         return;
      }

      const totalSets = strengthExercises.reduce((sum, ex) => sum + ex.sets.length, 0);
      data = {
        session: true,
        exercises: strengthExercises.map(ex => ({
          name: ex.name,
          done: ex.done,
          sets: ex.sets.map(set => ({
            weight_kg: weightInputToKg(set.weight_kg, set.weight_unit || prefs.weight_unit),
            reps: set.reps,
            bodyweight: set.bodyweight || false,
            done: set.done || false,
          })),
        })),
        sets: totalSets, // 总组数（用于显示）
      };
    } else if (type === "swimming_set") {
      // 专项游泳组
      if (swimmingSets.length === 0) {
        toast.error("请至少添加一个训练组");
        setSubmitting(false);
        return;
      }

      // 验证所有字段都已填写
      for (const set of swimmingSets) {
        if (!set.setsCount || !set.countPerSet || !set.length || !set.stroke || !set.targetMinutes || !set.targetSeconds || !set.completedCount) {
          toast.error("请填写所有训练组的完整信息");
          setSubmitting(false);
          return;
        }
      }

      // 构建训练组数据（转换为米和秒）
      const sets: SwimmingSetItem[] = swimmingSets.map((set) => {
        const setsCount = parseInt(set.setsCount);
        const countPerSet = parseInt(set.countPerSet);
        const lengthInMeters = set.lengthUnit === "yd" 
          ? yardsToMeters(parseFloat(set.length))
          : parseFloat(set.length);
        const targetTimeSeconds = parseInt(set.targetMinutes) * 60 + parseInt(set.targetSeconds);
        const completedCount = parseInt(set.completedCount);

        return {
          sets_count: setsCount,
          count_per_set: countPerSet,
          length_meters: lengthInMeters,
          stroke: set.stroke,
          target_time_seconds: targetTimeSeconds,
          completed_count: completedCount,
        };
      });

      // 计算汇总数据
      const totalRequiredCount = sets.reduce((sum, set) => sum + (set.sets_count * set.count_per_set), 0);
      const totalCompletedCount = sets.reduce((sum, set) => sum + (set.completed_count ?? 0), 0);
      const completionRate = totalRequiredCount > 0 ? (totalCompletedCount / totalRequiredCount) * 100 : 0;

      data = {
        sets,
        total_required_count: totalRequiredCount,
        total_completed_count: totalCompletedCount,
        completion_rate: Math.min(completionRate, 100),
      };
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
          <div className="grid grid-cols-2 gap-3 py-2">
            <TypeButton icon={Footprints} label="跑步" onClick={() => setType("running")} />
            <TypeButton icon={Waves} label="游泳" onClick={() => setType("swimming")} />
            <TypeButton icon={Target} label="专项游泳组" onClick={() => setType("swimming_set")} />
            <TypeButton
              icon={Dumbbell}
              label="力量训练"
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
                      {[
                        { value: "50", unit: "m" },
                        { value: "100", unit: "m" },
                        { value: "200", unit: "m" },
                        { value: "50", unit: "yd" },
                        { value: "100", unit: "yd" },
                        { value: "200", unit: "yd" },
                      ].map((preset) => (
                        <button
                          key={`${preset.value}${preset.unit}`}
                          type="button"
                          onClick={() => { setSwimUnit(preset.unit as PoolUnit); setPoolLen(preset.value); }}
                          className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-semibold transition-smooth border",
                            swimUnit === preset.unit && poolLen === preset.value
                              ? "bg-fit-accent text-fit-accent-foreground border-fit-accent"
                              : "bg-fit-surface text-fit-muted border-fit-border hover:text-fit-foreground",
                          )}
                        >
                          {preset.value}{preset.unit}
                        </button>
                      ))}
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
                <div className="space-y-4">
                  <div className="rounded-lg border border-fit-accent/35 bg-fit-accent/10 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-fit-accent text-xs font-semibold">
                        <Dumbbell className="w-4 h-4" />
                        力量训练 ({strengthExercises.length} 个动作)
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const name = prompt("输入动作名称");
                          if (name?.trim()) {
                            setStrengthExercises([
                              ...strengthExercises,
                              {
                                id: `exercise-${Date.now()}`,
                                name: name.trim(),
                                done: false,
                                sets: [{ weight_kg: 0, reps: 10, bodyweight: false, done: false, weight_unit: prefs.weight_unit }],
                              },
                            ]);
                          }
                        }}
                        className="text-fit-accent hover:text-fit-accent/80 transition-smooth"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {strengthExercises.map((ex, exIdx) => (
                        <div key={ex.id} className="bg-fit-surface rounded-lg p-3 border border-fit-border">
                          <div className="flex items-center justify-between mb-2">
                            <input
                              type="text"
                              value={ex.name}
                              onChange={(e) => {
                                const updated = [...strengthExercises];
                                updated[exIdx] = { ...updated[exIdx], name: e.target.value };
                                setStrengthExercises(updated);
                              }}
                              className="bg-transparent text-fit-foreground font-semibold text-sm border-none outline-none flex-1 mr-2"
                            />
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
                              <div key={setIdx} className="flex items-center gap-2">
                                <span className="text-xs text-fit-muted w-12">第{setIdx + 1}组</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...strengthExercises];
                                    const newBodyweight = !set.bodyweight;
                                    updated[exIdx].sets[setIdx] = {
                                      ...set,
                                      bodyweight: newBodyweight,
                                      weight_kg: newBodyweight ? 0 : set.weight_kg,
                                    };
                                    setStrengthExercises(updated);
                                  }}
                                  className={cn(
                                    "px-2 py-1 rounded text-xs font-medium transition-smooth",
                                    set.bodyweight
                                      ? "bg-fit-accent text-fit-accent-foreground"
                                      : "bg-fit-card text-fit-muted border border-fit-border"
                                  )}
                                >
                                  BW
                                </button>
                                {!set.bodyweight && (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      value={set.weight_kg}
                                      onChange={(e) => {
                                        const updated = [...strengthExercises];
                                        updated[exIdx].sets[setIdx] = {
                                          ...set,
                                          weight_kg: parseFloat(e.target.value) || 0,
                                        };
                                        setStrengthExercises(updated);
                                      }}
                                      placeholder="重量"
                                      className="w-16 px-2 py-1 rounded bg-fit-card border border-fit-border text-fit-foreground text-xs"
                                    />
                                    <div className="flex bg-fit-card border border-fit-border rounded p-0.5">
                                      {(["kg", "lb"] as WeightUnit[]).map((u) => (
                                        <button
                                          key={u}
                                          type="button"
                                          onClick={() => {
                                            const updated = [...strengthExercises];
                                            updated[exIdx].sets[setIdx] = {
                                              ...set,
                                              weight_unit: u,
                                            };
                                            setStrengthExercises(updated);
                                          }}
                                          className={cn(
                                            "px-1.5 py-0.5 text-[10px] font-semibold rounded-sm transition-smooth",
                                            (set.weight_unit || prefs.weight_unit) === u
                                              ? "bg-fit-accent text-fit-accent-foreground"
                                              : "text-fit-muted hover:text-fit-foreground"
                                          )}
                                        >
                                          {u}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <span className="text-xs text-fit-muted">×</span>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={set.reps}
                                  onChange={(e) => {
                                    const updated = [...strengthExercises];
                                    updated[exIdx].sets[setIdx] = {
                                      ...set,
                                      reps: parseInt(e.target.value) || 0,
                                    };
                                    setStrengthExercises(updated);
                                  }}
                                  placeholder="次数"
                                  className="w-16 px-2 py-1 rounded bg-fit-card border border-fit-border text-fit-foreground text-xs"
                                />
                                <span className="text-xs text-fit-muted">次</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...strengthExercises];
                                    updated[exIdx].sets.splice(setIdx, 1);
                                    setStrengthExercises(updated);
                                  }}
                                  className="text-fit-muted hover:text-destructive transition-smooth ml-auto"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...strengthExercises];
                                const lastSet = ex.sets[ex.sets.length - 1];
                                updated[exIdx].sets.push({
                                  weight_kg: lastSet?.weight_kg ?? 0,
                                  reps: lastSet?.reps ?? 10,
                                  bodyweight: lastSet?.bodyweight ?? false,
                                  done: false,
                                  weight_unit: lastSet?.weight_unit ?? prefs.weight_unit,
                                });
                                setStrengthExercises(updated);
                              }}
                              className="w-full mt-2 py-1.5 rounded-md bg-fit-card border border-fit-border text-xs text-fit-muted hover:text-fit-foreground transition-smooth flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              添加一组
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {type === "swimming_set" && (
              <>
                {/* 专项游泳组汇总 */}
                {swimmingSets.length > 0 && (
                  <div className="rounded-lg border border-fit-accent/35 bg-fit-accent/10 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-fit-accent text-xs font-semibold">
                        <Target className="w-4 h-4" />
                        训练汇总 ({swimmingSets.length} 个训练组)
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-fit-muted text-xs">要求总数</p>
                        <p className="text-fit-foreground font-semibold">{swimSetSummary.totalRequired}</p>
                      </div>
                      <div>
                        <p className="text-fit-muted text-xs">完成总数</p>
                        <p className="text-fit-foreground font-semibold">{swimSetSummary.totalCompleted}</p>
                      </div>
                      <div>
                        <p className="text-fit-muted text-xs">完成度</p>
                        <p className={cn(
                          "font-semibold",
                          swimSetSummary.completionRate >= 100 ? "text-green-500" : 
                          swimSetSummary.completionRate >= 80 ? "text-yellow-500" : "text-red-500"
                        )}>
                          {swimSetSummary.completionRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 训练组列表 */}
                {swimmingSets.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {swimmingSets.map((set, idx) => (
                      <div key={set.id} className="bg-fit-surface rounded-lg p-3 border border-fit-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-fit-foreground font-semibold text-sm">训练组 {idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeSwimmingSet(set.id)}
                            className="text-fit-muted hover:text-destructive transition-smooth"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div>
                          <Label className="text-fit-muted text-[10px] mb-1 block">泳姿</Label>
                          <div className="flex flex-wrap gap-2">
                            {["自由泳", "蛙泳", "仰泳", "蝶泳", "混合泳"].map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => updateSwimmingSet(set.id, "stroke", option)}
                                className={cn(
                                  "px-3 py-1.5 rounded-md text-xs font-medium transition-smooth",
                                  set.stroke === option
                                    ? "bg-fit-accent text-fit-accent-foreground"
                                    : "bg-fit-card text-fit-muted border border-fit-border hover:text-fit-foreground"
                                )}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-fit-muted text-[10px] mb-1 block">组数</Label>
                            <Input
                              inputMode="numeric"
                              value={set.setsCount}
                              onChange={(e) => updateSwimmingSet(set.id, "setsCount", e.target.value)}
                              placeholder="如: 3"
                              className="bg-fit-card border-fit-border text-fit-foreground text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-fit-muted text-[10px] mb-1 block">每组个数</Label>
                            <Input
                              inputMode="numeric"
                              value={set.countPerSet}
                              onChange={(e) => updateSwimmingSet(set.id, "countPerSet", e.target.value)}
                              placeholder="如: 10"
                              className="bg-fit-card border-fit-border text-fit-foreground text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-fit-muted text-[10px] mb-1 block">实际完成</Label>
                            <Input
                              inputMode="numeric"
                              value={set.completedCount}
                              onChange={(e) => updateSwimmingSet(set.id, "completedCount", e.target.value)}
                              placeholder="如: 27"
                              className="bg-fit-card border-fit-border text-fit-foreground text-sm"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-fit-muted text-[10px] mb-1 block">每个长度</Label>
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {[
                                { value: "50", unit: "m" },
                                { value: "100", unit: "m" },
                                { value: "200", unit: "m" },
                                { value: "50", unit: "yd" },
                                { value: "100", unit: "yd" },
                                { value: "200", unit: "yd" },
                              ].map((preset) => (
                                <button
                                  key={`${preset.value}${preset.unit}`}
                                  type="button"
                                  onClick={() => {
                                    setSwimmingSets(swimmingSets.map((s) => 
                                      s.id === set.id 
                                        ? { ...s, length: preset.value, lengthUnit: preset.unit as PoolUnit }
                                        : s
                                    ));
                                  }}
                                  className={cn(
                                    "px-2 py-1 rounded text-[10px] font-semibold transition-smooth border",
                                    set.length === preset.value && set.lengthUnit === preset.unit
                                      ? "bg-fit-accent text-fit-accent-foreground border-fit-accent"
                                      : "bg-fit-card text-fit-muted border-fit-border hover:text-fit-foreground",
                                  )}
                                >
                                  {preset.value}{preset.unit}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-1">
                              <Input
                                inputMode="decimal"
                                value={set.length}
                                onChange={(e) => updateSwimmingSet(set.id, "length", e.target.value)}
                                placeholder="自定义长度"
                                className="bg-fit-card border-fit-border text-fit-foreground text-sm flex-1"
                              />
                              <div className="flex bg-fit-card border border-fit-border rounded-md p-0.5">
                                {(["m", "yd"] as PoolUnit[]).map((u) => (
                                  <button
                                    key={u}
                                    type="button"
                                    onClick={() => updateSwimmingSet(set.id, "lengthUnit", u)}
                                    className={cn(
                                      "px-2.5 py-1 text-xs font-semibold rounded-sm transition-smooth",
                                      set.lengthUnit === u ? "bg-fit-accent text-fit-accent-foreground" : "text-fit-muted hover:text-fit-foreground",
                                    )}
                                  >
                                    {u}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div>
                            <Label className="text-fit-muted text-[10px] mb-1 block">要求时间</Label>
                            <div className="flex gap-1">
                              <Input
                                inputMode="numeric"
                                value={set.targetMinutes}
                                onChange={(e) => updateSwimmingSet(set.id, "targetMinutes", e.target.value)}
                                placeholder="分"
                                className="bg-fit-card border-fit-border text-fit-foreground text-sm w-16"
                              />
                              <span className="text-fit-muted text-sm self-center">:</span>
                              <Input
                                inputMode="numeric"
                                value={set.targetSeconds}
                                onChange={(e) => updateSwimmingSet(set.id, "targetSeconds", e.target.value)}
                                placeholder="秒"
                                className="bg-fit-card border-fit-border text-fit-foreground text-sm w-16"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  type="button"
                  onClick={addSwimmingSet}
                  className="w-full bg-fit-accent text-fit-accent-foreground hover:bg-fit-accent/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  添加训练组
                </Button>
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

const typeLabel = (t: WorkoutType) => ({ running: "跑步", swimming: "游泳", strength: "力量训练", swimming_set: "专项游泳组" }[t]);

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