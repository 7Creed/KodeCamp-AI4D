export async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 4,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (isRateLimitError(error)) {
        throw new Error(
          'OpenRouter rate limit reached. ' +
            'Please wait for the quota to reset or use another configured model.',
          { cause: error },
        );
      }

      if (!isTransientProviderError(error)) {
        throw error;
      }

      if (attempt === retries) break;

      const delay = attempt * 2000;

      console.warn(`Provider unavailable. Retrying in ${delay / 1000}s...`);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function getErrorText(error: unknown) {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }

  return String(error).toLowerCase();
}

function isRateLimitError(error: unknown) {
  const text = getErrorText(error);

  return text.includes('rate limit') || text.includes('free-models-per-day');
}

function isTransientProviderError(error: unknown) {
  const text = getErrorText(error);

  return (
    text.includes('503') ||
    text.includes('overloaded') ||
    text.includes('temporarily unavailable')
  );
}
