"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface InputBarProps {
  onSubmitName: (name: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export default function InputBar({
  onSubmitName,
  onGenerate,
  isLoading,
  disabled,
}: InputBarProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && value.trim()) {
        onSubmitName(value.trim());
        setValue("");
      }
    },
    [value, onSubmitName]
  );

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: "48px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Input field */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0",
          width: "min(480px, 80vw)",
          borderBottom: "1px solid var(--fg)",
          paddingBottom: "6px",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="type a name, press enter"
          spellCheck={false}
          autoComplete="off"
          style={{
            flex: 1,
            background: "none",
            border: "none",
            outline: "none",
            fontFamily: "var(--font-mono)",
            fontSize: "1rem",
            color: "var(--fg)",
            caretColor: "var(--accent)",
            letterSpacing: "0.02em",
            opacity: disabled ? 0.4 : 1,
          }}
        />
      </div>

      <style>{`
        input::placeholder {
          color: var(--fg-muted);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
