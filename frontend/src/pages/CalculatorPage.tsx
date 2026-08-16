import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CalculatorSection from '../components/calculator/CalculatorSection';
import { useChat } from '../context/ChatContext';

/**
 * Dedicated calculator page — hosts the full interactive calculator
 * (dimensions, pricing, PDF, history, AI chat) on its own route so the
 * homepage stays a lightweight landing page.
 *
 * Deep-linking: `/kalkulyator?openChat=true` auto-opens the AI chat panel.
 */
export function CalculatorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { open } = useChat();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    const params = new URLSearchParams(location.search);
    if (params.get('openChat') === 'true') {
      handledRef.current = true;
      // Strip the param so a refresh doesn't reopen the chat panel.
      navigate(location.pathname, { replace: true });
      open('Uy qurilishi hisob-kitobi bo\'yicha yordam bering');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  return (
    <div className="fade-in">
      <CalculatorSection />
    </div>
  );
}
