import Link from "next/link";
import { useTranslations } from "next-intl";
import { AdminPanel } from "@/components/AdminPanel";
import { UnitsAvailability } from "@/components/UnitsAvailability";
import { UnitsBarDock } from "@/components/UnitsBarDock";
import { UnitsBlockSwitch } from "@/components/UnitsBlockSwitch";
import { UnitsBlockView } from "@/components/UnitsBlockView";
import { UnitsGenerator } from "@/components/UnitsGenerator";
import { UnitsListNotice, UnitsNoticeProvider } from "@/components/UnitsNotice";
import { UnitsBarProvider } from "@/components/UnitsUndoBar";
import type { UnitsBlock, UnitsTabActions, UnitsTabView } from "@/lib/admin/units/types";

export type ComplexUnitsTabProps = {
  view: UnitsTabView;
  tabHref: string;
  blocksHref: string;
  layoutsHref: string;
  /** ЖК на сайте: новые квартиры сразу попадут в «осталось N». */
  published: boolean;
  /** Права — наличием действий (unitsActionsFor): у менеджера нет генератора, стояков и правок. */
  actions: UnitsTabActions;
  /** Имя сотрудника — «только что · имя» у сменённой строки. */
  viewerName: string | null;
  /** Запрос адреса, который переключатель блоков сохраняет (стенд: ?demo=…). */
  switchQuery?: string | null;
};

/**
 * Вкладка «Квартиры» (Н6): блок без списка — «Наличие по планировкам» (Н7) и генератор, со
 * списком — стояки и список. Без генератора (менеджер) — без него и ссылок на вкладки руководителя.
 */
export function ComplexUnitsTab(props: ComplexUnitsTabProps) {
  const t = useTranslations("admin.complexes.units");
  const { view, tabHref, blocksHref, actions } = props;
  const builds = actions.create !== null;
  return (
    <AdminPanel title={t("title")} wide>
      <UnitsNoticeProvider blockId={view.block?.id ?? null}>
        <UnitsBarProvider>
          <div className="complex-units" data-units-tab>
            <p className="complex-units__lead">{t(builds ? "lead" : "leadStock")}</p>
            {view.block === null ? (
              <p className="complex-units__note">
                {builds ? (
                  <>
                    {t("empty")} <Link href={blocksHref}>{t("toBlocks")}</Link>
                  </>
                ) : (
                  t("emptyStock")
                )}
              </p>
            ) : (
              <>
                {view.blocks.length > 1 ? (
                  <UnitsBlockSwitch
                    blocks={view.blocks}
                    current={view.block.id}
                    href={tabHref}
                    query={props.switchQuery}
                  />
                ) : null}
                <BlockUnits {...props} block={view.block} />
              </>
            )}
          </div>
        </UnitsBarProvider>
      </UnitsNoticeProvider>
    </AdminPanel>
  );
}

/** «Создано» или «Список удалён» — над генератором и списком: при смене одного другим не теряется. */
function BlockUnits(props: ComplexUnitsTabProps & { block: UnitsBlock }) {
  return (
    <>
      <UnitsListNotice blockId={props.block.id} createdToo={props.block.unitCount > 0} />
      <BlockBody {...props} />
    </>
  );
}

function BlockBody({ block, ...props }: ComplexUnitsTabProps & { block: UnitsBlock }) {
  const { view, actions } = props;
  // Список страница не несёт: есть ли он — по числу квартир блока (12.4).
  if (block.unitCount > 0) {
    return (
      <UnitsBlockView
        key={block.id}
        block={block}
        layouts={view.layouts}
        finishings={view.finishings}
        actions={actions.list}
        saveRisersAction={actions.saveRisers}
        viewerName={props.viewerName}
        published={props.published}
      />
    );
  }
  // У руководителя без планировок о них скажет генератор — второй раз не повторяем.
  const availability =
    actions.layoutAvailable && (view.layouts.length > 0 || !actions.create) ? (
      <UnitsAvailability
        key={block.id}
        block={block}
        layouts={view.layouts}
        action={actions.layoutAvailable}
      />
    ) : null;
  // Своя полоса и у блока без списка: ответ тапа из другого блока и отказ Н7 видны и здесь.
  return (
    <div className="complex-units__stock" data-units-dock-host>
      {availability}
      <Generator {...props} block={block} />
      <UnitsBarDock blockId={block.id} />
    </div>
  );
}

function Generator({ block, ...props }: ComplexUnitsTabProps & { block: UnitsBlock }) {
  const t = useTranslations("admin.complexes.units");
  const create = props.actions.create;
  if (!create) return null;
  if (block.floorsTotal === null) {
    return (
      <p className="complex-units__note">
        {t("noFloors")} <Link href={props.blocksHref}>{t("toFloors")}</Link>
      </p>
    );
  }
  return (
    <UnitsGenerator
      key={block.id}
      blockId={block.id}
      floors={block.floorsTotal}
      layouts={props.view.layouts}
      layoutsHref={props.layoutsHref}
      published={props.published}
      action={create}
    />
  );
}
