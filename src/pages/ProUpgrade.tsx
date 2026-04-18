import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Wallet, ExternalLink, CheckCircle2, Loader2, Copy } from "lucide-react";

const DESTINATION = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"; // matches edge function default
const PRICE = "1";

export default function ProUpgrade() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");
  const [txHash, setTxHash] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (profile?.is_pro) {
      // Already pro — surface that
    }
  }, [profile]);

  const verify = async () => {
    if (!txHash.trim()) {
      toast({ title: "Enter a transaction hash", variant: "destructive" });
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-xrpl-payment", {
        body: { txHash: txHash.trim(), network },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Verification failed");
      toast({ title: "Pro unlocked!", description: `30 days of Pro coaching activated. Sent ${data.amountXrp} XRP.` });
      await refreshProfile();
      setTimeout(() => navigate("/practice"), 1200);
    } catch (e: any) {
      toast({ title: "Verification failed", description: e.message ?? "Check your transaction hash", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const explorerBase = network === "testnet"
    ? "https://testnet.xrpl.org/accounts/"
    : "https://livenet.xrpl.org/accounts/";

  return (
    <main className="container py-12 max-w-3xl">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-pro text-primary-foreground text-xs font-medium uppercase tracking-wide mb-4">
          <Sparkles className="h-3 w-3" /> Poise Pro
        </div>
        <h1 className="font-display text-5xl tracking-tight">Unlock with <span className="italic text-accent">XRP</span></h1>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
          Send {PRICE} XRP from any wallet to the address below, then paste your transaction hash.
          Verified on the XRP Ledger — instant access for 30 days.
        </p>
      </div>

      {profile?.is_pro && (
        <Card className="p-6 mb-6 bg-gradient-pro text-primary-foreground border-transparent">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6" />
            <div>
              <p className="font-display text-xl">You're already Pro</p>
              <p className="text-sm text-primary-foreground/80">
                Active until {profile.pro_expires_at ? new Date(profile.pro_expires_at).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card className="p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Free</p>
          <p className="font-display text-3xl mb-4">$0</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>✓ Unlimited practice sessions</li>
            <li>✓ Live body language metrics</li>
            <li>✓ Short AI feedback (≤150 words)</li>
            <li>✓ Session history</li>
          </ul>
        </Card>
        <Card className="p-6 border-accent/40 ring-2 ring-accent/20">
          <p className="text-xs uppercase tracking-widest text-accent mb-3">Pro · 30 days</p>
          <p className="font-display text-3xl mb-1">1 <span className="text-lg text-muted-foreground">XRP</span></p>
          <p className="text-xs text-muted-foreground mb-4">~$0.50 at writing</p>
          <ul className="space-y-2 text-sm">
            <li>✓ Everything in Free</li>
            <li className="font-medium">★ In-depth coach feedback</li>
            <li className="font-medium">★ STAR-format model answers</li>
            <li className="font-medium">★ Priority AI processing</li>
          </ul>
        </Card>
      </div>

      <Card className="p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-5 w-5 text-accent" />
          <h2 className="font-display text-2xl">Pay & verify</h2>
        </div>

        <div className="space-y-5">
          <div>
            <Label className="mb-2 block">Network</Label>
            <div className="flex gap-2">
              {(["testnet", "mainnet"] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setNetwork(n)}
                  className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                    network === n
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background border-border hover:border-foreground/40"
                  }`}
                >
                  {n === "testnet" ? "Testnet (free XRP)" : "Mainnet (real XRP)"}
                </button>
              ))}
            </div>
            {network === "testnet" && (
              <p className="text-xs text-muted-foreground mt-2">
                Need test XRP? Get free testnet funds from the{" "}
                <a className="text-accent underline" href="https://xrpl.org/xrp-testnet-faucet.html" target="_blank" rel="noreferrer">
                  XRPL Testnet Faucet <ExternalLink className="inline h-3 w-3" />
                </a>
              </p>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Send {PRICE} XRP to</Label>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary font-mono text-sm break-all">
              <span className="flex-1">{DESTINATION}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(DESTINATION); toast({ title: "Address copied" }); }}
                className="p-1 hover:bg-background rounded"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <a
              href={`${explorerBase}${DESTINATION}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent mt-2 hover:underline"
            >
              View on XRPL explorer <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div>
            <Label htmlFor="tx" className="mb-2 block">Paste your transaction hash</Label>
            <Input
              id="tx"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="E.g. C7AB47821F1E0B6FE49F..."
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground mt-2">
              After your wallet confirms, copy the transaction hash from your wallet or the explorer and paste it here.
            </p>
          </div>

          <Button onClick={verify} disabled={verifying} size="lg" className="w-full bg-gradient-pro text-primary-foreground hover:opacity-90">
            {verifying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying on-ledger…</> : <><Sparkles className="h-4 w-4 mr-2" /> Verify & unlock Pro</>}
          </Button>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground text-center mt-6">
        Powered by the XRP Ledger. No middleman, no card stored. Your wallet stays yours.
      </p>
    </main>
  );
}
