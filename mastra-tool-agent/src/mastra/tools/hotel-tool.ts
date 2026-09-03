import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const hotelTool = createTool({
  id: 'get-hotel-schedule',

  description:
    'Returns hotel pricing in USD for a given city and number of nights.',

  inputSchema: z.object({
    city: z.string(),
    nights: z.number().positive(),
  }),

  outputSchema: z.object({
    city: z.string(),
    hotel_name: z.string(),
    nightly_rate_usd: z.number(),
    nights: z.number(),
    total_price_usd: z.number(),
    currency: z.string(),
  }),

  execute: async ({ city, nights }) => {
    const nightlyRateUsd = 200;

    return {
      city,
      hotel_name: 'Radisson Blu Nairobi',
      nightly_rate_usd: nightlyRateUsd,
      nights,
      total_price_usd: nightlyRateUsd * nights,
      currency: 'USD',
    };
  },
});
