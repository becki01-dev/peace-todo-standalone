import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowRight, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Dashboard = () => {
  const quickEntry = useMemo(() => {
    const module = localStorage.getItem("zen:lastModule");
    const hint = localStorage.getItem("zen:lastHint");

    if (module === "fit") {
      return {
        to: "/fit",
        hint: hint ?? "上次你在记录游泳，点击快速继续",
      };
    }

    if (module === "task") {
      return {
        to: "/task",
        hint: hint ?? "上次你在整理待办，点击快速继续",
      };
    }

    return {
      to: "/task",
      hint: "首次使用？从 ZenTask 开始会更轻松",
    };
  }, []);

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            选择你现在要进入的模块
          </p>
          <Link
            to={quickEntry.to}
            className="mt-3 inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-smooth"
          >
            {quickEntry.hint}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="relative overflow-hidden p-5 shadow-card border-border/60">
            <div className="pointer-events-none absolute -top-14 -right-16 h-36 w-36 rounded-full bg-accent/25 blur-2xl" />
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
                <CheckCircle2 className="h-5 w-5 text-accent-foreground" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-lg font-semibold leading-tight">ZenTask</h2>
                <p className="text-xs text-muted-foreground">任务管理与每日待办</p>
              </div>
            </div>
            <Button asChild className="w-full">
              <Link to="/task">
                进入 ZenTask
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </Card>

          <Card className="relative overflow-hidden p-5 shadow-card border-border/60">
            <div className="pointer-events-none absolute -top-14 -right-16 h-36 w-36 rounded-full bg-fit-accent/25 blur-2xl" />
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fit-accent text-fit-accent-foreground">
                <Flame className="h-5 w-5" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-lg font-semibold leading-tight">ZenFit</h2>
                <p className="text-xs text-muted-foreground">训练记录与数据统计</p>
              </div>
            </div>
            <Button asChild className="w-full">
              <Link to="/fit">进入 ZenFit</Link>
            </Button>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default Dashboard;
