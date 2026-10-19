import { initialsOf } from "@/lib/format";

/** Кружок с инициалами сотрудника (мокап: .ava--amber). */
export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}
