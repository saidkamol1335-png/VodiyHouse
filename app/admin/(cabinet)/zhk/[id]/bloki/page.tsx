import { ComplexBlocksForm } from "@/components/ComplexBlocksForm";
import { saveComplexBlocksAction } from "@/lib/admin/actions/complexes";
import { complexForTab } from "@/lib/admin/server/complexPage";
import { readBlocks } from "@/lib/admin/server/complexTabs";
import { readDictionary } from "@/lib/admin/server/developers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** Вкладка «Блоки» (И4): карточки-сводки, правка на месте, порядок стрелками. */
export default async function ComplexBlocksPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params);
  if (!complex) return null;
  const supabase = await createSupabaseServerClient();
  const [blocks, finishings] = await Promise.all([
    readBlocks(supabase, complex.id),
    readDictionary(supabase, "finishings"),
  ]);
  const options = finishings
    .filter(
      (item) => item.isActive || blocks.some((block) => block.finishingId === String(item.id)),
    )
    .map((item) => ({ value: String(item.id), label: item.name.ru }));
  return (
    <ComplexBlocksForm
      key={complex.id}
      complexId={complex.id}
      blocks={blocks}
      finishings={options}
      action={saveComplexBlocksAction}
    />
  );
}
