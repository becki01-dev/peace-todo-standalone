import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "../usePreferences";
import { DistanceUnit, PoolUnit, WeightUnit } from "../types";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, LogOut, Ruler, Dumbbell, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildExportPayload, downloadJson } from "../exportData";
import { todayYmd } from "../dates";
import type { Task } from "@/types/task";
import type { Workout } from "../types";

const FitSettings = () => {
  const { user, signOut } = useAuth();
  const { prefs, update } = usePreferences();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const [tasksRes, workoutsRes, prefsRes] = await Promise.all([
        supabase.from("tasks").select("*").eq("user_id", user.id),
        supabase.from("workouts").select("*").eq("user_id", user.id).order("date", { ascending: true }),
        supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      if (tasksRes.error || workoutsRes.error || prefsRes.error) {
        throw new Error("读取数据失败");
      }
      downloadJson(
        `peace-data-${todayYmd()}.json`,
        buildExportPayload(
          {
            tasks: (tasksRes.data ?? []) as unknown as Task[],
            workouts: (workoutsRes.data ?? []) as unknown as Workout[],
            preferences: (prefsRes.data ?? null) as Record<string, unknown> | null,
          },
          user,
          new Date().toISOString(),
        ),
      );
      toast.success("数据已导出");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

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

      <section>
        <h2 className="text-xs font-semibold text-fit-muted uppercase tracking-wider mb-3 px-1">数据</h2>
        <div className="p-4 rounded-xl bg-fit-card border border-fit-border space-y-2">
          <Button
            onClick={handleExport}
            disabled={exporting}
            variant="outline"
            className="w-full bg-fit-surface border-fit-border text-fit-foreground hover:bg-fit-surface/80"
          >
            <Download className="w-4 h-4 mr-2" />
            {exporting ? "导出中..." : "导出全部数据 (JSON)"}
          </Button>
          <p className="text-xs text-fit-muted">
            包含任务、训练记录与偏好设置(原始公制数据),用于备份或迁移。
          </p>
        </div>
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
        <Link to="/" className="hover:text-fit-accent">← 返回 ZenTask</Link>
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
