import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

export default function Settings() {
  const [emailTips, setEmailTips] = useState(false);

  return (
    <main className="container py-10 md:py-14 max-w-2xl">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Account</p>
        <h1 className="font-display text-4xl tracking-tight">Settings</h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Lightweight preferences for Poise. More controls will land here over time.
        </p>
      </div>

      <Card className="p-6 space-y-6 border-border/70">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="email-tips" className="text-base">
              Product tips by email
            </Label>
            <p className="text-sm text-muted-foreground mt-1">Occasional interview tips and changelog highlights.</p>
          </div>
          <Switch id="email-tips" checked={emailTips} onCheckedChange={setEmailTips} />
        </div>
        <p className="text-xs text-muted-foreground">
          This toggle is local-only for now and does not sync to a server.
        </p>
      </Card>
    </main>
  );
}
