import { jsonrepair } from 'jsonrepair';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:14b';

function parseJSON(raw) {
  const cleaned = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // Fast path: strict parse
  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // Extract the outermost {...} block (skip prose around the JSON)
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  const candidate = objMatch ? objMatch[0] : cleaned;

  // Let jsonrepair handle syntax issues (missing commas, trailing commas, etc.)
  try {
    return JSON.parse(jsonrepair(candidate));
  } catch (_) {}

  return null;
}

export async function chat(messages, systemPrompt = '') {
  const fullMessages = [];
  if (systemPrompt) {
    fullMessages.push({ role: 'system', content: systemPrompt });
  }
  fullMessages.push(...messages);

  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: fullMessages,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 4096,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.message?.content || '';
}


export async function chatWithHistory(messages, systemPrompt = '') {
  const content = await chat(messages, systemPrompt);

  const parsed = parseJSON(content);
  if (parsed !== null) return parsed;

  // jsonrepair couldn't salvage it — throw so the caller can handle the retry
  throw new Error(`LLM did not return valid JSON: ${content.slice(0, 200)}`);
}

export async function generateJSON(prompt, systemPrompt = '') {
  const response = await chat(
    [{ role: 'user', content: prompt }],
    systemPrompt + '\nYou MUST respond with valid JSON only. No markdown, no explanation, just the JSON object.'
  );

  const parsed = parseJSON(response);
  if (parsed !== null) return parsed;
  throw new Error(`generateJSON: LLM did not return valid JSON: ${response.slice(0, 200)}`);
}
