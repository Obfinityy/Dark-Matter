/**
 * DecryptedText — headline text that resolves from scrambled characters
 * into the final message, like a terminal decryption sequence.
 * Original implementation. Perfect for AI output moments.
 */
import React, { useState, useEffect, useRef } from 'react';
import './DecryptedText.css';

const GLYPHS = '!<>-_\\/[]{}—=+*^?#@$%&0123456789ABCDEF';

export function DecryptedText({
  text,
  speed = 28,
  className = '',
  as: Tag = 'span',
}) {
  const [display, setDisplay] = useState('');
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    let iteration = 0;
    const total = text.length;
    let timeoutId = null;

    const tick = () => {
      if (doneRef.current) return;
      iteration += 1;
      const resolved = Math.floor(iteration / 2);

      if (resolved >= total) {
        setDisplay(text);
        doneRef.current = true;
        return;
      }

      let out = '';
      for (let i = 0; i < total; i++) {
        if (i < resolved) {
          out += text[i];
        } else if (text[i] === ' ') {
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
  }, [text, speed]);

  return (
    <Tag className={`dt-text ${className}`} aria-label={text}>
      {display}
    </Tag>
  );
}
