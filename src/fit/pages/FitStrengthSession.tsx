import { Component, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { StrengthForm } from "../StrengthForm";
import type { StrengthFormMode } from "../StrengthForm";
import type { Workout } from "../types";

/** 表单崩溃时显示错误信息而不是整页白屏(手机上没有 devtools,白屏无法排查) */
class FormErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 rounded-xl bg-fit-card border border-fit-border space-y-3 text-center">
          <p className="text-sm font-semibold text-fit-foreground">表单出错了</p>
          <p className="text-xs text-fit-muted break-all">{String(this.state.error)}</p>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="bg-fit-surface border-fit-border text-fit-foreground"
          >
            重新加载
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const FitStrengthSession = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { onWorkoutSaved } = useOutletContext<{ onWorkoutSaved: () => void }>();
  const editId = searchParams.get("edit");
  const copyId = searchParams.get("copy");
  const mode: StrengthFormMode = editId ? "edit" : copyId ? "copy" : "create";
  const [initialWorkout, setInitialWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(mode !== "create");

  useEffect(() => {
    if (mode === "create") return;
    const id = editId ?? copyId;
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("workouts")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error || !data) {
          toast.error("记录不存在或无法加载");
          navigate("/fit", { replace: true });
          return;
        }
        setInitialWorkout(data as unknown as Workout);
      });
    return () => {
      cancelled = true;
    };
  }, [editId, copyId, mode, navigate]);

  const handleSaved = () => {
    onWorkoutSaved();
    navigate("/fit");
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-fit-muted text-sm">
        加载中...
      </div>
    );
  }

  return (
    <FormErrorBoundary>
      <StrengthForm mode={mode} initialWorkout={initialWorkout ?? undefined} onSaved={handleSaved} />
    </FormErrorBoundary>
  );
};

export default FitStrengthSession;
