"use client";

import { useChain } from "../context/ChainContext";

export default function Toasts() {
  const { toasts, dismissToast } = useChain();
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          onClick={() => dismissToast(t.id)}
        >
          {t.type === "success" && "✓ "}
          {t.type === "error" && "✗ "}
          {t.type === "info" && "▸ "}
          {t.msg}
        </div>
      ))}
    </div>
  );
}