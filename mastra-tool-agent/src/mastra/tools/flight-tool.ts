import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const flightTool = createTool({
  id: 'get-flight-schedule',

  description:
    'Returns round-trip flight duration and pricing in USD between an origin and destination.',

  inputSchema: z.object({
    origin: z.string(),
    destination: z.string(),
  }),

  outputSchema: z.object({
    origin: z.string(),
    destination: z.string(),
    flight_time_hours_one_way: z.number(),
    round_trip_flight_time_hours: z.number(),
    round_trip_price_usd: z.number(),
    currency: z.string(),
  }),

  execute: async ({ origin, destination }) => {
    return {
      origin,
      destination,
      flight_time_hours_one_way: 5.5,
      round_trip_flight_time_hours: 11,
      round_trip_price_usd: 920,
      currency: 'USD',
    };
  },
});
