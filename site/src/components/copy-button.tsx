"use client";

import { useEffect, useRef, useState } from "react";

interface CopyButtonProps {
  value: string;
  label: string;
}

let lastAnnouncedMessage = "";

function legacyCopy(text: string): boolean {
  const field = Object.assign(document.createElement("textarea"), { value: text });
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } finally {
    field.remove();
  }
}

export function CopyButton({ value, label }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const [announcement, setAnnouncement] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function handleCopy() {
    if (!value) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      ok = legacyCopy(value);
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    setState(ok ? "copied" : "failed");

    let msg = ok ? "Copied" : "Copy failed";
    if (msg === lastAnnouncedMessage) {
      msg += "\u00A0";
    }
    lastAnnouncedMessage = msg;
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(msg));

    timerRef.current = setTimeout(() => {
      setState("idle");
      setAnnouncement("");
    }, 2000);
  }

  return (
    <span className="copy-wrap">
      <button
        type="button"
        className="copy-btn"
        aria-label={label}
        data-copied={state === "copied" ? "" : undefined}
        data-failed={state === "failed" ? "" : undefined}
        onClick={handleCopy}
      >
        {state === "copied" ? (
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
            <path d="M10.5 5.5V3.5A1 1 0 0 0 9.5 2.5H3.5A1 1 0 0 0 2.5 3.5V9.5A1 1 0 0 0 3.5 10.5H5.5" />
          </svg>
        )}
      </button>
      <span className="copy-tip" role="status">
        {announcement}
      </span>
    </span>
  );
}
