import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function SiteHeader() {
  const { user, profile, signOut } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-ink flex items-center justify-center text-primary-foreground font-display text-lg">P</div>
          <span className="font-display text-xl tracking-tight">Poise</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">/ interview coach</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3">
          {user && (
            <>
              <Link to="/dashboard" className={`text-sm px-3 py-2 rounded-md hover:bg-secondary transition-colors ${loc.pathname === "/dashboard" ? "text-foreground" : "text-muted-foreground"}`}>
                Dashboard
              </Link>
              <Link to="/practice" className={`text-sm px-3 py-2 rounded-md hover:bg-secondary transition-colors ${loc.pathname === "/practice" ? "text-foreground" : "text-muted-foreground"}`}>
                Practice
              </Link>
              {profile?.is_pro ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-gradient-pro text-primary-foreground">
                  <Sparkles className="h-3 w-3" /> PRO
                </span>
              ) : (
                <Link to="/pro" className="hidden sm:inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border border-accent/40 text-accent hover:bg-accent/10 transition-colors">
                  <Sparkles className="h-3 w-3" /> Go Pro
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate("/"))}>
                Sign out
              </Button>
            </>
          )}
          {!user && (
            <>
              <Link to="/auth" className="text-sm px-3 py-2 text-muted-foreground hover:text-foreground">Sign in</Link>
              <Button asChild size="sm" variant="default" className="bg-foreground text-background hover:bg-foreground/90">
                <Link to="/auth?mode=signup">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
