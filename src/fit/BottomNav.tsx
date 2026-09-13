import { NavLink, useLocation } from "react-router-dom";
import { History, BarChart3, Settings, Plus, Dumbbell, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItemDef {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

// 2+2 对称:历史 / 统计 | FAB | 动作 / 设置
const items: NavItemDef[] = [
  { to: "/fit", icon: History, label: "历史", end: true },
  { to: "/fit/stats", icon: BarChart3, label: "统计" },
  { to: "/fit/library", icon: Dumbbell, label: "动作" },
  { to: "/fit/settings", icon: Settings, label: "设置" },
];

export const BottomNav = ({ onAdd }: { onAdd: () => void }) => {
  const location = useLocation();
  // hide nav on /fit/auth
  if (location.pathname.startsWith("/fit/auth") || location.pathname.startsWith("/fit/strength/session")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 fit-bottom-nav">
      <div className="max-w-2xl mx-auto px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around relative h-16">
          {items.slice(0, 2).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="flex-1">
              {({ isActive }) => <NavItem icon={item.icon} label={item.label} active={isActive} />}
            </NavLink>
          ))}
          {/* center FAB */}
          <button
            onClick={onAdd}
            aria-label="开始运动"
            className="relative -top-5 w-14 h-14 rounded-full bg-fit-accent text-fit-accent-foreground shadow-fit-glow flex items-center justify-center transition-spring hover:scale-105 active:scale-95"
          >
            <Plus className="w-7 h-7" strokeWidth={3} />
          </button>
          {items.slice(2).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="flex-1">
              {({ isActive }) => <NavItem icon={item.icon} label={item.label} active={isActive} />}
            </NavLink>
          ))}
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
  icon: LucideIcon;
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
