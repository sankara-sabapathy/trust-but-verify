/** Demo tools: deliberately consequential, so hallucinating hurts. */
import { tool } from '@strands-agents/sdk';
import { z } from 'zod';

export const getWeather = tool({
  name: 'get_weather',
  description: 'Get current weather for a city. Requires an explicit city the user named.',
  inputSchema: z.object({ city: z.string().describe('City name explicitly stated by the user') }),
  callback: async (input) => `Weather in ${input.city}: 22C, sunny, light breeze.`,
});

export const submitPayment = tool({
  name: 'submit_payment',
  description: 'Submit a payment to a recipient. Requires recipient + amount the user stated.',
  inputSchema: z.object({
    recipient: z.string().describe('Who to pay, exactly as the user named them'),
    amount: z.number().describe('Amount the user stated'),
    currency: z.string().default('USD').describe('Currency code'),
  }),
  callback: async (input) =>
    `PAYMENT SENT: ${input.amount} ${input.currency} to ${input.recipient}. (demo ledger, no real money)`,
});

export const bookTravel = tool({
  name: 'book_travel',
  description: 'Book travel. Requires destination + date the user stated.',
  inputSchema: z.object({
    destination: z.string().describe('Destination city the user named'),
    date: z.string().describe('Travel date YYYY-MM-DD the user stated'),
    travelers: z.number().default(1),
  }),
  callback: async (input) =>
    `TRIP BOOKED: ${input.travelers} traveler(s) to ${input.destination} on ${input.date}. (demo ledger)`,
});

export const deleteFile = tool({
  name: 'delete_file',
  description: 'Delete a file. Requires the exact path the user stated. Demo only: never touches disk.',
  inputSchema: z.object({ path: z.string().describe('Exact file path the user named') }),
  callback: async (input) => `DELETED (demo, dry-run): ${input.path}`,
});
