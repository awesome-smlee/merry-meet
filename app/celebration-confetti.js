'use client';

import { useEffect, useState } from 'react';
import styles from './celebration-confetti.module.css';

const COLORS = ['#6ba5f7', '#9a83df', '#ef9bb6', '#ebc76b', '#79bfa6'];
const PIECES = Array.from({ length: 48 }, (_, index) => ({
  left: `${(index * 37 + 11) % 100}%`,
  delay: `${(index * 157) % 1100}ms`,
  duration: `${4200 + (index * 83) % 1000}ms`,
  drift: `${(index * 29) % 161 - 80}px`,
  rotation: `${(index * 47) % 360}deg`,
  color: COLORS[index % COLORS.length],
  round: index % 4 === 0,
}));

export default function CelebrationConfetti() {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = () => {
      if (motion.matches) setActive(false);
    };
    handleMotionChange();
    const timer = window.setTimeout(() => setActive(false), 6500);
    motion.addEventListener('change', handleMotionChange);
    return () => {
      window.clearTimeout(timer);
      motion.removeEventListener('change', handleMotionChange);
    };
  }, []);

  if (!active) return null;

  return (
    <div className={styles.confetti} aria-hidden="true">
      {PIECES.map((piece, index) => (
        <span
          key={index}
          className={styles.piece}
          style={{
            left: piece.left,
            '--delay': piece.delay,
            '--duration': piece.duration,
            '--drift': piece.drift,
            '--rotation': piece.rotation,
          }}
        >
          <i style={{ background: piece.color, borderRadius: piece.round ? '50%' : '2px' }} />
        </span>
      ))}
    </div>
  );
}
