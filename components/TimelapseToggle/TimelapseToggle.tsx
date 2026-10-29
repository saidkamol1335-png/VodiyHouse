import { Pause, Play } from "lucide-react";

export type TimelapseToggleLabels = { pause: string; play: string };

type TimelapseToggleProps = {
  paused: boolean;
  /** «Остановить ролик» / «Продолжить ролик» — тексты timelapse.*, сервер передаёт пропсами. */
  labels: TimelapseToggleLabels;
  onToggle: () => void;
  /** Класс места: где кнопка стоит на экране, решает блок ролика. */
  className: string;
};

/**
 * Пауза ролика стройки (WCAG 2.2.2: движение дольше 5 с — с возможностью остановить). Видна, пока ролик
 * идёт; доиграл — кнопки нет, на экране постер.
 */
export function TimelapseToggle({ paused, labels, onToggle, className }: TimelapseToggleProps) {
  const label = paused ? labels.play : labels.pause;
  return (
    <button
      type="button"
      className={`timelapse-toggle ${className}`}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
    </button>
  );
}
