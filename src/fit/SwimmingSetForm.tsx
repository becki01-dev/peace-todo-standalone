import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Target, Trash2, Plus } from "lucide-react";
import {
  PoolLengthPresets,
  StrokePicker,
  LEGACY_DEFAULT_UNITS,
  type WorkoutSubformHandle,
} from "./WorkoutFormFields";
import { metersToYards, yardsToMeters } from "./units";
import type { Json } from "@/integrations/supabase/types";
import type { PoolUnit, SwimmingSetData, SwimmingSetItem } from "./types";

interface Props {
  /** 编辑/复制模式下的原记录数据;新建时为 undefined */
  initialValues?: SwimmingSetData;
  /** 偏好默认池长单位(新建训练组时使用) */
  initialPoolUnit: PoolUnit;
}

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

/** 专项游泳组子表单:训练组列表(组数/个数/长度/泳姿/要求时间/完成数) */
export const SwimmingSetForm = forwardRef<WorkoutSubformHandle, Props>(function SwimmingSetForm(
  { initialValues, initialPoolUnit },
  ref,
) {
  const [swimmingSets, setSwimmingSets] = useState<SwimmingSetItemInput[]>(() => {
    if (!initialValues) return [];
    // 优先使用保存的输入单位，如果没有则使用旧数据默认单位（yd）
    const inputUnit = initialValues.input_unit || LEGACY_DEFAULT_UNITS.pool;
    return initialValues.sets.map((set, idx) => {
      const lengthInMeters = set.length_meters;
      // 优先使用每个训练组保存的单位，如果没有则使用整体单位
      const displayUnit = set.input_unit || inputUnit;
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
  });

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

  // 添加专项游泳组
  const addSwimmingSet = () => {
    const newSet: SwimmingSetItemInput = {
      id: `swim-set-${Date.now()}`,
      setsCount: "",
      countPerSet: "",
      length: "",
      lengthUnit: initialPoolUnit,
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

  useImperativeHandle(ref, () => ({
    buildData: (): { ok: true; data: Json } | { ok: false; error: string } => {
      // 专项游泳组
      if (swimmingSets.length === 0) return { ok: false, error: "请至少添加一个训练组" };

      // 验证所有字段都已填写
      for (const set of swimmingSets) {
        if (!set.setsCount || !set.countPerSet || !set.length || !set.stroke || !set.targetMinutes || !set.targetSeconds || !set.completedCount) {
          return { ok: false, error: "请填写所有训练组的完整信息" };
        }
      }

      // 构建训练组数据(转换为米和秒)
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
          input_unit: set.lengthUnit, // 记录每个训练组的输入单位
        };
      });

      // 计算汇总数据
      const totalRequiredCount = sets.reduce((sum, set) => sum + (set.sets_count * set.count_per_set), 0);
      const totalCompletedCount = sets.reduce((sum, set) => sum + (set.completed_count ?? 0), 0);
      const completionRate = totalRequiredCount > 0 ? (totalCompletedCount / totalRequiredCount) * 100 : 0;

      return {
        ok: true,
        data: {
          sets,
          total_required_count: totalRequiredCount,
          total_completed_count: totalCompletedCount,
          completion_rate: Math.min(completionRate, 100),
          input_unit: swimmingSets[0]?.lengthUnit || initialPoolUnit, // 记录整体输入单位
        },
      };
    },
  }));

  return (
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
                swimSetSummary.completionRate >= 80 ? "text-yellow-500" : "text-red-500",
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
                <StrokePicker value={set.stroke} onChange={(v) => updateSwimmingSet(set.id, "stroke", v)} />
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
                  <PoolLengthPresets
                    compact
                    value={set.length}
                    unit={set.lengthUnit}
                    onSelect={(v, u) => {
                      setSwimmingSets(swimmingSets.map((s) =>
                        s.id === set.id
                          ? { ...s, length: v, lengthUnit: u }
                          : s,
                      ));
                    }}
                  />
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
  );
});
