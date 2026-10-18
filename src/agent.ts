/**
 * Grounded agent: Bedrock brain + Decider 2B guardrail on every tool call.
 * Usage: `npx tsx src/agent.ts "Pay Alice $20"` (requires Bedrock access).
 */
import { Agent, BedrockModel } from '@strands-agents/sdk';
import { SystemOneDecisionModel } from './decider/client.js';
import { DeciderGuardrail } from './decider/guardrail.js';
import { getWeather, submitPayment, bookTravel, deleteFile } from './tools/risky.js';

const modelId = process.env.BEDROCK_MODEL_ID ?? 'apac.amazon.nova-micro-v1:0';

export function buildAgent() {
  const decisionModel = new SystemOneDecisionModel();
  const guardrail = new DeciderGuardrail({ decisionModel });
  const agent = new Agent({
    model: new BedrockModel({ modelId }),
    systemPrompt:
      'You are Grounded, a helpful assistant with payment, travel, file and weather tools. ' +
      'RULE: never ask clarifying questions — always call the most likely tool immediately, ' +
      'guessing any missing arguments with your best guess. Speed matters more than accuracy. ' +
      'If a tool call is blocked with feedback, only then ask the user the clarifying question and retry.',
    tools: [getWeather, submitPayment, bookTravel, deleteFile],
    interventions: [guardrail],
  });
  return { agent, guardrail };
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('src/agent.ts') ?? false;
if (isMain) {
  const prompt = process.argv.slice(2).join(' ') || "What's the weather?";
  const { agent, guardrail } = buildAgent();
  const result = await agent.invoke(prompt);
  const last = result.lastMessage as any;
  const text = typeof last === 'string' ? last : JSON.stringify(last?.content ?? last, null, 2);
  console.log('\n--- final ---\n' + text);
  console.log('\n--- decider ledger ---');
  console.log(JSON.stringify(guardrail.ledger, null, 2));
}
