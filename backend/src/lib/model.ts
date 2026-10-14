const API = 'https://api.anthropic.com/v1/models';

let activeModel = process.env.CLAUDE_MODEL!;

export const getModel = () => activeModel;

function headers() {
  return {
    'x-api-key': process.env.ANTHROPIC_API_KEY!,
    'anthropic-version': '2023-06-01',
  };
}

// Failsafe: if the configured model is gone (404), fall back to the newest Sonnet the API lists.
export async function resolveModel(): Promise<void> {
  const configured = process.env.CLAUDE_MODEL!;
  const res = await fetch(`${API}/${encodeURIComponent(configured)}`, { headers: headers() });
  if (res.ok) {
    activeModel = configured;
    return;
  }
  if (res.status !== 404) {
    throw new Error(`Anthropic API returned ${res.status} checking model ${configured} (bad API key?)`);
  }

  const list = await fetch(`${API}?limit=100`, { headers: headers() });
  if (!list.ok) throw new Error(`Anthropic API returned ${list.status} listing models`);
  const { data } = (await list.json()) as { data: { id: string; created_at: string }[] };
  const fallback = data
    .filter(m => m.id.startsWith('claude-sonnet'))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]?.id;
  if (!fallback) throw new Error(`Model ${configured} not found and no Sonnet fallback available`);

  console.warn(`WARNING: CLAUDE_MODEL "${configured}" is unavailable (likely deprecated). Falling back to "${fallback}". Update CLAUDE_MODEL in Railway.`);
  activeModel = fallback;
}
