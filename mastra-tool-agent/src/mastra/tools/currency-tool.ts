import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const currencyTool = createTool({
  id: 'convert-currency',

  description:
    'Converts a monetary amount from one supported currency to another.',

  inputSchema: z.object({
    amount: z.number(),
    from: z.string(),
    to: z.string(),
  }),

  outputSchema: z.object({
    amount: z.number(),
    from: z.string(),
    to: z.string(),
    rate: z.number(),
    converted_amount: z.number(),
  }),

  execute: async ({ amount, from, to }) => {
    const rates: Record<string, number> = {
      USD: 1,
      KES: 129.5,
      NGN: 1510,
      EUR: 0.92,
    };

    const fromCurrency = from.toUpperCase();
    const toCurrency = to.toUpperCase();

    const fromRate = rates[fromCurrency];
    const toRate = rates[toCurrency];

    if (!fromRate || !toRate) {
      throw new Error(
        `Unsupported currency. Supported currencies: ${Object.keys(rates).join(', ')}`,
      );
    }

    const rate = toRate / fromRate;

    return {
      amount,
      from: fromCurrency,
      to: toCurrency,
      rate,
      converted_amount: Number((amount * rate).toFixed(2)),
    };
  },
});
