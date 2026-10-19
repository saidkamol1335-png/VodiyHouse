import { notFound } from "next/navigation";
import { EffectsPreview } from "@/components/EffectsPreview";
import { TokenPreview } from "@/components/TokenPreview";

// Витрина токенов и эффектов для дизайн-интервью. В продакшене её нет.
export default function DevPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <TokenPreview>
      <EffectsPreview />
    </TokenPreview>
  );
}
