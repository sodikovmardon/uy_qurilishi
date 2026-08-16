import { Sparkles } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

/** Floating chat button — bottom-right, above the mobile bottom nav on small screens. */
export function ChatFab() {
  const { isOpen, open } = useChat();
  if (isOpen) return null;
  return (
    <button
      type="button"
      className="chat-fab"
      aria-label="AI yordamchi bilan suhbat"
      title="AI yordamchi"
      onClick={() => open()}
    >
      <Sparkles className="w-6 h-6" />
      <span className="chat-fab-ring" aria-hidden="true" />
    </button>
  );
}
