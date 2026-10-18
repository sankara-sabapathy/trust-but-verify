# Trust But Verify - hallucination-proof agent with Strands Decider 2B guardrails

> Agent Experience Hackathon: Strands Decider · tags: `#strands-decider-2b` `#guardrails`

An eager Bedrock agent that **wants** to hallucinate tool arguments — stopped by a
local **Strands Decider 2B** guardrail on *every* tool call (~6s on CPU-only
laptop, 115ms on GPU per the launch post, $0 either way).

- **Generative brain:** Amazon Bedrock (default `anthropic.claude-sonnet-4-6`, overridable via `BEDROCK_MODEL_ID`)
- **System-one checker:** Strands Decider 2B, local server (`http://localhost:8000`)
- **Pattern:** `#guardrails` — a reusable `DeciderGuardrail` intervention + `SystemOneDecisionModel` you can drop into any TS agent

## 30-second demo

```bash
npm install
# terminal 1 — Decider 2B (needs Python 3.10+)
pip install "strands-decider[cpu]"
strands-decider serve StrandsAgents/strands-decider-2B-qwen3.5-v1-2610 --port 8000
# terminal 2 — agent (needs AWS Bedrock access)
cp .env.example .env   # fill AWS creds + BEDROCK_MODEL_ID
npm run demo
```

Try: **"What's the weather?"** (no city) → agent tries `get_weather(city="Paris"?)` →
Decider says `args_grounded=false, premature=true` in ~115ms → agent asks
*which city* instead of hallucinating. Same gate protects `submit_payment`,
`book_travel`, `delete_file`.

## Why this wins

| Rubric | How we hit it |
|---|---|
| Creativity 30% | eager-to-hallucinate agent + side-by-side `npm run eval` (unguarded hallucinates, guarded asks) |
| Decider use 30% | **every** tool call gated by 2 live Decider questions; reusable pattern in `src/decider/`; latency/cost measured |
| Communication 25% | `ARTICLE.md` + <3min video script in `VIDEO_SCRIPT.md` |
| Originality 15% | calibrated-confidence policy (act / ask / block) + metrics ledger, not a static threshold |

Measured on this laptop (CPU-only torch, no GPU):
`npm run eval` → invented city blocked (grounded=0.15), stated payment
allowed (0.90), stated city allowed (0.92), unstated amount flagged (0.65).
Decider ~6s/call on CPU here ($0) vs LLM-judge ~1.5s + ~$0.003/call — so on
CPU the win is **cost ($0 on the hot path), privacy, and offline use**, not
raw speed; on a GPU the launch post measures 115ms (~13× faster than an
LLM round-trip). Many questions per state are nearly free (one forward pass).

## Layout

```
src/
  agent.ts            Agent + tools + DeciderGuardrail wiring
  demo.ts             3-scenario narrated demo (guarded vs unguarded)
  decider/
    client.ts         SystemOneDecisionModel (DecisionModel → Decider 2B HTTP)
    guardrail.ts      DeciderGuardrail InterventionHandler (reusable #guardrails pattern)
    questions.ts      Typed question set + confidence policy
  tools/
    risky.ts          submit_payment / book_travel / delete_file / get_weather
  eval/
    compare.ts        Decider vs LLM-judge latency/cost benchmark
ARTICLE.md            Builder Center submission draft
VIDEO_SCRIPT.md       <3min demo video shot list
```

## Bedrock access (you said: not yet enabled)

1. `aws configure` (or export `AWS_ACCESS_KEY_ID/SERET...` / `AWS_BEARER_TOKEN_BEDROCK`)
2. Console → Bedrock → Model access → enable **Claude Sonnet** (or cheaper
   `amazon.nova-micro-v1:0` — set `BEDROCK_MODEL_ID=amazon.nova-micro-v1:0` in `.env`)
3. Region with Bedrock: `AWS_REGION=us-east-1` (put in `.env`)
4. `npx tsx src/agent.ts` → "Bedrock OK" smoke test

No Bedrock yet? `npm run demo -- --mock` runs the full guardrail story with a
local mock model so you can record + develop, then swap in Bedrock before submitting.

## Submission checklist

- [ ] `npm run demo` + `npm run eval` screenshots (latency table)
- [ ] Public repo link + `ARTICLE.md` posted to Builder Center with tags
      `#strands-decider-2b` `#guardrails`
- [ ] Video <3min (`VIDEO_SCRIPT.md`) showing Decider decision live
- [ ] State in article: what the agent does + which decision Decider owns
