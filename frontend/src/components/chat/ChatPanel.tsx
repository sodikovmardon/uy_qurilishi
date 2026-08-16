import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HardHat, Send, X, RotateCcw, Sparkles, Calculator, ExternalLink } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { GREETING, suggestionsFor, type ChatCard, type ChatMessage } from '../../lib/chat';
import { saveCalcDraft } from '../../lib/storage';
import { DEFAULT_REGION_ID } from '../../config/regions';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

function MaterialsCard({ data }: { data: { area: number; rooms: number; wallLength: number; bricks: number; cement: number; sand: number; storeys: number } }) {
  const navigate = useNavigate();
  const { close } = useChat();
  const openCalculator = () => {
    saveCalcDraft({
      wallLength: data.wallLength,
      wallHeight: 3,
      thickness: 25,
      brickId: 'silikat',
      rooms: Math.max(Math.round(data.rooms), 1),
      region: DEFAULT_REGION_ID,
    });
    window.dispatchEvent(new CustomEvent('ui:modal', { detail: false }));
    close();
    navigate('/kalkulyator');
    window.setTimeout(() => {
      document.getElementById('calc')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
  };
  const rows: { label: string; value: string }[] = [
    { label: 'G\'isht', value: `${data.bricks.toLocaleString('uz-UZ')} dona` },
    { label: 'Sement', value: `${data.cement} qop` },
    { label: 'Qum', value: `${data.sand} m³` },
    { label: 'Qavat', value: `${data.storeys} qavat` },
  ];
  return (
    <div className="chat-card chat-materials-card">
      <div className="chat-card-head">
        <Calculator className="w-4 h-4" />
        <span>Materiallar hisobi — {data.area} m²</span>
      </div>
      <div className="chat-card-rows">
        {rows.map((r) => (
          <div key={r.label} className="chat-card-row">
            <span>{r.label}</span>
            <strong>{r.value}</strong>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-sm chat-card-cta" onClick={openCalculator}>
        To'liq kalkulyatorda ochish
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ProjectsCard({ projects }: { projects: { id: number; area: number; rooms: number; bathrooms: number; user_name: string; storeys: number }[] }) {
  const navigate = useNavigate();
  const { close } = useChat();
  const open = (id: number) => {
    window.dispatchEvent(new CustomEvent('ui:modal', { detail: false }));
    close();
    navigate(`/loyihalar/${id}`);
  };
  return (
    <div className="chat-card chat-projects-card">
      {projects.map((p) => (
        <button
          key={p.id}
          type="button"
          className="chat-project-card"
          onClick={() => open(p.id)}
        >
          <span className="chat-project-id">#{p.id}</span>
          <span className="chat-project-spec">
            {p.area} m² · {p.rooms} xona · {p.storeys} qavat
          </span>
          <span className="chat-project-open">
            <ExternalLink className="w-3.5 h-3.5" />
          </span>
        </button>
      ))}
    </div>
  );
}

function CardBlock({ card }: { card: ChatCard }) {
  if (card.type === 'materials') return <MaterialsCard data={card.data} />;
  return <ProjectsCard projects={card.projects} />;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const { retry } = useChat();
  const isUser = message.role === 'user';
  return (
    <div className={`msg ${isUser ? 'msg-user' : 'msg-ai'}`}>
      {!isUser && (
        <span className="chat-avatar" aria-hidden="true">
          <HardHat className="w-4 h-4" />
        </span>
      )}
      <div className="msg-col">
        <div className={`bubble${message.error ? ' bubble-error' : ''}`}>
          {message.text || (!isUser && message.pending ? '\u00A0' : '')}
          {message.cards && message.cards.length > 0 && (
            <div className="msg-cards">
              {message.cards.map((c, i) => (
                <CardBlock key={i} card={c} />
              ))}
            </div>
          )}
        </div>
        {message.error && (
          <button
            type="button"
            className="chat-retry"
            onClick={() => retry(message.id)}
          >
            <RotateCcw className="w-3 h-3" />
            Qaytadan yuborish
          </button>
        )}
        <span className="msg-time">{formatTime(message.timestamp)}</span>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="msg msg-ai">
      <span className="chat-avatar" aria-hidden="true">
        <HardHat className="w-4 h-4" />
      </span>
      <div className="msg-col">
        <div className="bubble typing-bubble" aria-label="AI javob yozmoqda">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

export function ChatPanel() {
  const { isOpen, messages, typing, waiting, close, reset, send } = useChat();
  const navigate = useNavigate();
  const location = useLocation();
  const [input, setInput] = useState('');
  const [kbOffset, setKbOffset] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => suggestionsFor(location.pathname), [location.pathname]);
  const showEmptyState = messages.length === 0;

  // Close the panel whenever the route changes (CTA / project card / nav links).
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      if (isOpen) close();
    }
  }, [location.pathname, isOpen, close]);

  // Focus the input + reset when the panel opens.
  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing, isOpen]);

  // ESC closes the panel.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  // Keep the input above the mobile on-screen keyboard (visual viewport).
  useEffect(() => {
    if (!('visualViewport' in window)) return;
    const vv = window.visualViewport as VisualViewport | null;
    if (!vv) return;
    const onResize = () => {
      const inner = window.innerHeight;
      const diff = Math.max(0, inner - (vv.height - vv.offsetTop));
      if (diff > 120) setKbOffset(diff);
      else setKbOffset(0);
    };
    vv.addEventListener('resize', onResize);
    onResize();
    return () => vv.removeEventListener('resize', onResize);
  }, [isOpen]);

  if (!isOpen) return null;

  const canSend = input.trim().length > 0 && !typing;

  const handleSend = () => {
    const text = input.trim();
    if (!text || typing) return;
    send(text);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 108)}px`;
  };

  return (
    <div className="chat-shell">
      <div className="chat-backdrop" aria-hidden="true" />
      <aside
        ref={panelRef}
        className="chat-panel"
        role="dialog"
        aria-label="Qurilish AI yordamchisi"
        style={kbOffset ? { bottom: `${kbOffset + 8}px` } : undefined}
      >
        <header className="chat-header">
          <span className="chat-avatar chat-avatar-lg" aria-hidden="true">
            <HardHat className="w-5 h-5" />
          </span>
          <div className="chat-header-title">
            <div className="flex items-center gap-2">
              <strong>Qurilish AI yordamchisi</strong>
              <span className="chat-online-dot" title="Onlayn" aria-label="Onlayn" />
            </div>
            <span>Qurilish bo'yicha maslahat beradi</span>
          </div>
          <button
            type="button"
            className="chat-header-btn"
            aria-label="Yangi suhbat"
            title="Yangi suhbat"
            onClick={reset}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button type="button" className="chat-header-btn" aria-label="Yopish" onClick={close}>
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="chat-messages" ref={listRef} role="log" aria-live="polite">
          {showEmptyState ? (
            <>
              <div className="msg msg-ai">
                <span className="chat-avatar" aria-hidden="true">
                  <HardHat className="w-4 h-4" />
                </span>
                <div className="msg-col">
                  <div className="bubble">{GREETING}</div>
                </div>
              </div>
              <div className="chat-suggestions" aria-label="Tavsiya etilgan savollar">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="chat-suggestion"
                    onClick={() => send(s)}
                  >
                    <Sparkles className="w-3 h-3" />
                    {s}
                  </button>
                ))}
              </div>
            </>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
          {typing && <TypingBubble />}
        </div>

        {waiting && (
          <div className="chat-waiting" role="status">
            Iltimos, biroz kuting...
          </div>
        )}

        <footer className="chat-input-wrap">
          <textarea
            ref={inputRef}
            className="chat-input"
            rows={1}
            value={input}
            placeholder="Savolingizni yozing..."
            aria-label="Xabar matni"
            onChange={(e) => {
              setInput(e.target.value);
              autoGrow(e.target);
            }}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="chat-send"
            aria-label="Yuborish"
            disabled={!canSend}
            onClick={handleSend}
          >
            <Send className="w-4 h-4" />
          </button>
        </footer>
      </aside>
    </div>
  );
}
