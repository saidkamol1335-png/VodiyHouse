"use client";

import { Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";

const DONE_MS = 2_000;

/** «Ссылка»: адрес в буфер — «Скопировано» на 2 с; буфер недоступен — адрес текстом, скопировать вручную. */
export function CopyLinkButton({ url }: { url: string }) {
  const t = useTranslations("admin.video.clientVideos");
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  useEffect(() => {
    if (state !== "done") return;
    const timer = setTimeout(() => setState("idle"), DONE_MS);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = () => {
    const copied = navigator.clipboard?.writeText(url);
    if (!copied) return setState("failed");
    copied.then(
      () => setState("done"),
      () => setState("failed"),
    );
  };
  return (
    <>
      <Button variant="outline" size="sm" onClick={copy}>
        <Link2 size={16} aria-hidden="true" />
        {state === "done" ? t("copied") : t("copy")}
      </Button>
      <span className="progress-overview__manual" aria-live="polite">
        {state === "failed" ? t("manual", { url }) : ""}
      </span>
    </>
  );
}
