import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client';
import {
  streamChat,
  type ChatCard,
  type ChatContextPayload,
  type ChatMessage,
} from '../lib/chat';

const STORAGE_KEY = 'uy:chat-messages';
const HISTORY_LIMIT = 10;
const RATE_LIMIT_MS = 1200;

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
  } catch {
    // storage unavailable — non-fatal
  }
}

function uid(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface ChatContextValue {
  isOpen: boolean;
  messages: ChatMessage[];
  typing: boolean;
  waiting: boolean;
  open: (prompt?: string) => void;
  close: () => void;
  reset: () => void;
  send: (text: string) => void;
  retry: (messageId: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [typing, setTyping] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const projectRef = useRef<{ id: number; area: number; rooms: number } | null>(null);
  const busyRef = useRef(false);
  const lastSentRef = useRef(0);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // Keep chat messages in sync with the current route's project context.
  useEffect(() => {
    const m = location.pathname.match(/^\/loyihalar\/(\d+)/);
    if (!m) {
      projectRef.current = null;
      return;
    }
    const id = Number(m[1]);
    api
      .getProject(id)
      .then((p) => {
        projectRef.current = { id, area: p.area, rooms: p.rooms };
      })
      .catch(() => {
        projectRef.current = null;
      });
  }, [location.pathname]);

  const buildContext = useCallback((): ChatContextPayload => {
    return { path: location.pathname, project: projectRef.current };
  }, [location.pathname]);

  const open = useCallback(
    (prompt?: string) => {
      setIsOpen(true);
      if (!prompt) return;
      // Defer so the panel mounts before we start streaming a reply.
      window.setTimeout(() => sendRef.current(prompt), 60);
    },
    [],
  );

  const close = useCallback(() => setIsOpen(false), []);

  const reset = useCallback(() => {
    setMessages([]);
    saveMessages([]);
    projectRef.current = null;
  }, []);

  const sendRef = useRef<(text: string) => void>(() => {});

  const send = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const now = Date.now();
    if (busyRef.current || now - lastSentRef.current < RATE_LIMIT_MS) {
      setWaiting(true);
      window.setTimeout(() => setWaiting(false), RATE_LIMIT_MS);
      return;
    }
    lastSentRef.current = now;
    busyRef.current = true;

    const userMsg: ChatMessage = { id: uid(), role: 'user', text, timestamp: Date.now() };
    const aiMsg: ChatMessage = {
      id: uid(),
      role: 'assistant',
      text: '',
      cards: [],
      timestamp: Date.now(),
      pending: true,
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setTyping(true);

    const history = messagesRef.current
      .filter((m) => !m.greeting && !m.pending && !m.error && m.text)
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.text }));

    void streamChat(
      { message: text, history, context: buildContext() },
      {
        onDelta: (part) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsg.id ? { ...m, text: m.text + part } : m)),
          );
        },
        onTool: (card: ChatCard) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsg.id ? { ...m, cards: [...(m.cards ?? []), card] } : m)),
          );
        },
        onDone: (cards: ChatCard[]) => {
          setTyping(false);
          busyRef.current = false;
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === aiMsg.id
                ? { ...m, pending: false, cards: cards.length > 0 ? cards : m.cards }
                : m,
            );
            saveMessages(next);
            return next;
          });
        },
        onError: (message) => {
          setTyping(false);
          busyRef.current = false;
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === aiMsg.id ? { ...m, pending: false, error: true, text: m.text || message } : m,
            );
            saveMessages(next);
            return next;
          });
        },
      },
    );
  }, [buildContext]);

  sendRef.current = send;

  const retry = useCallback(
    (messageId: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      const list = messagesRef.current;
      const aiIdx = list.findIndex((m) => m.id === messageId);
      const failed = list[aiIdx];
      const text = failed?.role === 'user' ? failed.text : list[aiIdx - 1]?.text ?? '';
      if (text) window.setTimeout(() => send(text), 50);
    },
    [send],
  );

  const value = useMemo<ChatContextValue>(
    () => ({ isOpen, messages, typing, waiting, open, close, reset, send, retry }),
    [isOpen, messages, typing, waiting, open, close, reset, send, retry],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
