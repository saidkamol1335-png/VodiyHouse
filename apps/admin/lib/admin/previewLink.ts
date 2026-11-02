import type { ContentErrorCode } from "@/lib/admin/developers/errors";

/** Ответ «ссылка предпросмотра»: адрес сайта с грантом на 15 минут или код ошибки формы. */
export type PreviewLinkResult = { status: "ok"; url: string } | { status: "error"; error: ContentErrorCode };
