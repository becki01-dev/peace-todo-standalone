import { NavLink, useLocation } from "react-router-dom";
import { History, BarChart3, Settings, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/fit", icon: History, label: "历史", end: true },
  { to: "/fit/stats", icon: BarChart3, label: "统计" },
  { to: "/fit/settings", icon: Settings, label: "设置" },
];

export const BottomNav = ({ onAdd }: { onAdd: () => void }) => {
  const location = useLocation();
  // hide nav on /fit/auth
  if (location.pathname.startsWith("/fit/auth")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 fit-bottom-nav">
      <div className="max-w-2xl mx-auto px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around relative h-16">
          <NavLink to={items[0].to} end={items[0].end} className="flex-1">
            {({ isActive }) => (
              <NavItem icon={History} label="历史" active={isActive} />
            )}
          </NavLink>
          <NavLink to={items[1].to} className="flex-1">
            {({ isActive }) => (
              <NavItem icon={BarChart3} label="统计" active={isActive} />
            )}
          </NavLink>
          {/* center FAB */}
          <button
            onClick={onAdd}
            aria-label="开始运动"
            className="relative -top-5 w-14 h-14 rounded-full bg-fit-accent text-fit-accent-foreground shadow-fit-glow flex items-center justify-center transition-spring hover:scale-105 active:scale-95"
          >
            <Plus className="w-7 h-7" strokeWidth={3} />
          </button>
          <NavLink to={items[2].to} className="flex-1">
            {({ isActive }) => (
              <NavItem icon={Settings} label="设置" active={isActive} />
            )}
          </NavLink>
          <div className="flex-1" />
        </div>
      </div>
    </nav>
  );
};

const NavItem = ({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  active: boolean;
}) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-0.5 py-2 transition-smooth",
      active ? "text-fit-accent" : "text-muted-foreground",
    )}
  >
    <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
    <span className="text-[10px] font-medium tracking-wide">{label}</span>
  </div>
);
