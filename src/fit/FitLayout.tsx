import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PreferencesProvider } from "./usePreferences";
import { BottomNav } from "./BottomNav";
import { WorkoutDialog } from "./WorkoutDialog";
import { ChevronLeft, Flame } from "lucide-react";

const TITLES: Record<string, string> = {
  "/fit": "历史记录",
  "/fit/stats": "数据统计",
  "/fit/settings": "个人设置",
};

const FitLayoutInner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true, state: { from: `${location.pathname}${location.search}` } });
    }
  }, [user, loading, navigate, location.pathname, location.search]);

  useEffect(() => {
    localStorage.setItem("zen:lastModule", "fit");
    localStorage.setItem("zen:lastHint", "上次你在记录游泳，点击快速继续");
  }, [location.pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-fit-bg flex items-center justify-center">
        <div className="text-fit-muted text-sm">加载中...</div>
      </div>
    );
  }

  const title = TITLES[location.pathname] ?? "ZenFit";

  return (
    <div className="min-h-screen bg-fit-bg text-fit-foreground pb-28">
      <header className="sticky top-0 z-20 bg-fit-bg/85 backdrop-blur-xl border-b border-fit-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link
              to="/"
              className="inline-flex items-center text-xs text-fit-muted hover:text-fit-foreground transition-smooth mr-1"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
              返回主页
            </Link>
            <div className="w-9 h-9 rounded-xl bg-fit-accent text-fit-accent-foreground flex items-center justify-center">
              <Flame className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">ZenFit</h1>
              <p className="text-[11px] text-fit-muted leading-tight">{title}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5">
        <Outlet context={{ reloadKey }} />
      </main>

      <BottomNav onAdd={() => setDialogOpen(true)} />

      <WorkoutDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
};

const FitLayout = () => (
  <PreferencesProvider>
    <FitLayoutInner />
  </PreferencesProvider>
);

export default FitLayout;
