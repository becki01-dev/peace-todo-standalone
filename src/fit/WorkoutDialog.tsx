import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Footprints, Waves, Dumbbell, Target, type LucideIcon } from "lucide-react";
import { WorkoutType, RunningData, SwimmingData, SwimmingMultiSetData, SwimmingSetData } from "./types";
import { todayYmd, currentTimeHm } from "./dates";
import { usePreferences } from "./usePreferences";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { RunningForm } from "./RunningForm";
import { SwimmingForm } from "./SwimmingForm";
import { SwimmingSetForm } from "./SwimmingSetForm";
import type { WorkoutSubformHandle } from "./WorkoutFormFields";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  editingWorkout?: Workout | null;
  copyingWorkout?: Workout | null; // 复制模式
}

/** 当前类型对应的原记录数据(编辑/复制模式),用于子表单预填 */
const formInitial = <T,>(
  t: WorkoutType,
  editingWorkout?: Workout | null,
  copyingWorkout?: Workout | null,
): T | undefined => {
  if (editingWorkout?.type === t) return editingWorkout.data as T;
  if (copyingWorkout?.type === t) return copyingWorkout.data as T;
  return undefined;
};

export const WorkoutDialog = ({ open, onOpenChange, onSaved, editingWorkout, copyingWorkout }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const [type, setType] = useState<WorkoutType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<WorkoutSubformHandle>(null);

  // common
  const [workoutDate, setWorkoutDate] = useState(todayYmd());
  const [workoutTime, setWorkoutTime] = useState("12:00"); // 时间字段
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      // reset on close
      setTimeout(() => {
        setType(null);
        setWorkoutDate(todayYmd());
        setWorkoutTime(currentTimeHm());
        setNotes("");
      }, 200);
      return;
    }
    const workout = editingWorkout ?? copyingWorkout;
    // 力量训练统一走会话页编辑/复制,不会进入对话框;纯新建时无需填充
    if (!workout || workout.type === "strength") return;
    setType(workout.type);
    // 从 ISO 字符串中提取日期和时间(日期用本地时区,避免与 toISOString 的 UTC 混用跨日错位)
    const workoutDateTime = new Date(workout.date);
    const month = String(workoutDateTime.getMonth() + 1).padStart(2, "0");
    const day = String(workoutDateTime.getDate()).padStart(2, "0");
    const datePart = `${workoutDateTime.getFullYear()}-${month}-${day}`;
    const timePart = `${String(workoutDateTime.getHours()).padStart(2, "0")}:${String(workoutDateTime.getMinutes()).padStart(2, "0")}`;

    setWorkoutDate(copyingWorkout ? todayYmd() : datePart);
    setWorkoutTime(timePart);
    setNotes(workout.notes || "");
  }, [open, editingWorkout, copyingWorkout]);

  const handleSubmit = async () => {
    if (!user || !type) return;
    setSubmitting(true);

    // 各类型子表单负责自己的校验与载荷构建
    const result = formRef.current?.buildData();
    if (!result?.ok) {
      if (result?.error) toast.error(result.error);
      setSubmitting(false);
      return;
    }
    const data = result.data;

    const selectedDate = new Date(`${workoutDate}T${workoutTime}:00`); // 使用用户选择的时间
    if (Number.isNaN(selectedDate.getTime())) {
      toast.error("请选择有效日期和时间");
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
            {editingWorkout
              ? `编辑 ${typeLabel(type ?? editingWorkout.type)}`
              : copyingWorkout
                ? `复制 ${typeLabel(type ?? copyingWorkout.type)}`
                : (type ? `记录 ${typeLabel(type)}` : "选择运动类型")}
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

            <div>
              <Label className="text-fit-muted text-xs mb-2 block">时间</Label>
              <Input
                type="time"
                value={workoutTime}
                onChange={(e) => setWorkoutTime(e.target.value)}
                className="bg-fit-surface border-fit-border text-fit-foreground"
              />
            </div>

            {type === "running" && (
              <RunningForm
                key={`running-${editingWorkout?.id ?? "new"}`}
                ref={formRef}
                initialValues={formInitial<RunningData>("running", editingWorkout, copyingWorkout)}
                initialUnit={prefs.distance_unit}
              />
            )}
            {type === "swimming" && (
              <SwimmingForm
                key={`swimming-${editingWorkout?.id ?? "new"}`}
                ref={formRef}
                initialValues={formInitial<SwimmingData | SwimmingMultiSetData>("swimming", editingWorkout, copyingWorkout)}
                initialUnit={prefs.pool_unit}
              />
            )}
            {type === "swimming_set" && (
              <SwimmingSetForm
                key={`swimming_set-${editingWorkout?.id ?? "new"}`}
                ref={formRef}
                initialValues={formInitial<SwimmingSetData>("swimming_set", editingWorkout, copyingWorkout)}
                initialPoolUnit={prefs.pool_unit}
              />
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
                // 子表单随卸载自动重置;这里只重置公共字段
                setWorkoutDate(todayYmd());
                setNotes("");
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
              {submitting ? "保存中..." : editingWorkout ? "更新记录" : copyingWorkout ? "保存副本" : "保存记录"}
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
