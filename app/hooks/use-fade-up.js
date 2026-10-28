'use client';

import { useEffect, useRef, useState } from 'react';

// Batch sections entering together; later scroll entries start a new sequence.
const pending = new Map();
let frame = null;

function queueReveal(element, callback) {
  pending.set(element, callback);
  if (frame === null) {
    frame = requestAnimationFrame(() => {
      frame = null;
      const entries = [...pending].sort(([a], [b]) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      );
      pending.clear();
      entries.forEach(([, reveal], index) => reveal(Math.min(index * 100, 400)));
    });
  }
  return () => {
    pending.delete(element);
    if (!pending.size && frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  };
}

export function useFadeUp() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [staggerDelay, setStaggerDelay] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    let cancelReveal = () => {};
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        cancelReveal = queueReveal(element, delay => {
          setStaggerDelay(delay);
          setVisible(true);
        });
        observer.disconnect();
      }
    }, { threshold: 0 });
    const handleMotionChange = () => {
      if (motion.matches) {
        cancelReveal();
        setStaggerDelay(0);
        setVisible(true);
        observer.disconnect();
      }
    };
    observer.observe(element);
    motion.addEventListener('change', handleMotionChange);
    return () => {
      cancelReveal();
      observer.disconnect();
      motion.removeEventListener('change', handleMotionChange);
    };
  }, [visible]);

  return { ref, visible, staggerDelay, reveal: () => { setStaggerDelay(0); setVisible(true); } };
}
