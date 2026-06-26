'use client';

import { useEffect } from 'react';

/**
 * Locks body scroll when `isOpen` is true.
 * Restores overflow on close and cleanup.
 */
export function useBodyScrollLock(isOpen: boolean): void {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
}
