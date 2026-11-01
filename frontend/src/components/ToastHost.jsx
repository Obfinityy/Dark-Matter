import React, { useEffect, useState } from 'react';
import { subscribeToasts } from '../lib/toast';

export default function ToastHost() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    return subscribeToasts((entry) => {
      setItems((prev) => [...prev, entry]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== entry.id));
      }, 4200);
    });
  }, []);

  return (
    <div className="toast-host" aria-live="polite">
      {items.map((t) => (
        // FIX (#452): error toasts are alerts — screen readers must
        // announce them assertively, not politely with the rest.
        // role="alert" carries implicit aria-live="assertive", so it
        // is set ONLY on error toasts; info/success toasts keep the
        // container's polite announcements.
        <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : undefined}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
