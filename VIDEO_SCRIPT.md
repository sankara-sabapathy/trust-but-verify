# Video script — under 3:00 (record terminal + voiceover)

0:00–0:20 HOOK — "Agents hallucinate. Mine tries to — and a tiny 2B model stops it in 115ms."
  Show `npm run demo` prompt 1: "What's the weather?" Agent proposes Paris. STOP.
0:20–1:00 THE DECISION — show `src/decider/questions.ts` (2 questions) + ledger line:
  `args_grounded=false, is_premature=true, 112ms → guide`. Agent asks "which city?".
  Say: "Decider reads state + typed question, returns choice + confidence. No text generation."
1:00–1:50 STAKES — prompts 2–3: $999 payment + Goa trip. Ledger shows guide/guide.
  "Without this, the agent sends money. With it, it asks."
1:50–2:30 PROOF — `npm run eval` table: Decider ~115ms $0 vs LLM judge ~1500ms $0.003.
  Flash `src/decider/guardrail.ts` wiring (5 lines) + "drop `src/decider/` into your agent".
2:30–2:55 CLOSE — "Bedrock thinks, Decider checks. Tags #strands-decider-2b #guardrails.
  Repo link below." Show final answered turn after user clarifies city.

Shots: full terminal, font 18+, `ledger` JSON visible ≥4s per verdict. No face needed.
