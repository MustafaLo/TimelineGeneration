"use client";

import { useState, useEffect } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // On mount: read from localStorage and hydrate
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // Corrupt/stale data — silently discard
      localStorage.removeItem(key);
    }
    setIsHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On value change (after hydration): persist to localStorage
  useEffect(() => {
    if (!isHydrated) return; // don't overwrite before first read
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      // Storage quota exceeded or private browsing — ignore
    }
  }, [key, value, isHydrated]);

  return [value, setValue, isHydrated];
}
