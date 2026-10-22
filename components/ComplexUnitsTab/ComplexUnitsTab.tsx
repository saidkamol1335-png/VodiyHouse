import Link from "next/link";
import { useTranslations } from "next-intl";
import { AdminPanel } from "@/components/AdminPanel";
import { UnitsBlockSwitch } from "@/components/UnitsBlockSwitch";
import { UnitsBlockView } from "@/components/UnitsBlockView";
import { UnitsGenerator } from "@/components/UnitsGenerator";
import { UnitsListNotice, UnitsNoticeProvider } from "@/components/UnitsNotice";
import { UnitsBarProvider } from "@/components/UnitsUndoBar";
import type {
  CreateBlockUnitsInput,
  CreateBlockUnitsResult,
  SaveRisersInput,
  SaveRisersResult,
  UnitsAction,
  UnitsBlock,
  UnitsListActions,
  UnitsTabView,
} from "@/lib/admin/units/types";

export type ComplexUnitsTabProps = {
  view: UnitsTabView;
  tabHref: string;
  blocksHref: string;
  layoutsHref: string;
  /** ЖК на сайте: новые квартиры сразу попадут в «осталось N». */
  published: boolean;
  createAction: UnitsAction<CreateBlockUnitsInput, CreateBlockUnitsResult>;
  saveRisersAction: UnitsAction<SaveRisersInput, SaveRisersResult>;
  /** Чтение списка и статус; без status — список только для просмотра. */
  listActions: UnitsListActions;
  /** Имя сотрудника — «только что · имя» у сменённой строки. */
  viewerName: string | null;
  /** Запрос адреса, который переключатель блоков сохраняет (стенд: ?demo=…). */
  switchQuery?: string | null;
};

/** Вкладка «Квартиры» (Н6): блок без списка — генератор на месте списка, со списком — стояки и список. */
export function ComplexUnitsTab(props: ComplexUnitsTabProps) {
  const t = useTranslations("admin.complexes.units");
  const { view, tabHref, blocksHref } = props;
  return (
    <AdminPanel title={t("title")} wide>
      <UnitsNoticeProvider blockId={view.block?.id ?? null}>
        <UnitsBarProvider>
          <div className="complex-units">
            <p className="complex-units__lead">{t("lead")}</p>
            {view.block === null ? (
              <p className="complex-units__note">
                {t("empty")} <Link href={blocksHref}>{t("toBlocks")}</Link>
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
  const t = useTranslations("admin.complexes.units");
  const { view } = props;
  // Список страница не несёт: есть ли он — по числу квартир блока (12.4).
  if (block.unitCount > 0) {
    return (
      <UnitsBlockView
        key={block.id}
        block={block}
        layouts={view.layouts}
        finishings={view.finishings}
        actions={props.listActions}
        saveRisersAction={props.saveRisersAction}
        viewerName={props.viewerName}
        published={props.published}
      />
    );
  }
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
      layouts={view.layouts}
      layoutsHref={props.layoutsHref}
      published={props.published}
      action={props.createAction}
    />
  );
}
