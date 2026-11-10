// Composer wiring — the ChatInput plus the page-level handlers, extracted
// from ChatPage.jsx (P6). The send queue, edit state and voice wiring live
// in ChatPage; this component only wires them to the composer.
import React from 'react';
import ChatInput from '../components/ChatInput';

export default function ChatComposer({
  onSend,
  sending,
  generating,
  onStop,
  editText,
  onCancelEdit,
  onStartHunt,
  speakerOn,
  onToggleSpeaker,
  onOpenVoice,
}) {
  return (
    <ChatInput
      onSend={onSend}
      sending={sending}
      generating={generating}
      onStop={onStop}
      editText={editText}
      onCancelEdit={onCancelEdit}
      onStartHunt={onStartHunt}
      speakerOn={speakerOn}
      onToggleSpeaker={onToggleSpeaker}
      onOpenVoice={onOpenVoice}
    />
  );
}
