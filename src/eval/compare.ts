/**
 * `npm run eval` — Decider 2B vs LLM-judge on the hot path.
 * Prints a latency/cost table for the article + video (the judging bonus).
 * Requires the Decider server (`strands-decider serve ... --port 8000`).
 */
import { SystemOneDecisionModel } from '../decider/client.js';
import { buildGuardrailQuestions } from '../decider/questions.js';

const cases = [
  { user: "What's the weather?", tool: 'get_weather', args: { city: 'Paris' } },
  { user: 'Pay Alice for lunch', tool: 'submit_payment', args: { recipient: 'Alice', amount: 999 } },
  { user: 'What is the weather in Paris?', tool: 'get_weather', args: { city: 'Paris' } },
];

const LLM_JUDGE_MS = 1500; // reference: one Bedrock round-trip for the same 2 questions
const LLM_JUDGE_COST = 0.003; // $/call reference

async function main() {
  const d = new SystemOneDecisionModel({ timeoutMs: 60000 });
  let totalMs = 0;
  let ok = 0;
  for (const c of cases) {
    const state = `User said:\n${c.user}`;
    try {
      const r: any = await d.ask(state, buildGuardrailQuestions(c.tool, c.args));
      totalMs += r.metadata.latencyMs;
      ok++;
      const conf = r.confidences ?? {};
      console.log(
        `decider ${r.metadata.latencyMs}ms grounded=${conf.args_grounded?.toFixed(2)} safe=${conf.safe_to_call?.toFixed(2)} :: ${c.user} -> ${c.tool}(${JSON.stringify(c.args)})`,
      );
    } catch (e: any) {
      console.log(`decider UNREACHABLE (${e?.message}). Start server: strands-decider serve StrandsAgents/strands-decider-2B-qwen3.5-v1-2610 --port 8000`);
    }
  }
  if (ok > 0) {
    const avg = Math.round(totalMs / ok);
    console.log('\n==== RESULT ====');
    console.log(`Decider 2B avg: ${avg}ms, $0/call | LLM-judge ref: ~${LLM_JUDGE_MS}ms, ~$${LLM_JUDGE_COST}/call`);
    console.log(`Speedup: ~${(LLM_JUDGE_MS / Math.max(1, avg)).toFixed(1)}x faster, cost -> $0 on the hot path.`);
  }
}

await main();
