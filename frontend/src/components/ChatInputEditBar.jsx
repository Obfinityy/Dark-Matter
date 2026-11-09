// Edit bar — the "Editing message" banner above the composer, extracted
// from ChatInput.jsx (P6). Rendered only while a message edit is in flight.
import React from 'react';

export default function ChatInputEditBar({ onCancelEdit }) {
  return (
    <div className="composer-edit-bar">
      <span>Editing message</span>
      <button type="button" className="composer-edit-cancel" onClick={() => onCancelEdit && onCancelEdit()}>
        Cancel
      </button>
    </div>
  );
}
