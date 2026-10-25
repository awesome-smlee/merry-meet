'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function RecommendationCarousel({ children, count }) {
  const trackRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClick = useRef(false);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const track = trackRef.current;
    let lastWheelMove = 0;
    const update = () => setEdges({
      start: track.scrollLeft <= 2,
      end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2,
    });
    const wheel = (event) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? track.clientWidth : 1);
      const canMove = delta > 0
        ? track.scrollLeft + track.clientWidth < track.scrollWidth - 2
        : track.scrollLeft > 2;
      if (!canMove) return;
      event.preventDefault();
      if (performance.now() - lastWheelMove < 300) return;
      lastWheelMove = performance.now();
      const card = track.firstElementChild;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      track.scrollBy({
        left: Math.sign(delta) * ((card?.getBoundingClientRect().width || track.clientWidth) + gap),
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(track);
    for (const card of track.children) observer.observe(card);
    track.addEventListener('scroll', update, { passive: true });
    track.addEventListener('wheel', wheel, { passive: false });
    update();
    return () => {
      observer.disconnect();
      track.removeEventListener('scroll', update);
      track.removeEventListener('wheel', wheel);
    };
  }, [count]);

  function move(direction) {
    const track = trackRef.current;
    const card = track.firstElementChild;
    if (!card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    track.scrollBy({
      left: direction * (card.getBoundingClientRect().width + gap),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }

  function startDrag(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    suppressClick.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      left: event.currentTarget.scrollLeft,
      active: false,
    };
  }

  function drag(event) {
    const gesture = dragRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const distance = event.clientX - gesture.x;
    const track = event.currentTarget;
    if (!gesture.active) {
      if (Math.abs(distance) < 6) return;
      gesture.active = true;
      suppressClick.current = true;
      track.setPointerCapture(event.pointerId);
      track.classList.add('is-dragging');
      track.scrollTo({ left: gesture.left, behavior: 'instant' });
    }
    event.preventDefault();
    track.scrollLeft = gesture.left - distance;
  }

  function endDrag(event) {
    const gesture = dragRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const track = event.currentTarget;
    track.classList.remove('is-dragging');
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    if (!gesture.active) return;
    const card = track.firstElementChild;
    if (!card) return;
    const step = card.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0);
    track.scrollTo({
      left: Math.round(track.scrollLeft / step) * step,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }

  return (
    <div className="recommend-carousel" role="region" aria-label="추천 일정" aria-roledescription="캐러셀">
      <button className="carousel-arrow carousel-prev" aria-label="이전 추천 일정" aria-controls="recommendation-track" disabled={edges.start} onClick={() => move(-1)}>
        <ChevronLeft aria-hidden="true" />
      </button>
      <div id="recommendation-track" className="recommend-options" ref={trackRef} tabIndex={0} aria-label={`추천 일정 ${count}개`}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onPointerLeave={(event) => { if (!dragRef.current?.active) endDrag(event); }}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (suppressClick.current && event.detail !== 0) {
            event.preventDefault();
            event.stopPropagation();
            suppressClick.current = false;
          }
        }}
        onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          move(event.key === 'ArrowLeft' ? -1 : 1);
        }
      }}>
        {children}
      </div>
      <button className="carousel-arrow carousel-next" aria-label="다음 추천 일정" aria-controls="recommendation-track" disabled={edges.end} onClick={() => move(1)}>
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}
