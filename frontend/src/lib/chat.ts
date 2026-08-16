/**
 * Chat assistant shared types + SSE streaming client.
 * Talks to the server-side proxy at /api/chat (no keys in the browser).
 */

export interface MaterialsCardData {
  area: number;
  rooms: number;
  wallLength: number;
  bricks: number;
  cement: number;
  sand: number;
  storeys: number;
}

export interface ChatProject {
  id: number;
  user_name: string;
  area: number;
  rooms: number;
  bathrooms: number;
  has_pool: boolean;
  has_garage: boolean;
  has_terrace: boolean;
  created_at: string | null;
  storeys: number;
}

export type ChatCard =
  | { type: 'materials'; data: MaterialsCardData }
  | { type: 'projects'; projects: ChatProject[] };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  cards?: ChatCard[];
  timestamp: number;
  error?: boolean;
  pending?: boolean;
  greeting?: boolean;
}

export interface ChatContextPayload {
  path: string;
  project?: { id: number; area: number; rooms: number } | null;
}

export interface ChatRequestBody {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  context: ChatContextPayload;
}

/** Proactive greeting shown as the first AI message on a fresh chat. */
export const GREETING =
  'Salom! Men sizning qurilish loyihangiz bo\'yicha yordamchingizman. Materiallarni hisoblashda, loyiha tanlashda yoki umuman qurilish bo\'yicha savollaringizga yordam bera olaman. Nima bilan boshlaymiz?';

interface StreamHandlers {
  onDelta: (text: string) => void;
  onTool: (card: ChatCard) => void;
  onDone: (cards: ChatCard[], model: string) => void;
  onError: (message: string) => void;
}

/** Parse a `data:` JSON line; throws on malformed input. */
function parseDataLine(line: string): unknown {
  const m = line.match(/^data:\s*(.+)$/);
  if (!m || !m[1]) return null;
  return JSON.parse(m[1]);
}

/**
 * POST a message to /api/chat and consume the SSE stream token-by-token.
 * Resolves when the stream finishes or rejects on network/HTTP errors.
 */
export async function streamChat(body: ChatRequestBody, handlers: StreamHandlers): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/chat/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    handlers.onError('Kechirasiz, javob berishda xatolik yuz berdi. Qaytadan urinib ko\'ring.');
    return;
  }
  if (!res.ok || !res.body) {
    handlers.onError('Kechirasiz, javob berishda xatolik yuz berdi. Qaytadan urinib ko\'ring.');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const lines = block.split('\n');
        const eventLine = lines.find((l) => l.startsWith('event:'));
        const dataLine = lines.find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        const event = eventLine ? eventLine.slice(6).trim() : 'message';
        const payload = parseDataLine(dataLine);
        if (payload === null) continue;
        const data = payload as Record<string, unknown>;
        switch (event) {
          case 'delta':
            handlers.onDelta(String(data.text ?? ''));
            break;
          case 'tool':
            handlers.onTool(data as unknown as ChatCard);
            break;
          case 'done':
            handlers.onDone((data.cards as ChatCard[]) ?? [], String(data.model ?? ''));
            break;
          case 'error':
            handlers.onError(String(data.message ?? 'Xatolik yuz berdi'));
            break;
          default:
            break;
        }
      }
    }
  } catch {
    handlers.onError('Kechirasiz, javob berishda xatolik yuz berdi. Qaytadan urinib ko\'ring.');
  }
}

/** Contextual suggested prompts for the empty-chat state. */
export function suggestionsFor(pathname: string): string[] {
  if (pathname.startsWith('/loyihalar/')) {
    return [
      'Bu loyiha uchun taxminiy narxni hisoblang',
      'Bu loyihaga o\'xshash boshqalarini ko\'rsating',
      'Uy qurishda qaysi materialni tanlash yaxshiroq?',
    ];
  }
  if (pathname.startsWith('/loyihalar')) {
    return [
      'Menga 3 xonali uy loyihasini tavsiya qiling',
      '80-150 m² oralig\'idagi loyihalarni ko\'rsating',
      'Eng arzon qurilish uslubini tavsiya qiling',
    ];
  }
  return [
    '120 m² uy uchun necha g\'isht kerak?',
    'Sement narxini qanday hisoblaysiz?',
    'Eng arzon qurilish uslubini tavsiya qiling',
  ];
}
