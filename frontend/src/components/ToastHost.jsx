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
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
