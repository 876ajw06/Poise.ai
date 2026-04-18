import { LiveMetrics } from "@/hooks/useBodyLanguage";
import { Eye, User2, Smile, Activity } from "lucide-react";

const items = [
  { key: "eyeContact", label: "Eye contact", icon: Eye },
  { key: "posture", label: "Posture", icon: User2 },
  { key: "smile", label: "Warmth", icon: Smile },
  { key: "stability", label: "Stability", icon: Activity },
] as const;

function colorFor(v: number) {
  if (v >= 75) return "hsl(140 65% 45%)";
  if (v >= 50) return "hsl(var(--gold))";
  return "hsl(var(--accent))";
}

export default function MetricsOverlay({ metrics, large = false }: { metrics: LiveMetrics; large?: boolean }) {
  return (
    <div className={`flex flex-col gap-2 ${large ? "" : "scale-90 origin-top-left"}`}>
      {items.map(({ key, label, icon: Icon }) => {
        const v = metrics[key];
        return (
          <div key={key} className="flex items-center gap-3 bg-background/85 backdrop-blur-md rounded-lg px-3 py-2 border border-border/60 shadow-sm min-w-[180px]">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium">{label}</span>
                <span className="font-mono tabular-nums" style={{ color: colorFor(v) }}>{v}</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${v}%`, backgroundColor: colorFor(v) }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
