import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Task, TaskFilter, Priority } from "@/types/task";
import { TaskItem } from "@/components/TaskItem";
import { TaskDialog } from "@/components/TaskDialog";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, CheckCircle2, Trash, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FILTERS: { value: TaskFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待办" },
  { value: "completed", label: "已完成" },
];

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, signOut } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("is_completed", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("加载任务失败");
      } else {
        setTasks((data ?? []) as Task[]);
      }
    } catch {
      toast.error("加载任务失败");
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true, state: { from: `${location.pathname}${location.search}` } });
    }
  }, [user, authLoading, navigate, location.pathname, location.search]);

  useEffect(() => {
    if (!user) return;
    fetchTasks();
  }, [user, fetchTasks]);

  useEffect(() => {
    localStorage.setItem("zen:lastModule", "task");
    localStorage.setItem("zen:lastHint", "上次你在整理待办，点击快速继续");
  }, []);

  const handleCreateOrUpdate = async (data: {
    title: string;
    description: string;
    priority: Priority;
    due_date: Date | null;
  }): Promise<void> => {
    if (!user) return;
    const payload = {
      title: data.title,
      description: data.description || null,
      priority: data.priority,
      due_date: data.due_date ? data.due_date.toISOString() : null,
    };

    if (editing) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", editing.id);
      if (error) {
        toast.error("更新失败");
        return;
      }
      toast.success("任务已更新");
    } else {
      const { error } = await supabase.from("tasks").insert({ ...payload, user_id: user.id });
      if (error) {
        toast.error("创建失败");
        return;
      }
      toast.success("任务已添加");
    }
    setEditing(null);
    fetchTasks();
  };

  const handleToggle = async (task: Task) => {
    const next = !task.is_completed;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, is_completed: next } : t)));
    const { error } = await supabase.from("tasks").update({ is_completed: next }).eq("id", task.id);
    if (error) {
      toast.error("操作失败");
      fetchTasks();
    }
  };

  const handleDelete = async (task: Task) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      toast.error("删除失败");
      fetchTasks();
    } else {
      toast.success("任务已删除");
    }
  };

  const handleClearCompleted = async () => {
    if (!user) return;
    const completed = tasks.filter((t) => t.is_completed);
    if (completed.length === 0) return;
    const { error } = await supabase.from("tasks").delete().eq("user_id", user.id).eq("is_completed", true);
    if (error) return toast.error("清空失败");
    toast.success(`已清空 ${completed.length} 个已完成任务`);
    fetchTasks();
  };

  const filtered = useMemo(() => {
    if (filter === "pending") return tasks.filter((t) => !t.is_completed);
    if (filter === "completed") return tasks.filter((t) => t.is_completed);
    return tasks;
  }, [tasks, filter]);

  const completedCount = tasks.filter((t) => t.is_completed).length;

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link
              to="/"
              className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-smooth mr-1"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
              返回主页
            </Link>
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-accent-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">ZenTask</h1>
              <p className="text-xs text-muted-foreground leading-tight">{user.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="退出登录">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-3">
          <div className="flex gap-1 p-1 bg-secondary rounded-lg" role="tablist" aria-label="任务筛选">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                role="tab"
                aria-selected={filter === f.value}
                className={cn(
                  "flex-1 py-1.5 text-sm font-medium rounded-md transition-smooth",
                  filter === f.value ? "bg-surface shadow-card text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
                {f.value === "completed" && completedCount > 0 && (
                  <span className="ml-1.5 text-xs opacity-70">{completedCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-4">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-surface shadow-card animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            message={
              filter === "completed"
                ? "还没有完成的任务"
                : filter === "pending"
                ? "全部完成啦,放松一下吧 🎉"
                : "暂无任务,开启高效一天吧"
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={handleToggle}
                onEdit={(t) => {
                  setEditing(t);
                  setDialogOpen(true);
                }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {completedCount > 0 && filter !== "pending" && (
          <div className="flex justify-center mt-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearCompleted}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash className="w-4 h-4 mr-1.5" />
              清空已完成 ({completedCount})
            </Button>
          </div>
        )}
      </main>

      <button
        onClick={() => {
          setEditing(null);
          setDialogOpen(true);
        }}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-14 h-14 rounded-full bg-accent text-accent-foreground shadow-fab flex items-center justify-center transition-spring hover:scale-105 active:scale-95 z-30"
        aria-label="添加任务"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        initial={editing}
        onSubmit={handleCreateOrUpdate}
      />
    </div>
  );
};

export default Index;
