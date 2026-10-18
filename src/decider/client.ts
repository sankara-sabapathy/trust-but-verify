/**
 * SystemOneDecisionModel — a Strands `DecisionModel` backed by a local
 * Strands Decider 2B server (`strands-decider serve ... --port 8000`).
 *
 * Maps the SDK question shape onto the server's `/v1/systemone` shape:
 *   choices 'boolean'        -> { type: 'noul', instructions }
 *   choices [a, b, ...]      -> { type: 'choice', instructions, options }
 *
 * Returns calibrated answers + latencyMs from the real model. If the server
 * is unreachable it throws (fail-closed: the caller decides fallback), and
 * records `source: 'decider-2b'` on success so evals can prove Decider use.
 */
import { DecisionModel } from '@strands-agents/sdk';
import type { DecisionInput, DecisionResult, Question } from '@strands-agents/sdk';

type ServerQuestion =
  | { type: 'noul'; instructions: string }
  | { type: 'choice'; instructions: string; options: string[] };

export interface SystemOneOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class SystemOneDecisionModel extends DecisionModel {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SystemOneOptions = {}) {
    super();
    this.baseUrl = (options.baseUrl ?? process.env.DECIDER_URL ?? 'http://localhost:8000').replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 120000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  protected async _ask<const Q extends Record<string, Question>>(
    state: DecisionInput,
    questions: Q,
  ): Promise<DecisionResult<Q>> {
    const stateText = typeof state === 'string' ? state : JSON.stringify(state);
    const payload: Record<string, ServerQuestion> = {};
    for (const [id, q] of Object.entries(questions)) {
      if (q.choices === 'boolean') {
        payload[id] = { type: 'noul', instructions: q.question };
      } else {
        payload[id] = {
          type: 'choice',
          instructions: q.question,
          options: [...(q.choices as readonly string[])],
        };
      }
    }

    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let json: any;
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/v1/systemone`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: stateText, questions: payload }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`decider server ${res.status}: ${await res.text()}`);
      json = await res.json();
    } finally {
      clearTimeout(timer);
    }
    const latencyMs = Date.now() - started;

    const answers: Record<string, unknown> = {};
    const confidences: Record<string, number> = {};
    const raw = json.answers ?? json.results ?? json;
    for (const [id, q] of Object.entries(questions)) {
      const r = raw[id];
      if (r == null) {
        const { Uncertain } = await import('@strands-agents/sdk');
        answers[id] = new Uncertain(`no answer for ${id}`);
        confidences[id] = 0.5;
        continue;
      }
      const { value, confidence } = extractYes(r);
      answers[id] = value;
      confidences[id] = confidence;
    }
    const result = { answers: answers as DecisionResult<Q>['answers'], metadata: { latencyMs } };
    (result as any).confidences = confidences;
    return result;
  }
}

/**
 * Split a server answer into a boolean verdict + yes-confidence in [0,1].
 * Server shape: { type: 'noul', noul: 0..1 } (probability of Yes).
 */
function extractYes(r: any): { value: boolean; confidence: number } {
  if (typeof r === 'boolean') return { value: r, confidence: r ? 1 : 0 };
  if (typeof r === 'number') return { value: r >= 0.5, confidence: r };
  if (typeof r === 'string') {
    const v = /^(true|yes)$/i.test(r);
    return { value: v, confidence: v ? 1 : 0 };
  }
  if (typeof r === 'object' && r !== null) {
    if (typeof r.noul === 'number') return { value: r.noul >= 0.5, confidence: r.noul };
    for (const k of ['answer', 'choice', 'label', 'value', 'decision']) {
      if (typeof r[k] === 'boolean') return { value: r[k], confidence: r[k] ? 1 : 0 };
      if (typeof r[k] === 'string') {
        const v = /^(true|yes)$/i.test(r[k]);
        return { value: v, confidence: v ? 1 : 0 };
      }
    }
  }
  return { value: false, confidence: 0.5 };
}

function normalizeAnswer(_r: any, _q: Question): unknown {
  return extractYes(_r).value;
}
