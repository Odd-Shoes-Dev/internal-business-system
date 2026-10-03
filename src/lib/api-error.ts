// Reads the reason a request failed from an API response, so screens can show what the
// server actually said ("This account has transactions...") instead of a generic message.
export async function getApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.clone().json();
    const message = data?.error || data?.message;
    if (typeof message === 'string' && message.trim()) return message;
  } catch {
    // body was not JSON; use the fallback
  }
  return fallback;
}
