import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Footprints, Waves, Dumbbell, type LucideIcon } from "lucide-react";
import { WorkoutType, DistanceUnit, PoolUnit, WeightUnit } from "./types";
import {
  distanceInputToMeters,
  hmsToSeconds,
  poolInputToMeters,
  weightInputToKg,
} from "./units";
import { usePreferences } from "./usePreferences";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

export const WorkoutDialog = ({ open, onOpenChange, onSaved }: Props) => {
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
  const [swimDistance, setSwimDistance] = useState("");
  const [swimUnit, setSwimUnit] = useState<PoolUnit>(prefs.pool_unit);
  const [poolLen, setPoolLen] = useState("25");

  // strength
  const [exercise, setExercise] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(prefs.weight_unit);
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");

  useEffect(() => {
    if (!open) {
      // reset on close
      setTimeout(() => {
        setType(null);
        setWorkoutDate(todayYmd());
        setNotes("");
        setHours("0"); setMinutes(""); setSeconds("0");
        setRunDistance(""); setMood(3);
        setSwimDistance(""); setPoolLen("25");
        setExercise(""); setWeight(""); setIsBodyweight(false); setSets(""); setReps("");
      }, 200);
    } else {
      setRunUnit(prefs.distance_unit);
      setSwimUnit(prefs.pool_unit);
      setWeightUnit(prefs.weight_unit);
    }
  }, [open, prefs]);

  const handleSubmit = async () => {
    if (!user || !type) return;
    setSubmitting(true);

    let data: Record<string, number | string> = {};
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
      const d = parseFloat(swimDistance);
      const pl = parseFloat(poolLen);
      const dur = hmsToSeconds(+hours, +minutes, +seconds);
      if (!d || !pl || !dur) {
        toast.error("请填写距离、泳池长度和时长");
        setSubmitting(false);
        return;
      }
      data = {
        distance_meters: poolInputToMeters(d, swimUnit),
        pool_length_meters: poolInputToMeters(pl, swimUnit),
        duration_seconds: dur,
      };
    } else if (type === "strength") {
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

    const selectedDate = new Date(`${workoutDate}T12:00:00`);
    if (Number.isNaN(selectedDate.getTime())) {
      toast.error("请选择有效日期");
      setSubmitting(false);
      return;
    }
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
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-fit-card border-fit-border text-fit-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-fit-foreground">
            {type ? `记录 ${typeLabel(type)}` : "选择运动类型"}
          </DialogTitle>
        </DialogHeader>

        {!type ? (
          <div className="grid grid-cols-3 gap-3 py-2">
            <TypeButton icon={Footprints} label="跑步" onClick={() => setType("running")} />
            <TypeButton icon={Waves} label="游泳" onClick={() => setType("swimming")} />
            <TypeButton icon={Dumbbell} label="力量" onClick={() => setType("strength")} />
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
                <DistanceField
                  label="距离"
                  value={swimDistance}
                  onChange={setSwimDistance}
                  unit={swimUnit}
                  onUnit={(u) => setSwimUnit(u as PoolUnit)}
                  units={["m", "yd"]}
                />
                <div>
                  <Label className="text-fit-muted text-xs mb-2 block">泳池长度 ({swimUnit})</Label>
                  <Input
                    inputMode="decimal"
                    value={poolLen}
                    onChange={(e) => setPoolLen(e.target.value)}
                    className="bg-fit-surface border-fit-border text-fit-foreground"
                  />
                </div>
                <DurationField h={hours} m={minutes} s={seconds} setH={setHours} setM={setMinutes} setS={setSeconds} />
              </>
            )}

            {type === "strength" && (
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
              onClick={() => setType(null)}
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
              {submitting ? "保存中..." : "保存记录"}
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
