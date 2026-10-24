"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useEffect } from "react";

export type ToastMessage = { id: number; tone: "success" | "error"; text: string };

type ActionToastProps = {
  message: ToastMessage | null;
  closeLabel: string;
  onClose: () => void;
};

const SHOW_MS = 6000;

/**
 * Итог действия, сделанного сразу (тумблер, «Условия проверены»): полоса мокапа (.toast) справа
 * снизу, на телефоне — во всю ширину. Живая область есть всегда — диктор слышит и первый ответ.
 */
export function ActionToast({ message, closeLabel, onClose }: ActionToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  const Icon = message?.tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div className="action-toast" role="status" aria-live="polite">
      {message ? (
        <div
          key={message.id}
          className={`action-toast__item action-toast__item--${message.tone}`}
          data-testid="action-toast"
        >
          <Icon size={18} aria-hidden="true" className="action-toast__icon" />
          <span className="action-toast__text">{message.text}</span>
          <button
            type="button"
            className="action-toast__close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
