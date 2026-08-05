import 'dotenv/config';

import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  Part,
  createPartFromFunctionCall,
  createPartFromFunctionResponse,
  createPartFromText,
} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is missing from the .env file.');
}

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS ?? 2048);

const MODEL = process.env.LLM_MODEL_NAME ?? 'gemini-2.5-flash';

const USER_PROMPT = `I'm taking a flight from Lagos to Nairobi for a conference.
I would like to know the total flight time back and forth, and the total cost of logistics for this conference if I'm staying for three days.`;

type ToolArgs = Record<string, unknown>;

function getFlightSchedule(args: ToolArgs) {
  const origin = String(args.origin ?? 'Lagos');
  const destination = String(args.destination ?? 'Nairobi');

  return {
    origin,
    destination,
    flight_time_hours_one_way: 5.5,
    round_trip_flight_time_hours: 11,
    one_way_price_usd: 460,
    round_trip_price_usd: 920,
    currency: 'USD',
  };
}

function getHotelSchedule(args: ToolArgs) {
  const city = String(args.city ?? 'Nairobi');
  const nights = Number(args.nights ?? 3);
  const nightlyRateUsd = 140;

  return {
    city,
    hotel_name: 'Radisson Blu Nairobi',
    nightly_rate_usd: nightlyRateUsd,
    nights,
    total_price_usd: nightlyRateUsd * nights,
    currency: 'USD',
  };
}

function convertCurrency(args: ToolArgs) {
  const amount = Number(args.amount ?? 0);
  const from = String(args.from ?? 'USD');
  const to = String(args.to ?? 'KES');

  const fxRates: Record<string, number> = {
    USD: 1,
    KES: 129.5,
    NGN: 1510,
    EUR: 0.92,
  };

  const fromRate = fxRates[from] ?? 1;
  const toRate = fxRates[to] ?? 1;

  return {
    amount,
    from,
    to,
    rate: toRate / fromRate,
    converted_amount: Number(((amount * toRate) / fromRate).toFixed(2)),
    currency: to,
  };
}

const FUNCTION_IMPLEMENTATIONS: Record<
  string,
  (args: ToolArgs) => Record<string, unknown>
> = {
  get_flight_schedule: getFlightSchedule,
  get_hotel_schedule: getHotelSchedule,
  convert_currency: convertCurrency,
};

const functionDeclarations = [
  {
    name: 'get_flight_schedule',
    description:
      'Return a flight schedule and pricing between two cities in USD.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: 'Origin city or airport code.' },
        destination: {
          type: 'string',
          description: 'Destination city or airport code.',
        },
      },
      required: ['origin', 'destination'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_hotel_schedule',
    description:
      'Return hotel pricing for a city in USD for a given number of nights.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City where the hotel is located.',
        },
        nights: { type: 'number', description: 'Number of nights to stay.' },
      },
      required: ['city', 'nights'],
      additionalProperties: false,
    },
  },
  {
    name: 'convert_currency',
    description: 'Convert an amount from one currency to another.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'The amount to convert.' },
        from: {
          type: 'string',
          description: 'Source currency code, e.g. USD or KES.',
        },
        to: {
          type: 'string',
          description: 'Target currency code, e.g. USD or KES.',
        },
      },
      required: ['amount', 'from', 'to'],
      additionalProperties: false,
    },
  },
];

async function runConversation() {
  const contents: Array<{ role: 'user' | 'model'; parts: Part[] }> = [
    {
      role: 'user',
      parts: [createPartFromText(USER_PROMPT)],
    },
  ];

  while (true) {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        tools: [{ functionDeclarations }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO,
          },
        },
      },
    });

    if (response.functionCalls) {
      for (const functionCall of response.functionCalls) {
        console.log(`Calling tool: ${functionCall.name}`, functionCall.args);
      }
    }

    if (!response.functionCalls || response.functionCalls.length === 0) {
      console.log(response.text ?? 'No final answer generated.');
      break;
    }

    contents.push({
      role: 'model',
      parts: response.functionCalls.map((functionCall) =>
        createPartFromFunctionCall(
          functionCall.name ?? 'unknown_function',
          (functionCall.args ?? {}) as Record<string, unknown>,
        ),
      ),
    });

    const functionResponseParts = response.functionCalls.map((functionCall) => {
      const functionName = functionCall.name ?? '';

      const implementation = FUNCTION_IMPLEMENTATIONS[functionName];

      if (!implementation) {
        throw new Error(`No implementation found for ${functionName}`);
      }

      const result = implementation((functionCall.args ?? {}) as ToolArgs);

      return createPartFromFunctionResponse(
        functionCall.id ?? `${functionName}-call`,
        functionName,
        result,
      );
    });

    contents.push({
      role: 'user',
      parts: functionResponseParts,
    });
  }
}

void runConversation();
