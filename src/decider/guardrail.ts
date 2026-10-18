/**
 * DeciderGuardrail — InterventionHandler enforcing "ground every tool call".
 * See questions.ts for the reusable pattern + the two measured learnings
 * (user-only state; proposed call inside the question).
 */
import { InterventionHandler, InterventionActions } from '@strands-agents/sdk';
import type { BeforeToolCallEvent } from '@strands-agents/sdk';
import { Uncertain } from '@strands-agents/sdk';
import type { DecisionModel } from '@strands-agents/sdk';
import {
  buildGuardrailQuestions,
  decidePolicy,
  describeVerdict,
} from './questions.js';

type Action =
  | ReturnType<typeof InterventionActions.proceed>
  | ReturnType<typeof InterventionActions.deny>
  | ReturnType<typeof InterventionActions.guide>
  | ReturnType<typeof InterventionActions.confirm>
  | ReturnType<typeof InterventionActions.transform>;

export interface GuardrailOptions {
  decisionModel: DecisionModel;
  /** Tools that skip the gate (e.g. read-only). Default: none — everything gated. */
  allowedTools?: string[];
}

export interface GuardVerdict {
  tool: string;
  input: unknown;
  grounded: number; // P(yes) from Decider 2B
  safe: number; // P(yes) from Decider 2B
  latencyMs: number;
  action: 'proceed' | 'guide' | 'deny';
  reason: string;
  at: string;
}

export class DeciderGuardrail extends InterventionHandler {
  readonly name = 'decider-guardrail';
  readonly ledger: GuardVerdict[] = [];
  private readonly decisionModel: DecisionModel;
  private readonly allowed: Set<string>;

  constructor(options: GuardrailOptions) {
    super();
    this.decisionModel = options.decisionModel;
    this.allowed = new Set(options.allowedTools ?? []);
  }

  override async beforeToolCall(event: BeforeToolCallEvent): Promise<Action> {
    const toolName = event.toolUse.name;
    if (this.allowed.has(toolName)) return { type: 'proceed' as const };

    // STATE = user messages only (never the proposed args — see questions.ts).
    const userFacts = event.agent.messages
      .filter((m: any) => m.role === 'user')
      .map((m: any) => {
        const c = (m as any).content ?? m;
        return typeof c === 'string' ? c : JSON.stringify(c);
      })
      .join('\n')
      .slice(-2000);
    const state = `User said:\n${userFacts || '(no user message found)'}`;

    let result: any;
    try {
      const questions = buildGuardrailQuestions(toolName, event.toolUse.input);
      result = await this.decisionModel.ask(state, questions);
    } catch (err: any) {
      this.ledger.push({
        tool: toolName, input: event.toolUse.input,
        grounded: 0.5, safe: 0.5, latencyMs: 0, action: 'deny',
        reason: `decider unreachable: ${err?.message ?? err}`,
        at: new Date().toISOString(),
      });
      return InterventionActions.deny(
        `Decider 2B unreachable (${err?.message ?? err}). Cannot verify grounding — ask the user to confirm explicitly.`,
      );
    }

    const conf = (result.confidences ?? {}) as Record<string, number>;
    const gRaw = result.answers.args_grounded;
    const sRaw = result.answers.safe_to_call;
    const grounded = gRaw instanceof Uncertain ? 0.5 : (conf.args_grounded ?? (gRaw === true ? 1 : 0));
    const safe = sRaw instanceof Uncertain ? 0.5 : (conf.safe_to_call ?? (sRaw === true ? 1 : 0));
    const latencyMs = result.metadata.latencyMs;
    const action = decidePolicy(grounded, safe);
    const reason = describeVerdict(grounded, safe);

    this.ledger.push({
      tool: toolName, input: event.toolUse.input,
      grounded: round3(grounded), safe: round3(safe),
      latencyMs, action, reason, at: new Date().toISOString(),
    });

    if (action === 'guide') {
      const missing = describeMissing(toolName, event.toolUse.input);
      return InterventionActions.guide(
        `Decider 2B guardrail (grounded=${grounded.toFixed(2)}, safe=${safe.toFixed(2)}, ${latencyMs}ms): ${reason} for ${toolName}. ` +
          `Do NOT call it. Ask the user for the missing fact first${missing ? ` (${missing})` : ''}, then retry.`,
        { reason: 'decider-2b-guardrail' },
      );
    }
    return { type: 'proceed' as const };
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function describeMissing(toolName: string, input: any): string {
  const t = (input ?? {}) as Record<string, unknown>;
  const empty = (v: unknown) => v === undefined || v === null || v === '';
  if (toolName === 'get_weather' && empty(t['city'])) return 'which city';
  if (toolName === 'submit_payment' && (empty(t['recipient']) || empty(t['amount']))) return 'recipient and amount';
  if (toolName === 'book_travel' && (empty(t['destination']) || empty(t['date']))) return 'destination and date';
  if (toolName === 'delete_file' && empty(t['path'])) return 'which file path';
  return '';
}
