// 对话框三种运动类型的共享小组件与子表单契约
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";
import type { DistanceUnit, PoolUnit } from "./types";

// 旧数据的默认单位(没有 input_unit 字段时使用)
// eslint-disable-next-line react-refresh/only-export-components -- 组件与常量同文件是项目惯例,改动时降级为全量刷新
export const LEGACY_DEFAULT_UNITS = {
  distance: "mi" as DistanceUnit, // 跑步默认 mi
  pool: "yd" as PoolUnit, // 游泳默认 yd
};

/** 子表单对外契约:提交时由对话框询问数据载荷;ok=false 时 error 为校验提示 */
export type WorkoutSubformHandle = {
  buildData: () => { ok: true; data: Json } | { ok: false; error: string };
};

export const MoodField = ({
  label = "心情",
  value,
  onChange,
}: {
  label?: string;
  value: number;
  onChange: (n: number) => void;
}) => (
  <div>
    <Label className="text-fit-muted text-xs mb-2 block">{label}</Label>
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            "flex-1 h-10 rounded-lg text-lg transition-smooth",
            value === n
              ? "bg-fit-accent text-fit-accent-foreground"
              : "bg-fit-surface text-fit-muted hover:text-fit-foreground",
          )}
        >
          {["😞", "😕", "😐", "🙂", "🤩"][n - 1]}
        </button>
      ))}
    </div>
  </div>
);

export const DistanceField = ({
  label,
  value,
  onChange,
  unit,
  onUnit,
  units,
  disabled,
  displayValue,
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

export const DurationField = ({
  h,
  m,
  s,
  setH,
  setM,
  setS,
}: {
  h: string;
  m: string;
  s: string;
  setH: (v: string) => void;
  setM: (v: string) => void;
  setS: (v: string) => void;
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

const STROKES = ["自由泳", "蛙泳", "仰泳", "蝶泳", "混合泳"];

const POOL_LENGTH_PRESETS = [
  { value: "50", unit: "m" },
  { value: "100", unit: "m" },
  { value: "200", unit: "m" },
  { value: "50", unit: "yd" },
  { value: "100", unit: "yd" },
  { value: "200", unit: "yd" },
];

/** 泳姿选择;传 custom 时多出"自定义"选项与输入框(专项游泳组不需要) */
export const StrokePicker = ({
  value,
  onChange,
  custom,
}: {
  value: string;
  onChange: (v: string) => void;
  custom?: { value: string; onChange: (v: string) => void };
}) => (
  <>
    <div className="flex flex-wrap gap-2">
      {STROKES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-semibold transition-smooth border",
            value === option
              ? "bg-fit-accent text-fit-accent-foreground border-fit-accent"
              : "bg-fit-surface text-fit-muted border-fit-border hover:text-fit-foreground",
          )}
        >
          {option}
        </button>
      ))}
      {custom && (
        <button
          type="button"
          onClick={() => onChange("__custom__")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-semibold transition-smooth border",
            value === "__custom__"
              ? "bg-fit-accent text-fit-accent-foreground border-fit-accent"
              : "bg-fit-surface text-fit-muted border-fit-border hover:text-fit-foreground",
          )}
        >
          自定义
        </button>
      )}
    </div>
    {custom && value === "__custom__" && (
      <Input
        value={custom.value}
        onChange={(e) => custom.onChange(e.target.value)}
        placeholder="如: 自由泳打腿 / 窄手仰泳练习"
        className="mt-2 bg-fit-surface border-fit-border text-fit-foreground"
      />
    )}
  </>
);

/** 泳池长度预设按钮行;compact 为专项游泳组的小尺寸样式 */
export const PoolLengthPresets = ({
  value,
  unit,
  onSelect,
  compact = false,
}: {
  value: string;
  unit: string;
  onSelect: (v: string, u: PoolUnit) => void;
  compact?: boolean;
}) => (
  <div className={cn("flex flex-wrap", compact ? "gap-1 mb-1.5" : "gap-2 mb-2")}>
    {POOL_LENGTH_PRESETS.map((preset) => (
      <button
        key={`${preset.value}${preset.unit}`}
        type="button"
        onClick={() => onSelect(preset.value, preset.unit as PoolUnit)}
        className={cn(
          "rounded-md font-semibold transition-smooth border",
          compact ? "px-2 py-1 rounded text-[10px]" : "px-3 py-1.5 rounded-md text-xs",
          value === preset.value && unit === preset.unit
            ? "bg-fit-accent text-fit-accent-foreground border-fit-accent"
            : "bg-fit-surface text-fit-muted border-fit-border hover:text-fit-foreground",
        )}
      >
        {preset.value}
        {preset.unit}
      </button>
    ))}
  </div>
);
