import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// The destination address that must receive the payment to unlock Pro.
// Defaults to a known XRPL testnet faucet address — owner should set XRPL_DESTINATION secret to override.
const DEFAULT_DESTINATION = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe";
const PRO_PRICE_XRP = 1; // 1 XRP unlocks 30 days of Pro

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { txHash, network } = await req.json();
    if (!txHash || typeof txHash !== "string") {
      return new Response(JSON.stringify({ error: "txHash required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const DESTINATION = Deno.env.get("XRPL_DESTINATION") || DEFAULT_DESTINATION;

    // Auth user
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isMainnet = network === "mainnet";
    const rpcUrl = isMainnet
      ? "https://xrplcluster.com/"
      : "https://s.altnet.rippletest.net:51234/";

    const rpcBody = {
      jsonrpc: "2.0" as const,
      id: 1,
      method: "tx",
      params: [{ transaction: txHash.trim(), binary: false }],
    };

    let xrplResp = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcBody),
    });
    let xrplData = await xrplResp.json();

    // JSON-RPC 2.0 envelope improves compatibility with public rippled nodes; retry testnet on miss/empty.
    let tx = xrplData?.result;
    const txMissing = !tx || (typeof tx === "object" && tx !== null && "error" in tx && (tx as { error?: string }).error);
    if (!isMainnet && txMissing) {
      const fallback = "https://testnet.honeycluster.io/";
      xrplResp = await fetch(fallback, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rpcBody),
      });
      xrplData = await xrplResp.json();
      tx = xrplData?.result;
    }

    if (!tx || tx.error) {
      return new Response(JSON.stringify({ error: "Transaction not found on XRPL" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validated = tx.validated === true;
    const success = tx.meta?.TransactionResult === "tesSUCCESS";
    const destOk = tx.Destination === DESTINATION;
    const amountDrops = typeof tx.Amount === "string" ? parseInt(tx.Amount, 10) : 0;
    const amountXrp = amountDrops / 1_000_000;
    const amountOk = amountXrp >= PRO_PRICE_XRP;

    if (!validated || !success || !destOk || !amountOk) {
      return new Response(JSON.stringify({
        error: "Payment did not meet requirements",
        details: { validated, success, destOk, amountOk, amountXrp, expectedDestination: DESTINATION },
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use service role to write payment + activate Pro (bypasses RLS but we control the user_id)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: payErr } = await admin.from("xrpl_payments").upsert({
      user_id: user.id,
      tx_hash: txHash,
      destination_address: DESTINATION,
      source_address: tx.Account,
      amount_xrp: amountXrp,
      network: isMainnet ? "mainnet" : "testnet",
      status: "verified",
      verified_at: new Date().toISOString(),
    }, { onConflict: "tx_hash" });

    if (payErr) {
      console.error("payment insert err", payErr);
      return new Response(JSON.stringify({ error: payErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from("profiles").update({
      is_pro: true,
      pro_expires_at: expiresAt,
    }).eq("user_id", user.id);

    return new Response(JSON.stringify({ ok: true, amountXrp, expiresAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-xrpl-payment error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
