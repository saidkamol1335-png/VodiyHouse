import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { Badge, type BadgeTone } from "@/components/Badge";
import { staffState, type StaffMember, type StaffState } from "@/lib/admin/staff/directory";
import { formatDate, formatDateTime } from "@/lib/format";

type StaffListProps = {
  members: readonly StaffMember[];
  /** Свою строку не отключить и не сбросить — у неё «Это вы» и нет действий. */
  viewerId: string;
  /** Кнопки строки (шаг 8.11); на сервере — функция, без неё строки только для чтения. */
  actionsFor?: (member: StaffMember) => ReactNode;
};

// Плашка состояния; расхождение базы и Auth — та же плашка плюс предупреждение под строкой.
const STATE_BADGE: Record<StaffState, { tone: BadgeTone; label: "active" | "pending" | "inactive" }> = {
  active: { tone: "ok", label: "active" },
  pending: { tone: "amber", label: "pending" },
  inactive: { tone: "bad", label: "inactive" },
  inactiveNotBanned: { tone: "bad", label: "inactive" },
  activeBanned: { tone: "amber", label: "active" },
};

/** «Настройки → Сотрудники» (С1): строки как «Остатки по ЖК» мокапа; на телефоне — карточки. */
export function StaffList({ members, viewerId, actionsFor }: StaffListProps) {
  const t = useTranslations("admin.staff");
  return (
    <section className="staff-list" aria-labelledby="staff-list-title">
      <header className="staff-list__head">
        <h2 id="staff-list-title" className="staff-list__title">
          {t("title")}
        </h2>
        <span className="staff-list__count">{t("count", { count: members.length })}</span>
      </header>
      <ul className="staff-list__rows">
        {members.map((member) => (
          <StaffRow key={member.id} member={member} isSelf={member.id === viewerId} actions={actionsFor?.(member)} />
        ))}
      </ul>
    </section>
  );
}

function StaffRow({ member, isSelf, actions }: { member: StaffMember; isSelf: boolean; actions: ReactNode }) {
  const t = useTranslations("admin");
  const state = staffState(member);
  const badge = STATE_BADGE[state];
  const warning = state === "inactiveNotBanned" || state === "activeBanned" ? t(`staff.state.${state}`) : null;
  const rowClass = `staff-list__row${member.isActive ? "" : " staff-list__row--inactive"}`;
  return (
    <li className={rowClass}>
      <Avatar name={member.fullName} className="staff-list__avatar" />
      <div className="staff-list__person">
        <span className="staff-list__name">{member.fullName}</span>
        <span className="staff-list__email">{member.email}</span>
      </div>
      <div className="staff-list__badges">
        <Badge tone="line" size="sm">
          {t(`user.roles.${member.role}`)}
        </Badge>
        <Badge tone={badge.tone} size="sm" dot>
          {t(`staff.state.${badge.label}`)}
        </Badge>
        {isSelf ? (
          <Badge tone="blue" size="sm">
            {t("staff.you")}
          </Badge>
        ) : null}
      </div>
      <div className="staff-list__meta">
        <span>{t("staff.added", { date: formatDate(new Date(member.createdAt)) })}</span>
        <span>
          {member.lastSignInAt
            ? t("staff.lastSignIn", { dateTime: formatDateTime(new Date(member.lastSignInAt)) })
            : t("staff.neverSignedIn")}
        </span>
      </div>
      {isSelf || !actions ? null : <div className="staff-list__actions">{actions}</div>}
      {warning ? (
        <p className="staff-list__warning" role="note">
          {warning}
        </p>
      ) : null}
    </li>
  );
}
