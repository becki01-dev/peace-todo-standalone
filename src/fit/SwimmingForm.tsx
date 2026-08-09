import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Sparkles, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DurationField,
  MoodField,
  PoolLengthPresets,
  StrokePicker,
  LEGACY_DEFAULT_UNITS,
  type WorkoutSubformHandle,
} from "./WorkoutFormFields";
import {
  poolInputToMeters,
  poolMetersToDisplay,
  formatDuration,
  formatNumber,
  hmsToSeconds,
} from "./units";
import type { Json } from "@/integrations/supabase/types";
import type { PoolUnit, SwimmingData, SwimmingMultiSet, SwimmingMultiSetData } from "./types";

interface Props {
  /** 编辑/复制模式下的原记录数据(旧单条数据或新多片段);新建时为 undefined */
  initialValues?: SwimmingData | SwimmingMultiSetData;
  /** 偏好默认单位(新建时使用) */
  initialUnit: PoolUnit;
}

const isMulti = (d?: SwimmingData | SwimmingMultiSetData): d is SwimmingMultiSetData =>
  !!d && "sets" in d && Array.isArray((d as SwimmingMultiSetData).sets);

/** 游泳子表单:多片段列表(泳姿/池长/圈数/片段时长) + 整体心情 */
export const SwimmingForm = forwardRef<WorkoutSubformHandle, Props>(function SwimmingForm(
  { initialValues, initialUnit },
  ref,
) {
  const [swimUnit, setSwimUnit] = useState<PoolUnit>(() => {
    if (!initialValues) return initialUnit;
    if (isMulti(initialValues)) return initialValues.sets[0]?.input_unit ?? initialUnit;
    return initialValues.input_unit ?? LEGACY_DEFAULT_UNITS.pool;
  });
  const [poolLen, setPoolLen] = useState(() => {
    if (!initialValues || isMulti(initialValues)) return "25";
    const unit = initialValues.input_unit ?? LEGACY_DEFAULT_UNITS.pool;
    return String(unit === "yd" ? initialValues.pool_length_meters * 1.09361 : initialValues.pool_length_meters);
  });
  const [laps, setLaps] = useState(() =>
    initialValues && !isMulti(initialValues) ? String(initialValues.laps) : "40",
  );
  const [swimStroke, setSwimStroke] = useState(() =>
    initialValues && !isMulti(initialValues) ? initialValues.stroke : "自由泳",
  );
  const [customSwimStroke, setCustomSwimStroke] = useState("");
  const [swimMood, setSwimMood] = useState(initialValues?.mood || 3);
  const [swimSets, setSwimSets] = useState<SwimmingMultiSet[]>(() => (isMulti(initialValues) ? initialValues.sets : []));
  const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
  const [segmentHours, setSegmentHours] = useState("0");
  const [segmentMinutes, setSegmentMinutes] = useState("");
  const [segmentSeconds, setSegmentSeconds] = useState("0");

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

  const swimSummary = useMemo(() => {
    const totalDistanceMeters = swimSets.reduce((sum, set) => sum + (set.pool_length_meters * set.laps), 0);
    const totalDurationSeconds = swimSets.reduce((sum, set) => sum + (set.duration_seconds || 0), 0);
    const totalDistanceDisplay = poolMetersToDisplay(totalDistanceMeters, swimUnit);

    return {
      totalDistanceMeters,
      totalDistanceDisplay,
      totalDurationSeconds,
      setCount: swimSets.length,
    };
  }, [swimSets, swimUnit]);

  // 点击片段进行编辑
  const editSet = (index: number) => {
    const set = swimSets[index];
    setEditingSetIndex(index);

    // 根据保存的input_unit，将米转换回用户输入的单位
    const inputUnit = set.input_unit || swimUnit;
    const displayValue = poolMetersToDisplay(set.pool_length_meters, inputUnit);
    setPoolLen(displayValue.toString());

    // 设置单位选择器
    setSwimUnit(inputUnit);

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
      input_unit: swimUnit, // 记录输入单位
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

  const cancelEdit = () => {
    setEditingSetIndex(null);
    setLaps("40");
    setSwimStroke("自由泳");
    setCustomSwimStroke("");
    setSegmentHours("0");
    setSegmentMinutes("");
    setSegmentSeconds("0");
  };

  useImperativeHandle(ref, () => ({
    buildData: (): { ok: true; data: Json } | { ok: false; error: string } => {
      // 统一使用多片段格式
      if (swimSets.length === 0) return { ok: false, error: "请至少添加一个游泳片段" };

      const totalDistanceMeters = swimSets.reduce((sum, set) => {
        return sum + (set.pool_length_meters * set.laps);
      }, 0);
      const totalDurationSeconds = swimSets.reduce((sum, set) => {
        return sum + (set.duration_seconds || 0);
      }, 0);

      return {
        ok: true,
        data: {
          sets: swimSets.map((set) => ({
            ...set,
            // 保留每个片段自己的input_unit，如果不存在则使用当前swimUnit
            input_unit: set.input_unit || swimUnit,
          })),
          total_distance_meters: totalDistanceMeters,
          total_duration_seconds: totalDurationSeconds,
          mood: swimMood,
        },
      };
    },
  }));

  return (
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
                  key={`${set.stroke}-${set.pool_length_meters}-${set.laps}-${idx}`}
                  className={cn(
                    "flex items-center justify-between bg-fit-surface rounded px-2 py-1.5 text-xs transition-smooth",
                    editingSetIndex === idx ? "border border-fit-accent" : "",
                  )}
                >
                  <div className="flex-1 cursor-pointer" onClick={() => editSet(idx)}>
                    <span className="text-fit-foreground font-medium">{set.stroke}</span>
                    <span className="text-fit-muted ml-2">
                      {set.laps}圈 × {formatNumber(poolMetersToDisplay(set.pool_length_meters, set.input_unit || swimUnit), 0)} {set.input_unit || swimUnit}
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
          <StrokePicker
            value={swimStroke}
            onChange={setSwimStroke}
            custom={{ value: customSwimStroke, onChange: setCustomSwimStroke }}
          />
        </div>

        <div>
          <Label className="text-fit-muted text-xs mb-2 block">泳池长度</Label>
          <PoolLengthPresets
            value={poolLen}
            unit={swimUnit}
            onSelect={(v, u) => {
              setSwimUnit(u);
              setPoolLen(v);
            }}
          />
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
          className="w-full bg-fit-accent text-fit-accent-foreground hover:bg-fit-accent/90"
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
            onClick={cancelEdit}
            className="w-full text-fit-muted hover:text-fit-foreground"
          >
            取消编辑
          </Button>
        )}
      </div>

      <MoodField label="整体心情" value={swimMood} onChange={setSwimMood} />
    </>
  );
});
