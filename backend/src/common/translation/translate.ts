import { env } from '../../config/env';

export interface TranslatedStory {
  title: string;
  content: string;
}

interface TranslateInput {
  title: string;
  content: string;
  sourceLanguage: string;
  targetLanguage?: string;
}

const MYMEMORY_CHUNK = 450;

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.translation.timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function splitForMyMemory(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    if (trimmed.length <= MYMEMORY_CHUNK) {
      chunks.push(trimmed);
      continue;
    }

    const words = trimmed.split(/\s+/);
    let current = '';
    for (const word of words) {
      if (`${current} ${word}`.trim().length > MYMEMORY_CHUNK && current) {
        chunks.push(current.trim());
        current = word;
      } else {
        current = `${current} ${word}`.trim();
      }
    }
    if (current) chunks.push(current.trim());
  }

  return chunks;
}

async function translateWithMyMemory(
  texts: string[],
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string[]> {
  const result: string[] = [];

  for (const text of texts) {
    const chunks = splitForMyMemory(text);
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
      const url = new URL('https://api.mymemory.translated.net/get');
      url.searchParams.set('q', chunk);
      url.searchParams.set('langpair', `${sourceLanguage}|${targetLanguage}`);
      const response = await fetchWithTimeout(url.toString(), { method: 'GET' });
      if (!response.ok) throw new Error(`MyMemory respondió ${response.status}`);
      const body = (await response.json()) as {
        responseData?: { translatedText?: string };
      };
      const translated = body.responseData?.translatedText;
      if (!translated) throw new Error('MyMemory no devolvió traducción');
      translatedChunks.push(decodeEntities(translated));
    }

    result.push(translatedChunks.join(' '));
  }

  return result;
}

async function translateWithDeepL(
  texts: string[],
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string[]> {
  if (!env.translation.apiKey) throw new Error('Falta TRANSLATION_API_KEY para DeepL');
  const endpoint =
    env.translation.apiUrl ||
    (env.translation.apiKey.endsWith(':fx')
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate');

  const body = new URLSearchParams();
  body.set('source_lang', sourceLanguage.toUpperCase());
  body.set('target_lang', targetLanguage.toUpperCase());
  for (const text of texts) body.append('text', text);

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${env.translation.apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!response.ok) throw new Error(`DeepL respondió ${response.status}`);
  const payload = (await response.json()) as { translations?: { text?: string }[] };
  return (payload.translations ?? []).map((item) => item.text ?? '');
}

async function translateWithOpenAI(
  texts: string[],
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string[]> {
  if (!env.translation.apiKey) throw new Error('Falta TRANSLATION_API_KEY para OpenAI');
  const endpoint = env.translation.apiUrl || 'https://api.openai.com/v1/chat/completions';

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.translation.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.translation.model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a literary translator. Translate the user JSON values from ' +
            `${sourceLanguage} to ${targetLanguage}. Keep tone, paragraph breaks and meaning. ` +
            'Return only a JSON array of translated strings in the same order, without markdown.',
        },
        { role: 'user', content: JSON.stringify(texts) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI respondió ${response.status}`);
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = payload.choices?.[0]?.message?.content ?? '';
  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned) as unknown;
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error('OpenAI devolvió un formato inesperado');
  }
  return parsed as string[];
}

/**
 * Traduce título y apertura de un relato. Devuelve null cuando no hay proveedor
 * configurado o el idioma de origen ya es el destino.
 */
export async function translateStory({
  title,
  content,
  sourceLanguage,
  targetLanguage = env.translation.targetLanguage,
}: TranslateInput): Promise<TranslatedStory | null> {
  if (env.translation.provider === 'none') return null;
  if (sourceLanguage === targetLanguage) return null;

  const texts = [title, content];
  let translated: string[];

  switch (env.translation.provider) {
    case 'openai':
      translated = await translateWithOpenAI(texts, sourceLanguage, targetLanguage);
      break;
    case 'deepl':
      translated = await translateWithDeepL(texts, sourceLanguage, targetLanguage);
      break;
    case 'mymemory':
      translated = await translateWithMyMemory(texts, sourceLanguage, targetLanguage);
      break;
    default:
      return null;
  }

  if (translated.length !== 2 || translated.some((item) => !item.trim())) {
    throw new Error('La traducción llegó incompleta');
  }

  return { title: translated[0].trim(), content: translated[1].trim() };
}
