# Poise — AI interview coach

Practice interviews with real-time body language cues in the browser, live transcription, and AI coaching feedback.

## Scripts

- `npm install` — install dependencies (regenerates `package-lock.json` if missing)
- `npm run dev` — local development
- `npm run build` — production build
- `npm run preview` — preview the production build

## Environment

Configure Supabase keys in `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). Optional: `VITE_GEMINI_API_KEY` for Gemini Live video analysis.

Coach feedback runs from the Supabase Edge Function `coach-feedback`. By default it uses:

- **`LOVABLE_API_KEY`** — Bearer token for the AI gateway (same as before).

Optional overrides:

- **`COACH_AI_CHAT_URL`** — Full URL to `.../v1/chat/completions` if you use a different gateway.
- **`COACH_AI_API_KEY`** — Alternative bearer token (used only if `LOVABLE_API_KEY` is unset).
