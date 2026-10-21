import { Link } from "@tanstack/react-router";
import { Moon, Sun, Leaf } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { CLINIC } from "@/lib/clinic";

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  };
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="تغيير الوضع">
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

const linkCls = "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground";
const activeCls = "bg-primary-soft text-foreground";

export function SiteHeader() {
  const { user, isAdmin } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Leaf className="size-5" />
          </span>
          <span className="font-display text-lg font-bold">{CLINIC.name}</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {user ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={isAdmin ? "/admin" : "/dashboard"}>لوحتي</Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link to="/auth">دخول الأطباء</Link>
            </Button>
          )}
        </div>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
        <Link to="/" className={linkCls} activeProps={{ className: activeCls }} activeOptions={{ exact: true }}>
          الرئيسية
        </Link>
        <Link to="/doctors" className={linkCls} activeProps={{ className: activeCls }}>
          الأطباء
        </Link>
        <Link to="/track" className={linkCls} activeProps={{ className: activeCls }}>
          تابع حجزك
        </Link>
        {user && (
          <Link to="/dashboard" className={linkCls} activeProps={{ className: activeCls }}>
            لوحة الطبيب
          </Link>
        )}
        {isAdmin && (
          <Link to="/admin" className={linkCls} activeProps={{ className: activeCls }}>
            لوحة المالك
          </Link>
        )}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <span>{CLINIC.name} — {CLINIC.address}</span>
        <a href={`tel:${CLINIC.phone}`} dir="ltr" className="hover:text-foreground">
          {CLINIC.phone}
        </a>
      </div>
    </footer>
  );
}
