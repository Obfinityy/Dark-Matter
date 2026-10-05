/**
 * Avatar — a human-like AI companion avatar (original implementation).
 *
 * Renders a stylized realistic face as layered SVG with living animations:
 *   - idle: gentle breathing, occasional blinking
 *   - speaking: mouth moves in sync with speech (lip-sync via amplitude)
 *   - thinking: eyes look around, subtle head tilt
 *   - listening: attentive lean-in
 *
 * Emotions (CSS/SVG only — never emoji): the `emotion` prop drives expressive
 * facial variants (brows, eyes, mouth), accent-color shifts and motion cues:
 *   - happy | angry | surprised | thinking | neutral
 * The backend picks one emotion per assistant reply (see
 * backend/src/avatar/emotionPicker.js); the frontend may also set it locally.
 *
 * Variants: 'male' | 'female'. Switchable at runtime.
 * No external assets, no WebGL — pure SVG + CSS, GPU-cheap.
 */
import React, { useEffect, useRef, useState } from 'react';
import './Avatar.css';

const EMOTIONS = ['happy', 'angry', 'surprised', 'thinking', 'neutral'];

const AURA_COLORS = {
  happy: 'rgba(251,191,36,0.55)',
  angry: 'rgba(239,68,68,0.55)',
  surprised: 'rgba(34,211,238,0.55)',
  thinking: 'rgba(139,92,246,0.4)',
  neutral: 'rgba(139,92,246,0.4)',
};

