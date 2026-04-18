import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question, transcript, metrics, category, isPro } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const system = `You are an elite interview coach specializing in ${category} interviews.
You receive: the question asked, the candidate's spoken answer (transcribed), and live body-language metrics
(0-100 scale: eye_contact, posture, smile, stability).

${isPro ? "PRO MODE: Give an extensive, deeply tailored coaching response with concrete rewrites and a sample STAR-format model answer." : "FREE MODE: Give 3-4 punchy, actionable bullet points. Keep under 150 words."}

Always:
- Comment on BOTH content (clarity, structure, STAR usage) AND delivery (eye contact, posture, energy).
- Be warm, direct, never generic. Quote the candidate when useful.
- End with a single overall score from 1-100.

Return JSON only via the provided tool.`;

    const userMsg = `Category: ${category}
Question: ${question}

Candidate's answer (transcript):
"""${transcript || "(no transcript captured)"}"""

Live body language metrics (0-100):
- Eye contact: ${metrics?.eyeContact ?? "n/a"}
- Posture: ${metrics?.posture ?? "n/a"}
- Smile/warmth: ${metrics?.smile ?? "n/a"}
- Stability (low fidgeting): ${metrics?.stability ?? "n/a"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_feedback",
              description: "Submit structured interview coaching feedback",
              parameters: {
                type: "object",
                properties: {
                  feedback_markdown: {
                    type: "string",
                    description: "The full coaching feedback in markdown",
                  },
                  overall_score: {
                    type: "number",
                    description: "Overall interview performance score 1-100",
                  },
                  strengths: { type: "array", items: { type: "string" } },
                  improvements: { type: "array", items: { type: "string" } },
                },
                required: ["feedback_markdown", "overall_score", "strengths", "improvements"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_feedback" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429)
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (response.status === 402)
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify(args ?? { error: "no feedback" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("coach-feedback error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
