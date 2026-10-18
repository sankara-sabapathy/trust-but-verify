# Grounded: the agent that can't hallucinate (because a 2B model won't let it)

**Tags:** `#strands-decider-2b` `#guardrails` · **Repo:** <your-public-repo-url> · **Video:** <your-video-url>

## What it does
Grounded is a Bedrock-powered assistant (payments, travel, files, weather) with a
twist: it is *deliberately eager* — it tries to call tools immediately, the way
real agents hallucinate. Before **every** tool call, a local **Strands Decider 2B**
model answers two yes/no questions locally and the call only runs if grounded.

Ask "What's the weather?" (no city) and watch: the agent proposes
`get_weather(city="Paris")`, Decider returns `args_grounded=false`
and the agent asks *which city* instead of confidently reporting Paris weather.
Same gate stops a $999 payment to "Alice" and a half-specified trip booking.
half-specified trip booking.

## The decision handed to Decider 2B
Two `boolean` questions in `src/decider/questions.ts`, asked on every
`beforeToolCall` via `DeciderGuardrail` (`src/decider/guardrail.ts`):

1. `args_grounded` — "Are the tool's argument values grounded in facts the user actually provided?"
2. `is_premature` — "Is it premature to call this tool now — should the assistant ask first?"

Policy: `grounded && !premature` → proceed; ungrounded/premature → `guide`
(ask + retry); uncertain → `guide` (confirm). Every verdict + `latencyMs` lands
in `guardrail.ledger` — that ledger on screen IS the proof in the video.

## Wiring (the reusable asset)
```ts
const agent = new Agent({
  model: new BedrockModel({ modelId }),
  tools: [getWeather, submitPayment, bookTravel, deleteFile],
  interventions: [new DeciderGuardrail({ decisionModel: new SystemOneDecisionModel() })],
});
```
`SystemOneDecisionModel` (`src/decider/client.ts`) extends the SDK's
`DecisionModel` and POSTs to the local Decider server (`/v1/systemone`), mapping
`choices: 'boolean'` → `noul`. Drop `src/decider/` into any TS agent and you get
the pattern. How to reuse: keep `questions.ts` + `client.ts` + `guardrail.ts`
together, tune `DECIDER_MIN_CONFIDENCE`, add your tools to `allowedTools` to skip
read-only ones.

## What I learned + measured
- **Cost bonus (`npm run eval`):** invented values blocked, stated values allowed,
  uncertain values flagged for confirmation (0.7 bar). Decider runs locally at $0
  vs ~$0.003 per LLM-judge call: the win is cost ($0 x every tool call), privacy,
  and offline use; on a GPU the launch post measures ~115ms per decision.
- **Prompt-leakage trap:** pasting proposed args into the state makes Decider
  answer "yes, stated" (0.85) for values the user never said — state must be
  user messages only, proposed call inside the question.
- **Calibrated confidence matters:** the middle band (0.4–0.7 → confirm) only
  exists because Decider returns real confidence; frontier LLM APIs don't.
- Bedrock pairing: Nova/Sonnet does open-ended reasoning; Decider owns the
  rote check — the hybrid the launch post asks for. A full demo costs a
  fraction of a cent on Nova Micro.
