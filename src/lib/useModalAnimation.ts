"use client";

import { useEffect, useRef, useState } from "react";

// Keep in sync with the .modal-panel/.modal-overlay "closing" animation
// duration in globals.css.
const CLOSE_ANIMATION_MS = 180;

// Keeps a modal mounted through its exit animation instead of vanishing
// instantly when `isOpen` flips to false. The isOpen/prevIsOpen comparison
// is React's documented pattern for adjusting state during render off a
// prop change (rather than in an effect) — it has to happen before paint,
// otherwise the first frame after `isOpen` goes true would render as if
// still closed.
export function useModalAnimation(isOpen: boolean, onClosed?: () => void) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  });

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else {
      setIsClosing(true);
    }
  }

  useEffect(() => {
    if (!isClosing) return;
    const timer = setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      onClosedRef.current?.();
    }, CLOSE_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [isClosing]);

  return { shouldRender, isClosing };
}
