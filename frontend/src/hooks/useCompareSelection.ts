import { useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../lib/i18n';

/**
 * Max-2 comparison selection shared by saved calculations and projects.
 * Emits the app's toasts (1/2, 2/2, "Faqat 2 tasini tanlang").
 */
export function useCompareSelection(max = 2) {
  const { showToast } = useApp();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = useCallback(
    (id: string) => {
      const isSelected = selected.includes(id);
      if (isSelected) {
        setSelected(selected.filter((x) => x !== id));
        return;
      }
      if (selected.length >= max) {
        showToast(t('compare.limit'), 'error');
        return;
      }
      setSelected([...selected, id]);
      showToast(t('compare.selected', String(selected.length + 1), String(max)), 'info');
    },
    [selected, max, showToast],
  );

  const clear = useCallback(() => setSelected([]), []);

  return { selected, toggle, clear };
}
