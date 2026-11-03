import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Server Action — открытый POST: страница его не защищает. Правило шага 8: первое, что делает
// действие кабинета, — проверяет сотрудника (requireActionViewer или headGuard поверх него).
// Вход и выход — без сессии по смыслу.
const DIR = path.join("lib", "admin", "actions");
const WITHOUT_SESSION = new Set(["signInAction", "signOutAction"]);
const GUARD = /^\s*const guard = await (requireActionViewer|headGuard|editGuard)\(/;

const files = readdirSync(DIR).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));

// Git на Windows (autocrlf) отдаёт файлы с CRLF — разбираем текст с одними LF.
const readSource = (file: string) =>
  readFileSync(path.join(DIR, file), "utf8").replace(/\r\n/g, "\n");

function exportedFunctions(source: string): { name: string; body: string }[] {
  const pattern = /export async function (\w+)\([^)]*\)[^{]*\{\n([\s\S]*?)\n\}/g;
  return [...source.matchAll(pattern)].map((match) => ({ name: match[1]!, body: match[2]! }));
}

describe("Server Actions кабинета", () => {
  it.each(files)('%s: только async-функции и "use server" первой строкой', (file) => {
    const source = readSource(file);
    expect(source.startsWith('"use server";')).toBe(true);
    const exports = [...source.matchAll(/^export (?!async function)(.+)$/gm)].map(
      (match) => match[1],
    );
    expect(exports).toEqual([]);
  });

  it.each(files)("%s: каждое действие первой строкой проверяет сотрудника", (file) => {
    const source = readSource(file);
    const actions = exportedFunctions(source);
    expect(actions.length).toBeGreaterThan(0);
    for (const { name, body } of actions) {
      if (WITHOUT_SESSION.has(name)) continue;
      const firstLine =
        body.split("\n").find((line) => line.trim() && !line.trim().startsWith("//")) ?? "";
      expect(firstLine, name).toMatch(GUARD);
    }
  });

  // Квартиры (PLAN §10, п. 6): читают все сотрудники; генератор, правку, цены и удаление ведут
  // руководитель и менеджер (editGuard). База проверит роль ещё раз, но этот слой не должен
  // расшириться молча.
  it("квартиры: роли действий — по PLAN §10, п. 6", () => {
    const guards: Record<string, string> = {
      readBlockUnitsAction: 'requireActionViewer(["head", "manager", "mobilographer"])',
      setUnitsStatusAction: 'requireActionViewer(["head", "manager"])',
      revertUnitsStatusAction: 'requireActionViewer(["head", "manager"])',
      setLayoutAvailableAction: 'requireActionViewer(["head", "manager"])',
    };
    for (const file of ["units.ts", "unitsList.ts", "unitsMass.ts", "unitsStatus.ts"]) {
      const source = readSource(file);
      for (const { name, body } of exportedFunctions(source)) {
        const guard = guards[name] ?? "editGuard()";
        expect(body, name).toContain(`const guard = await ${guard};`);
        if (guard === "editGuard()")
          expect(source, file).toContain('const editGuard = () => requireActionViewer(["head", "manager"]);');
      }
    }
  });

  // Приёмка фазы 1 (PLAN §5): менеджер не создаёт, не публикует и не архивирует ЖК и застройщиков,
  // не правит справочники и сотрудников. Все действия — только руководителю, кроме перечисленных:
  // новое действие с другими ролями без записи здесь — красный тест.
  it("все действия: только руководитель, кроме перечисленных исключений", () => {
    const others: Record<string, RegExp> = {
      changePasswordAction: /requireActionViewer\(STAFF_ROLES, \{ allowPasswordChange: true \}\)/,
      readSiteStockAction: /requireActionViewer\(\["head", "manager"\]\)/,
      // «Сейчас на сайте» (шаг 3.12) — на главной у обоих, как остатки.
      readSiteNowAction: /requireActionViewer\(\["head", "manager"\]\)/,
      // Проект-2 (PLAN §10, п. 6): предпросмотр по гранту — и менеджеру, он правит ЖК.
      previewLinkAction: /requireActionViewer\(\["head", "manager"\]\)/,
      readBlockUnitsAction: /requireActionViewer\(\["head", "manager", "mobilographer"\]\)/,
      setUnitsStatusAction: /requireActionViewer\(\["head", "manager"\]\)/,
      revertUnitsStatusAction: /requireActionViewer\(\["head", "manager"\]\)/,
      setLayoutAvailableAction: /requireActionViewer\(\["head", "manager"\]\)/,
      // «Расчёт для клиента» считают оба (PLAN §3б): снимок при «Скопировать для Telegram».
      saveCalculationAction: /requireActionViewer\(\["head", "manager"\]\)/,
      // Заявки ведут руководитель и менеджер (PLAN §5, шаг 3.7): карточка, статус, ответственный, повтор.
      loadLeadCardAction: /requireActionViewer\(\["head", "manager"\]\)/,
      setLeadStatusAction: /requireActionViewer\(\["head", "manager"\]\)/,
      assignLeadAction: /requireActionViewer\(\["head", "manager"\]\)/,
      retryLeadDeliveryAction: /requireActionViewer\(\["head", "manager"\], \{ fresh: true \}\)/,
      // Отчёты хода строительства (фаза 5): отправляют мобилограф и руководитель; файлы удаляет сервер.
      readProgressUnitsAction: /requireActionViewer\(\["head", "mobilographer"\]\)/,
      // Фаза E: черновик и удаление — тоже они; Telegram уведомлений — только мобилограф (п. 36).
      ...Object.fromEntries(
        ["submitProgressReportAction", "saveProgressDraftAction", "deleteProgressReportAction"].map((name) => [
          name,
          /requireActionViewer\(\["head", "mobilographer"\], \{ fresh: true \}\)/,
        ]),
      ),
      progressTelegramLinkAction: /requireActionViewer\(\["mobilographer"\], \{ fresh: true \}\)/,
      progressTelegramUnlinkAction: /requireActionViewer\(\["mobilographer"\], \{ fresh: true \}\)/,
      // Публикует и возвращает отчёты только руководитель (PLAN §10, п. 6) — проверка headOnly ниже.
      // Журнал: менеджеру — только журнал ЖК (проверка scope в самом действии, п. 29).
      loadJournalAction: /requireActionViewer\(\["head", "manager"\]\)/,
      // Экран кода руководителя (п. 8): пускает без второго фактора, секретный ключ — после fresh.
      ...Object.fromEntries(
        ["telegramLinkAction", "sendLoginCodeAction", "verifyLoginCodeAction", "verifyBackupCodeAction"].map(
          (name) => [name, /requireActionViewer\(\["head"\], \{ fresh: true, allowSecondFactor: true \}\)/],
        ),
      ),
      // Справочники заполнения ЖК: менеджер добавляет пункты (п. 29) — ключ проверяет действие.
      addDictionaryItemAction: /requireActionViewer\(\["head", "manager"\]\)/,
      // «Запросить у руководителя» (п. 25): просит и отзывает менеджер, отклоняет руководитель.
      requestPublicationAction: /requireActionViewer\(\["manager"\]\)/,
      cancelPublicationRequestAction: /requireActionViewer\(\["manager"\]\)/,
      // ЖК, его вкладки, фото, фасад и квартиры правят руководитель и менеджер (PLAN §10, п. 6);
      // статус, порядок каталога и удаление — руководитель.
      ...Object.fromEntries(
        [
          "createComplexAction", "saveComplexMainAction", "saveComplexBlocksAction", "saveBlockLayoutsAction",
          "saveComplexDocumentsAction", "saveComplexVideosAction", "removeDeadlineChangeAction", "saveComplexDetailsAction",
          "attachComplexPhotoAction", "attachComplexDrawingAction", "reorderComplexPhotosAction", "removeComplexPhotoAction",
          "setComplexPhotoCategoryAction", "setComplexPhotoFocusAction", "saveComplexFaqAction",
          "setComplexFacadeAction", "removeComplexFacadeAction", "setBlockContourAction", "saveFloorPlanAction",
          "setFloorPlanContoursAction", "deleteFloorPlanAction",
          "createBlockUnitsAction", "addUnitAction", "updateUnitAction", "deleteBlockUnitsAction", "saveRisersAction",
          "deleteUnitsAction", "setUnitsPriceAction", "setUnitsFinishingAction",
        ].map((name) => [name, /requireActionViewer\(\["head", "manager"\]\)/]),
      ),
    };
    const headOnly = /requireActionViewer\(\["head"\](, \{ fresh: true \})?\)/;
    for (const file of files) {
      const source = readSource(file);
      const headGuard =
        /const headGuard = \(\) => (requireActionViewer\([^\n]+\));|async function headGuard\(\) \{\n\s*const guard = await (requireActionViewer\([^;]+\));/.exec(
          source,
        );
      const editGuard = /const editGuard = \(\) => (requireActionViewer\([^\n]+\));/.exec(source);
      for (const { name, body } of exportedFunctions(source)) {
        if (WITHOUT_SESSION.has(name)) continue;
        const call = /const guard = await ([^;]+);/.exec(body)?.[1] ?? "";
        const resolved =
          call === "headGuard()"
            ? (headGuard?.[1] ?? headGuard?.[2] ?? "")
            : call === "editGuard()"
              ? (editGuard?.[1] ?? "")
              : call;
        expect(resolved, `${file}: ${name}`).toMatch(others[name] ?? headOnly);
      }
    }
  });

  it("headGuard сам спрашивает Auth заново (fresh) и пускает только руководителя", () => {
    const source = readSource("staff.ts");
    expect(source).toMatch(/requireActionViewer\(\["head"\], \{ fresh: true \}\)/);
  });

  // Правило session.ts: перед работой секретным ключом сессию проверяет сам Auth — подпись токена
  // не видит отозванную сессию. Смена пароля — исключение: до секретного ключа Auth и так проверяет
  // временный пароль и меняет пароль по токену сотрудника.
  it("действия с секретным ключом спрашивают Auth заново (fresh)", () => {
    const SECRET_KEY = /deliverLeadNow|createSupabaseAdminClient|hasSupabaseAdminEnv/;
    const AUTH_CHECKED = new Set(["changePasswordAction"]);
    for (const file of files) {
      for (const { name, body } of exportedFunctions(readSource(file))) {
        if (WITHOUT_SESSION.has(name) || AUTH_CHECKED.has(name) || !SECRET_KEY.test(body)) continue;
        expect(/const guard = await ([^;]+);/.exec(body)?.[1], `${file}: ${name}`).toContain(
          "fresh: true",
        );
      }
    }
  });
});
