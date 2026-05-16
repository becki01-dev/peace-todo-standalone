import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flame } from "lucide-react";
import { toast } from "sonner";

type AuthLocationState = {
  from?: string;
};

const FitAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const from = (() => {
    const raw = (location.state as AuthLocationState | null)?.from;
    if (raw && (raw.startsWith("/fit") || raw.startsWith("/task") || raw === "/")) {
      return raw;
    }
    return "/fit";
  })();

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, navigate, from]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) toast.error(error.message);
        else toast.success("注册成功,开始记录!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) toast.error(error.message);
      }
    } catch {
      toast.error("操作失败,请重试");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-fit-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-fit-accent text-fit-accent-foreground flex items-center justify-center mb-3 shadow-fit-glow">
            <Flame className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-fit-foreground">ZenFit</h1>
          <p className="text-sm text-fit-muted mt-1">硬核记录每一滴汗水</p>
        </div>

        <form onSubmit={submit} className="space-y-3 p-6 rounded-2xl bg-fit-card border border-fit-border">
          <Input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-fit-surface border-fit-border text-fit-foreground"
          />
          <Input
            type="password"
            placeholder="密码 (至少6位)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="bg-fit-surface border-fit-border text-fit-foreground"
          />
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-fit-accent text-fit-accent-foreground hover:bg-fit-accent/90 font-semibold"
          >
            {loading ? "..." : mode === "signin" ? "登录" : "注册"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-xs text-fit-muted hover:text-fit-accent transition-smooth pt-1"
          >
            {mode === "signin" ? "没有账号? 立即注册" : "已有账号? 登录"}
          </button>
        </form>

        <p className="text-center mt-6">
          <Link to="/" className="text-xs text-fit-muted hover:text-fit-accent">← 返回主页</Link>
        </p>
      </div>
    </div>
  );
};

export default FitAuth;
