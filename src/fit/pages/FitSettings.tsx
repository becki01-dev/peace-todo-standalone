import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "../usePreferences";
import { DistanceUnit, PoolUnit, WeightUnit } from "../types";
import { Button } from "@/components/ui/button";
import { LogOut, Ruler, Dumbbell, Waves } from "lucide-react";
import { cn } from "@/lib/utils";

const FitSettings = () => {
  const { user, signOut } = useAuth();
  const { prefs, update } = usePreferences();

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-fit-card border border-fit-border">
        <div className="text-xs text-fit-muted uppercase tracking-wider mb-1">账号</div>
        <div className="text-sm text-fit-foreground truncate">{user?.email}</div>
      </div>

      <section>
        <h2 className="text-xs font-semibold text-fit-muted uppercase tracking-wider mb-3 px-1">显示偏好</h2>
        <div className="space-y-2">
          <PrefRow
            icon={Ruler}
            label="距离"
            value={prefs.distance_unit}
            options={["km", "mi"]}
            onChange={(v) => update({ distance_unit: v as DistanceUnit })}
          />
          <PrefRow
            icon={Dumbbell}
            label="重量"
            value={prefs.weight_unit}
            options={["kg", "lb"]}
            onChange={(v) => update({ weight_unit: v as WeightUnit })}
          />
          <PrefRow
            icon={Waves}
            label="泳池"
            value={prefs.pool_unit}
            options={["m", "yd"]}
            onChange={(v) => update({ pool_unit: v as PoolUnit })}
          />
        </div>
        <p className="text-xs text-fit-muted mt-3 px-1">
          数据始终以公制存储,仅改变历史列表的显示单位。
        </p>
      </section>

      <Button
        onClick={signOut}
        variant="outline"
        className="w-full bg-fit-card border-fit-border text-fit-foreground hover:bg-fit-surface hover:text-destructive"
      >
        <LogOut className="w-4 h-4 mr-2" />
        退出登录
      </Button>

      <p className="text-center text-xs text-fit-muted">
        <a href="/" className="hover:text-fit-accent">← 返回 ZenTask</a>
      </p>
    </div>
  );
};

const PrefRow = ({
  icon: Icon, label, value, options, onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) => (
  <div className="flex items-center gap-3 p-4 rounded-xl bg-fit-card border border-fit-border">
    <Icon className="w-4 h-4 text-fit-muted" />
    <span className="flex-1 text-sm text-fit-foreground">{label}</span>
    <div className="flex bg-fit-surface border border-fit-border rounded-md p-0.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            "px-3 py-1 text-xs font-semibold rounded-sm transition-smooth",
            value === o ? "bg-fit-accent text-fit-accent-foreground" : "text-fit-muted",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  </div>
);

export default FitSettings;
