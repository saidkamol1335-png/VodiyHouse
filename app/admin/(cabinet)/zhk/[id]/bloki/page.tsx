import { ComplexBlocksForm } from "@/components/ComplexBlocksForm";
import { removeDeadlineChangeAction } from "@/lib/admin/actions/complexContent";
import { saveComplexBlocksAction } from "@/lib/admin/actions/complexes";
import { readDeadlineChanges } from "@/lib/admin/server/complexContent";
import { complexForTab } from "@/lib/admin/server/complexPage";
import { readBlocks } from "@/lib/admin/server/complexTabs";
import { readDictionary } from "@/lib/admin/server/developers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** Вкладка «Блоки» (И4): карточки-сводки, правка на месте, порядок стрелками, переносы сроков. */
export default async function ComplexBlocksPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params, "blocks");
  if (!complex) return null;
  const supabase = await createSupabaseServerClient();
  const [blocks, finishings, deadlineChanges] = await Promise.all([
    readBlocks(supabase, complex.id),
    readDictionary(supabase, "finishings"),
    readDeadlineChanges(supabase, complex.id),
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
      deadlineChanges={deadlineChanges}
      removeDeadlineChange={removeDeadlineChangeAction}
    />
  );
}
