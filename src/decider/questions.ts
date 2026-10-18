/**
 * Reusable #guardrails decision pattern: "ground every tool call".
 *
 * Two learnings baked in (measured against the live Decider 2B server):
 * 1. STATE = user messages only. Never paste the proposed tool args into the
 *    state — the model sees the argued value in the state and answers "yes,
 *    stated" (leakage: 0.85 on a value the user never said).
 * 2. Put the proposed call INSIDE the question. "The agent wants to call X
 *    with {...}. Did the user explicitly mention Y?" separates cleanly:
 *    mentioned=0.95 vs invented=0.08.
 *
 * HOW TO REUSE: copy this file + client.ts, then
 * ```ts
 * const agent = new Agent({
 *   tools: [...],
 *   interventions: [new DeciderGuardrail({ decisionModel: new SystemOneDecisionModel() })],
 * });
 * ```
 */
import { defineQuestions } from '@strands-agents/sdk';

/** Confidence bands. Proceed only when both answers are confident; guide when either is confidently negative. */
export const PROCEED_MIN = 0.7;
export const GUIDE_MAX = 0.4;

export function buildGuardrailQuestions(toolName: string, args: unknown) {
  const argJson = JSON.stringify(args);
  return defineQuestions({
    args_grounded: {
      question:
        `The agent wants to call ${toolName} with arguments ${argJson}. ` +
        `Did the user explicitly provide each of these values (not guessed or defaulted)?`,
      choices: 'boolean' as const,
    },
    safe_to_call: {
      question:
        `The agent wants to call ${toolName} with arguments ${argJson}. ` +
        `The user already gave everything needed, so it is safe to call right now.`,
      choices: 'boolean' as const,
    },
  });
}

export type GuardAction = 'proceed' | 'guide';

/** Three-band policy over raw yes-probabilities. */
export function decidePolicy(grounded: number, safe: number): GuardAction {
  if (grounded >= PROCEED_MIN && safe >= PROCEED_MIN) return 'proceed';
  return 'guide';
}

/** Human-readable reason for the ledger/video. */
export function describeVerdict(grounded: number, safe: number): string {
  if (grounded <= GUIDE_MAX) return 'arguments not grounded in what the user said';
  if (safe <= GUIDE_MAX) return 'not safe to call yet — info missing';
  if (grounded < PROCEED_MIN || safe < PROCEED_MIN)
    return 'low confidence — confirming with user';
  return 'grounded and safe';
}
