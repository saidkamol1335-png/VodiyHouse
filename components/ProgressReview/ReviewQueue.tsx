import { Eye } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { LeadWhen } from "@/components/LeadWhen";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import type { ReviewItem } from "@/lib/admin/progress/types";
import { formatMonthYear } from "@/lib/format";
import { mediaPublicUrl } from "@/lib/media";

/**
 * «Ждут проверки · N» (фаза 5, мокап CabReview): отчёты видеографов — старые сверху; «Проверить»
 * открывает ящик отчёта (?report=<id>). Пусто — панели нет.
 */
export async function ReviewQueue({ items }: { items: readonly ReviewItem[] }) {
  const t = await getTranslations("admin.video.review");
  if (items.length === 0) return null;
  return (
    <AdminPanel title={t("queue", { n: items.length })}>
      <p className="progress-review__rule">
        <Badge tone="amber" size="sm">
          {t("rule12Badge")}
        </Badge>
      </p>
      <ul className="progress-review__queue">
        {items.map((item) => (
          <QueueItem key={item.id} item={item} />
        ))}
      </ul>
    </AdminPanel>
  );
}

async function QueueItem({ item }: { item: ReviewItem }) {
  const t = await getTranslations("admin.video");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const unit = item.unitNumber ? t("mine.unit", { number: item.unitNumber }) : "";
  return (
    <li className="progress-review__item">
      {item.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- миниатюра 76 × 50 из бакета в кабинете
        <img
          className="progress-review__thumb"
          src={mediaPublicUrl(supabaseUrl, item.thumb)}
          alt=""
          loading="lazy"
        />
      ) : (
        <span className="progress-review__thumb" />
      )}
      <div className="progress-review__text">
        <p className="progress-review__title">
          {t("mine.item", {
            complex: item.complexName,
            block: item.blockName,
            unit,
            month: formatMonthYear(item.month),
          })}
        </p>
        <p className="progress-review__meta">
          {item.author ?? t("review.noAuthor")} · <LeadWhen at={item.createdAt} /> ·{" "}
          {t(item.video ? "review.filesVideo" : "review.files", { n: item.photos })}
        </p>
      </div>
      <Button href={`${ADMIN_ROUTES.video}?report=${item.id}`} variant="outline" size="sm">
        <Eye size={16} aria-hidden="true" />
        {t("review.check")}
      </Button>
    </li>
  );
}
