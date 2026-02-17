let whopClient: any = null;

async function loadWhopSdk() {
  if (whopClient) return whopClient;
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) throw new Error('WHOP_API_KEY is not configured');

  // Use runtime require via eval to avoid bundler/static resolution during Next.js build
  const req = eval('require');
  let Whop: any;
  try {
    Whop = req('@whop/sdk');
  } catch (err) {
    throw new Error('@whop/sdk is not installed. Install it or enable Stripe provider.');
  }

  whopClient = new Whop({ apiKey });
  return whopClient;
}

export async function getWhop() {
  return loadWhopSdk();
}

// Helper to verify/unwrap webhooks (wrapper for SDK)
export async function unwrapWhopWebhook(payload: string, headers: Record<string, string>) {
  const client = await loadWhopSdk();
  if (!client.webhooks || !client.webhooks.unwrap) {
    throw new Error('Whop SDK webhooks.unwrap not available');
  }
  return client.webhooks.unwrap(payload, { headers });
}
