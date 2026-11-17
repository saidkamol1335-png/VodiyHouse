import { getLocale, getTranslations } from "next-intl/server";
import type { TeamMember } from "@vh/shared/about";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { SitePhoto } from "@/components/SitePhoto";
import type { Locale } from "@/lib/i18n/routing";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("");

/**
 * «Jamoa» / «Команда» на /o-nas (правки 15.11, п. 25; образец — «Менеджмент» Uzum): фото, имя и
 * должность. На сайте — только сотрудники с отметкой согласия (её проверяет база); без фото —
 * инициалы. Ведёт руководитель («Настройки → О компании»); пусто — раздела нет.
 */
export async function AboutTeam({ members }: { members: readonly TeamMember[] }) {
  if (members.length === 0) return null;
  const [t, locale] = await Promise.all([getTranslations("about.team"), getLocale()]);
  const lang = locale as Locale;
  return (
    <section className="about-team" aria-labelledby="about-team-title">
      <Container>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <div id="about-team-title" className="about-team__title">
          <Heading level={2}>{t("title")}</Heading>
        </div>
        <ul className="about-team__grid">
          {members.map((member) => (
            <li key={member.id} className="about-team__member">
              {member.photo ? (
                <SitePhoto photo={{ ...member.photo, focus: { x: 0.5, y: 0.3 } }} alt={member.name} frame="phone" sizes="(max-width: 760px) 50vw, 280px" className="about-team__photo" />
              ) : (
                <span className="about-team__initials" aria-hidden="true">
                  {initials(member.name)}
                </span>
              )}
              <b className="about-team__name">{member.name}</b>
              <span className="about-team__position">{member.position[lang]}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
