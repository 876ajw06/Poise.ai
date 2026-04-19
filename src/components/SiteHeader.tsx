import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function SiteHeader() {
  const { user, profile, signOut } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();

  const navClass = (active: boolean) =>
    `text-sm font-medium px-4 py-2 rounded-full transition-colors ${
      active ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="container flex items-center justify-between h-16 md:h-[4.25rem]">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="font-display text-xl md:text-2xl font-extrabold tracking-tight text-foreground lowercase inline-flex items-center gap-1.5">
            poise
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-hidden />
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline font-sans font-normal normal-case tracking-normal">
            interview coach
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          {!user && (
            <>
              <Link to="/#how" className={`${navClass(false)} hidden md:inline-flex`}>
                How it works
              </Link>
              <Link to="/leaderboard" className={navClass(loc.pathname === "/leaderboard")}>
                Leaderboard
              </Link>
              <Link to="/auth" className={navClass(loc.pathname === "/auth")}>
                Sign in
              </Link>
              <Button asChild size="sm" className="ml-1 shadow-sm">
                <Link to="/auth?mode=signup">Get started free</Link>
              </Button>
            </>
          )}
          {user && (
            <>
              <Link to="/dashboard" className={`${navClass(loc.pathname === "/dashboard")} hidden sm:inline-flex`}>
                Dashboard
              </Link>
              <Link to="/leaderboard" className={navClass(loc.pathname === "/leaderboard")}>
                Leaderboard
              </Link>
              <Link to="/interview" className={`${navClass(loc.pathname.startsWith("/interview"))} hidden md:inline-flex`}>
                Live interview
              </Link>
              <Link to="/practice" className={navClass(loc.pathname === "/practice")}>
                Practice
              </Link>
              <Link to="/settings" className={`${navClass(loc.pathname === "/settings")} hidden lg:inline-flex`}>
                Settings
              </Link>
              {profile?.is_pro ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-gradient-pro text-primary-foreground shadow-sm">
                  <Sparkles className="h-3 w-3" /> PRO
                </span>
              ) : (
                <Link
                  to="/pro"
                  className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-soft text-primary border border-primary/15 hover:bg-primary/10 transition-colors"
                >
                  <Sparkles className="h-3 w-3" /> Go Pro
                </Link>
              )}
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => signOut().then(() => navigate("/"))}>
                Sign out
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