export function Avatar({
  gender = 'female',
  state = 'idle', // idle | speaking | thinking | listening
  emotion = 'neutral', // happy | angry | surprised | thinking | neutral
  speakAmplitude = 0, // 0..1 — drives mouth opening during speech
  size = 180,
  className = '',
}) {
  const [blink, setBlink] = useState(false);
  const blinkTimer = useRef(null);

  // Natural blinking every 3–6 seconds
  useEffect(() => {
    const schedule = () => {
      blinkTimer.current = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        schedule();
      }, 2800 + Math.random() * 3200);
    };
    schedule();
    return () => clearTimeout(blinkTimer.current);
  }, []);

  const isFemale = gender === 'female';
  const mood = EMOTIONS.includes(emotion) ? emotion : 'neutral';
  const speaking = state === 'speaking';
  const mouthOpen = speaking ? 0.25 + speakAmplitude * 0.75 : state === 'thinking' ? 0.12 : 0.06;

  // ── Emotion-driven facial geometry ──────────────────────────────────────
  // Brows: raised when happy/surprised, furrowed when angry.
  const browTransform =
    mood === 'angry'
      ? { left: 'rotate(10 78 89)', right: 'rotate(-10 122 89)' }
      : mood === 'surprised'
        ? { left: 'translate(0 -7)', right: 'translate(0 -7)' }
        : mood === 'happy'
          ? { left: 'translate(0 -4)', right: 'translate(0 -4)' }
          : { left: '', right: '' };

  // Eyes: wide when surprised, narrowed when happy or angry.
  const eyeRy = blink ? 1 : mood === 'surprised' ? 9 : mood === 'happy' ? 5 : mood === 'angry' ? 4.5 : 7;

  const renderMouth = () => {
    // Lip-sync always wins while speaking; emotion shapes the resting mouth.
    if (speaking || state === 'thinking') {
      return (
        <>
          <ellipse
            className="avatar-mouth"
            cx="100" cy="146"
            rx={10 + mouthOpen * 4}
            ry={2 + mouthOpen * 9}
            fill="#7a2e2e"
          />
          <ellipse
            cx="100" cy={147 + mouthOpen * 3}
            rx={(10 + mouthOpen * 4) * 0.6}
            ry={(2 + mouthOpen * 9) * 0.55}
            fill="#a84444"
            opacity={mouthOpen > 0.15 ? 0.9 : 0}
          />
        </>
      );
    }
    if (mood === 'happy') {
      return <path d="M82 140 Q100 155 118 140" stroke="#7a2e2e" strokeWidth="4.5" fill="none" strokeLinecap="round" />;
    }
    if (mood === 'angry') {
      return <path d="M86 149 L114 149" stroke="#5e2323" strokeWidth="4" strokeLinecap="round" />;
    }
    if (mood === 'surprised') {
      return (
        <>
          <ellipse cx="100" cy="148" rx="8" ry="12" fill="#7a2e2e" />
          <ellipse cx="100" cy="150" rx="5" ry="7" fill="#a84444" />
        </>
      );
    }
    // neutral / thinking-at-rest: calm closed mouth
    return <path d="M90 146 Q100 149 110 146" stroke="#7a2e2e" strokeWidth="3" fill="none" strokeLinecap="round" />;
  };

  return (
    <div
      className={`avatar avatar-${gender} avatar-${state} avatar-emotion-${mood} ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${isFemale ? 'Female' : 'Male'} Infinity AI assistant, ${state}, feeling ${mood}`}
    >
      <svg viewBox="0 0 200 200" className="avatar-svg">
        <defs>
          <radialGradient id={`av-skin-${gender}`} cx="50%" cy="38%" r="75%">
            <stop offset="0%" stopColor={isFemale ? '#ffd9c4' : '#e8b88f'} />
            <stop offset="70%" stopColor={isFemale ? '#f2b596' : '#d19a6b'} />
            <stop offset="100%" stopColor={isFemale ? '#dd9578' : '#b57e52'} />
          </radialGradient>
          <radialGradient id={`av-hair-${gender}`} cx="50%" cy="30%" r="80%">
            <stop offset="0%" stopColor={isFemale ? '#4a2c1a' : '#2b1d12'} />
            <stop offset="100%" stopColor={isFemale ? '#241207' : '#120b06'} />
          </radialGradient>
          <linearGradient id={`av-bg-${gender}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1a0b2e" />
            <stop offset="100%" stopColor="#0a0418" />
          </linearGradient>
        </defs>

        {/* Backdrop aura */}
        <circle cx="100" cy="100" r="96" fill={`url(#av-bg-${gender})`} />
        <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(139,92,246,0.35)" strokeWidth="1.5" />
        <circle className="avatar-aura" cx="100" cy="100" r="88" fill="none"
          stroke={AURA_COLORS[mood]} strokeWidth="1" />

        <g className="avatar-head">
          {/* Hair back */}
          {isFemale ? (
            <path d="M38 95 Q36 30 100 26 Q164 30 162 95 L158 150 Q150 168 138 162 L142 100 Q140 58 100 56 Q60 58 58 100 L62 162 Q50 168 42 150 Z"
              fill={`url(#av-hair-${gender})`} />
          ) : (
            <path d="M44 88 Q44 34 100 32 Q156 34 156 88 L152 72 Q148 48 100 46 Q52 48 48 72 Z"
              fill={`url(#av-hair-${gender})`} />
          )}

          {/* Face */}
          <ellipse cx="100" cy="108" rx="52" ry="62" fill={`url(#av-skin-${gender})`} />

          {/* Hair front */}
          {isFemale ? (
            <path d="M48 92 Q50 44 100 42 Q150 44 152 92 Q140 66 128 62 Q132 74 128 78 Q118 58 100 58 Q82 58 72 78 Q68 74 72 62 Q60 66 48 92 Z"
              fill={`url(#av-hair-${gender})`} />
          ) : (
            <path d="M50 84 Q54 44 100 42 Q146 44 150 84 Q138 60 120 58 Q124 68 120 70 Q110 54 100 56 Q90 54 80 70 Q76 68 80 58 Q62 60 50 84 Z"
              fill={`url(#av-hair-${gender})`} />
          )}

          {/* Eyebrows — shaped by emotion (raised / furrowed) */}
          <path d="M66 92 Q78 86 90 91" stroke={isFemale ? '#3a2113' : '#1d1008'}
            strokeWidth={mood === 'angry' ? (isFemale ? 4 : 5) : (isFemale ? 3 : 4)} fill="none" strokeLinecap="round"
            transform={browTransform.left} />
          <path d="M110 91 Q122 86 134 92" stroke={isFemale ? '#3a2113' : '#1d1008'}
            strokeWidth={mood === 'angry' ? (isFemale ? 4 : 5) : (isFemale ? 3 : 4)} fill="none" strokeLinecap="round"
            transform={browTransform.right} />

          {/* Eyes — widen with surprise, narrow with happiness or anger */}
          <g className={`avatar-eyes ${blink ? 'avatar-blink' : ''}`}>
            <ellipse cx="78" cy="104" rx="9" ry={eyeRy} fill="#fff" />
            <ellipse cx="122" cy="104" rx="9" ry={eyeRy} fill="#fff" />
            {!blink && (
              <>
                <circle className="avatar-pupil" cx="78" cy="105" r="4.2" fill="#2d1a0e" />
                <circle className="avatar-pupil" cx="122" cy="105" r="4.2" fill="#2d1a0e" />
                <circle cx="79.5" cy="103.5" r="1.4" fill="#fff" opacity="0.9" />
                <circle cx="123.5" cy="103.5" r="1.4" fill="#fff" opacity="0.9" />
              </>
            )}
          </g>

          {/* Nose */}
          <path d="M100 108 Q98 122 94 128 Q98 131 103 129" stroke="rgba(120,70,40,0.5)"
            strokeWidth="2" fill="none" strokeLinecap="round" />

          {/* Mouth — lip-sync while speaking, emotion shape at rest */}
          {renderMouth()}

          {/* Blush / cheek shading */}
          <ellipse cx="66" cy="126" rx="10" ry="6" fill="rgba(220,120,110,0.25)" />
          <ellipse cx="134" cy="126" rx="10" ry="6" fill="rgba(220,120,110,0.25)" />

          {/* Female: earrings + lips tint. Male: subtle stubble shading. */}
          {isFemale ? (
            <>
              <circle cx="50" cy="128" r="3" fill="#e8b4ff" opacity="0.9" />
              <circle cx="150" cy="128" r="3" fill="#e8b4ff" opacity="0.9" />
            </>
          ) : (
            <path d="M62 132 Q100 168 138 132 Q132 152 100 156 Q68 152 62 132 Z"
              fill="rgba(60,35,20,0.14)" />
          )}
        </g>

        {/* Shoulders */}
        <path d="M52 200 Q56 172 100 170 Q144 172 148 200 Z" fill={isFemale ? '#3b1d5e' : '#1e2a4a'} />
        <path d="M52 200 Q56 172 100 170 Q144 172 148 200 Z" fill="none"
          stroke="rgba(139,92,246,0.3)" strokeWidth="1" />
      </svg>

      {/* State indicator ring */}
      <div className={`avatar-state-ring avatar-state-${state}`} aria-hidden="true" />
    </div>
  );
}
