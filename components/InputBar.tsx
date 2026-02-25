"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface InputBarProps {
  onSubmitName: (name: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  disabled: boolean;
}

interface Position {
  x: number;
  y: number;
}

export default function InputBar({
  onSubmitName,
  onGenerate,
  isLoading,
  disabled,
}: InputBarProps) {
  const [value, setValue] = useState("");
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);
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

  const handleMouseDownDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        posX: position.x,
        posY: position.y,
      };
    },
    [position]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: `calc(48px + ${position.y}px)`,
        left: `calc(50% + ${position.x}px)`,
        transform: "translateX(-50%)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.5rem",
        userSelect: isDragging ? "none" : undefined,
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDownDrag}
        title="Drag to reposition"
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          display: "grid",
          gridTemplateColumns: "repeat(3, 3px)",
          gap: "2.5px",
          padding: "4px",
          opacity: 0.3,
          transition: "opacity 0.2s",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.7")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.3")}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: 3,
              borderRadius: "50%",
              backgroundColor: "var(--fg-muted)",
            }}
          />
        ))}
      </div>

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
