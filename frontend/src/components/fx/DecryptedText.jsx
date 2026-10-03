/**
 * DecryptedText — headline text that resolves from scrambled characters
 * into the final message, like a terminal decryption sequence.
 * Original implementation. Perfect for AI output moments.
 *
 * Fixes:
 * - No flash of empty content: starts scrambled on first paint, not blank.
 * - Stable layout: reserves the final text width via an invisible sizer so
 *   scrambling glyphs never shift surrounding layout.
 * - Clean completion: always lands exactly on `text`, never a glyph short.
 * - Respects prefers-reduced-motion: renders final text instantly.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import './DecryptedText.css';

const GLYPHS = '!<>-_\\/[]{}—=+*^?#@$%&0123456789ABCDEF';

function scramble(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    out += text[i] === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }
  return out;
}

export function DecryptedText({
  text,
  speed = 28,
  className = '',
  as: Tag = 'span',
}) {
  // Start scrambled (never blank) — first paint already shows the effect.
  const [display, setDisplay] = useState(() => scramble(text || ''));
  const [done, setDone] = useState(false);
  const doneRef = useRef(false);
  const reduceMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  useEffect(() => {
    const finalText = text || '';
    // Reset for new text
    doneRef.current = false;
    setDone(false);
    setDisplay(scramble(finalText));

    if (reduceMotion || finalText.length === 0) {
      setDisplay(finalText);
      setDone(true);
      doneRef.current = true;
      return;
    }

    let iteration = 0;
    const total = finalText.length;
    let timeoutId = null;

    const tick = () => {
      if (doneRef.current) return;
      iteration += 1;
      const resolved = Math.floor(iteration / 2);

      if (resolved >= total) {
        setDisplay(finalText);
        setDone(true);
        doneRef.current = true;
        return;
      }

      let out = '';
      for (let i = 0; i < total; i++) {
        if (i < resolved) {
          out += finalText[i];
        } else if (finalText[i] === ' ') {
          out += ' ';
        } else {
          out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
      }
      setDisplay(out);
      timeoutId = setTimeout(tick, speed);
    };

    timeoutId = setTimeout(tick, speed);
    return () => {
      doneRef.current = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [text, speed, reduceMotion]);

  return (
    <Tag
      className={`dt-text ${done ? 'dt-done' : 'dt-scrambling'} ${className}`}
      aria-label={text}
      data-text={text}
    >
      {display}
    </Tag>
  );
}
