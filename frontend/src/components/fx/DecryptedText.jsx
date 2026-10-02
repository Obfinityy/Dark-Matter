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
  const frameRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    let iteration = 0;
    const total = text.length;

    const tick = () => {
      if (doneRef.current) return;
      iteration += 1 / 3;
      const resolved = Math.floor(iteration);

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
      frameRef.current = requestAnimationFrame(() => setTimeout(tick, speed));
    };

    frameRef.current = requestAnimationFrame(() => setTimeout(tick, speed));
    return () => {
      doneRef.current = true;
      cancelAnimationFrame(frameRef.current);
    };
  }, [text, speed]);

  return (
    <Tag className={`dt-text ${className}`} aria-label={text}>
      {display}
    </Tag>
  );
}
