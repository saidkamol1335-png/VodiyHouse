import Link from "next/link";
import { useTranslations } from "next-intl";
import { AdminPanel } from "@/components/AdminPanel";
import { UnitsBlockSwitch } from "@/components/UnitsBlockSwitch";
import { UnitsGenerator } from "@/components/UnitsGenerator";
import { UnitsCreatedNotice, UnitsNoticeProvider } from "@/components/UnitsNotice";
import { UnitsRisers } from "@/components/UnitsRisers";
import type {
  CreateBlockUnitsInput,
  CreateBlockUnitsResult,
  SaveRisersInput,
  SaveRisersResult,
  UnitsAction,
  UnitsBlock,
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
};

/** Вкладка «Квартиры» (Н6): блок без списка — генератор на месте списка, со списком — стояки. */
export function ComplexUnitsTab(props: ComplexUnitsTabProps) {
  const t = useTranslations("admin.complexes.units");
  const { view, tabHref, blocksHref } = props;
  return (
    <AdminPanel title={t("title")} wide>
      <UnitsNoticeProvider>
        <div className="complex-units">
          <p className="complex-units__lead">{t("lead")}</p>
          {view.block === null ? (
            <p className="complex-units__note">
              {t("empty")} <Link href={blocksHref}>{t("toBlocks")}</Link>
            </p>
          ) : (
            <>
              {view.blocks.length > 1 ? (
                <UnitsBlockSwitch blocks={view.blocks} current={view.block.id} href={tabHref} />
              ) : null}
              <BlockUnits {...props} block={view.block} />
            </>
          )}
        </div>
      </UnitsNoticeProvider>
    </AdminPanel>
  );
}

function BlockUnits({ block, ...props }: ComplexUnitsTabProps & { block: UnitsBlock }) {
  const t = useTranslations("admin.complexes.units");
  const { view } = props;
  if (view.ready) {
    return (
      <>
        <p className="complex-units__listed">
          <b>{t("blockName", { name: block.name })}</b> · {t("listed", { count: view.ready.count })}
        </p>
        <UnitsCreatedNotice blockId={block.id} />
        <UnitsRisers
          key={block.id}
          blockId={block.id}
          ready={view.ready}
          layouts={view.layouts}
          action={props.saveRisersAction}
        />
        <p className="complex-units__note">{t("listSoon")}</p>
      </>
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
