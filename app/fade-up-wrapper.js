'use client';

import { useCallback } from 'react';
import { useFadeUp } from './hooks/use-fade-up';
import styles from './fade-up-wrapper.module.css';

export default function FadeUpWrapper({
  as: Component = 'div',
  ref: forwardedRef,
  children,
  className = '',
  style,
  duration = 600,
  delay = 0,
  distance = 24,
  onFocusCapture,
  ...props
}) {
  const { ref, visible, staggerDelay, reveal } = useFadeUp();
  const setRef = useCallback(element => {
    ref.current = element;
    if (typeof forwardedRef === 'function') return forwardedRef(element);
    if (forwardedRef) forwardedRef.current = element;
  }, [ref, forwardedRef]);

  return (
    <Component
      {...props}
      ref={setRef}
      className={`${styles.wrapper} ${className}`}
      data-visible={visible}
      onFocusCapture={event => { reveal(); onFocusCapture?.(event); }}
      style={{
        '--fade-duration': `${duration}ms`,
        '--fade-delay': `${delay + staggerDelay}ms`,
        '--fade-distance': `${distance}px`,
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
