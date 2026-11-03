import { describe, expect, it } from "vitest";
import { hasIssues, reportIssues, type IssueInput } from "@/components/ProgressReportForm/issues";
import { yandexRouteUrl } from "@/lib/geo";
import { incomingFolder, incomingPath, INCOMING_PATH_PATTERN, PROGRESS_PHOTO_PATH_PATTERN } from "@/lib/media";
import { noticeLine, progressReturnedText, progressSubmittedText, type ProgressNotice } from "./notify";
import { canOpenVideoTab, videoTabLabelKey, videoTabsFor } from "./tabs";
import { monthOfShot, shotDateBounds, tashkentDay } from "./types";
import { failureStatus, isDuplicate, isRetryable, nextRetryDelay } from "./uploadRetry";

// Проект-2, фаза E (PLAN §10, пп. 31–38): дата съёмки, повторы загрузки, проверка формы, пути incoming,
// тексты уведомлений, вкладки раздела, «Маршрут».

const UID = "11111111-1111-4111-8111-111111111111";
const CID = "22222222-2222-4222-8222-222222222222";

describe("дата съёмки (п. 33)", () => {
  it("сегодня по Ташкенту и окно 60 дней", () => {
    // 3 ноября 20:30 UTC — в Ташкенте уже 4 ноября.
    expect(tashkentDay(new Date("2026-11-03T20:30:00Z"))).toBe("2026-11-04");
    expect(shotDateBounds(new Date("2026-11-03T08:00:00Z"))).toEqual({ min: "2026-09-04", max: "2026-11-03" });
    expect(shotDateBounds(new Date("2027-01-10T08:00:00Z"))).toEqual({ min: "2026-11-11", max: "2027-01-10" });
  });

  it("месяц отчёта — из даты съёмки", () => {
    expect(monthOfShot("2026-11-03")).toBe("2026-11-01");
    expect(monthOfShot("2026-12-31")).toBe("2026-12-01");
  });
});

describe("повторы загрузки фото (п. 37)", () => {
  it("сеть и сбои сервера — повтор; право, вид, размер — нет; «уже есть» — успех", () => {
    expect(isRetryable({ message: "Failed to fetch" })).toBe(true);
    expect(isRetryable({ statusCode: "503", message: "" })).toBe(true);
    expect(isRetryable({ status: 429 })).toBe(true);
    for (const status of [400, 401, 403, 413]) expect(isRetryable({ status })).toBe(false);
    expect(isDuplicate({ statusCode: "409", message: "" })).toBe(true);
    expect(isDuplicate({ statusCode: "400", message: "The resource already exists" })).toBe(true);
    expect(isDuplicate({ status: 403, message: "new row violates row-level security policy" })).toBe(false);
    expect(failureStatus(null)).toBe(0);
  });

  it("задержки 2, 5, 10, 30, 60 с, потом — всё", () => {
    expect([0, 1, 2, 3, 4].map(nextRetryDelay)).toEqual([2000, 5000, 10000, 30000, 60000]);
    expect(nextRetryDelay(5)).toBeNull();
  });
});

describe("проверка формы отчёта (п. 32)", () => {
  const base: IssueInput = {
    mode: "submit",
    shotOn: "2026-11-03",
    photosWorking: false,
    photos: 3,
    videoStatus: "idle",
    hasLink: false,
    comment: { ru: "Залит этаж", uz: "Qavat" },
  };

  it("«На проверку» — 3 загруженных фото, видео загружено, комментарий на двух языках", () => {
    expect(hasIssues(reportIssues(base))).toBe(false);
    expect(reportIssues({ ...base, photos: 2 })).toEqual({ photos: "photosMin" });
    expect(reportIssues({ ...base, photosWorking: true })).toEqual({ photos: "photosWait" });
    expect(reportIssues({ ...base, videoStatus: "offline" })).toEqual({ video: "videoWait" });
    expect(reportIssues({ ...base, comment: { ru: "Есть", uz: " " } })).toEqual({ comment: "commentMissing" });
  });

  it("черновик — неполный можно; дата и «файл или ссылка» — нужны", () => {
    const draft = { ...base, mode: "draft" as const, photos: 0, photosWorking: true, comment: { ru: "", uz: "" } };
    expect(hasIssues(reportIssues(draft))).toBe(false);
    expect(reportIssues({ ...draft, shotOn: "" })).toEqual({ shot: "shotDateMissing" });
    expect(reportIssues({ ...draft, videoStatus: "done", hasLink: true })).toEqual({ video: "videoBoth" });
  });
});

describe("пути incoming (п. 13)", () => {
  it("папка автора и ЖК, uuid-имя; публичный путь — другой шаблон", () => {
    const path = incomingPath(UID, CID, "jpg");
    expect(path.startsWith(incomingFolder(UID, CID))).toBe(true);
    expect(INCOMING_PATH_PATTERN.test(path)).toBe(true);
    expect(INCOMING_PATH_PATTERN.test(incomingPath(UID, CID, "mp4"))).toBe(true);
    expect(PROGRESS_PHOTO_PATH_PATTERN.test(path)).toBe(false);
    expect(INCOMING_PATH_PATTERN.test(`complexes/${CID}/${UID}.jpg`)).toBe(false);
  });
});

describe("уведомления об отчётах (п. 36)", () => {
  const notice: ProgressNotice = {
    complex: "Yulduz",
    block: "A",
    unit: "12",
    is_unit: true,
    shot_on: "2026-11-03",
    author: "Азиз",
  };

  it("подпись: ЖК, блок, квартира, дата съёмки", () => {
    expect(noticeLine(notice)).toBe("ЖК Yulduz · Блок A · кв. 12 · снято 03.11.2026");
    expect(noticeLine({ ...notice, unit: null, is_unit: false })).toBe("ЖК Yulduz · Блок A · снято 03.11.2026");
  });

  it("руководителю — со ссылкой на отчёт, автору — с причиной", () => {
    const submitted = progressSubmittedText(notice, "https://admin/video?report=1");
    expect(submitted).toContain("Снял: Азиз");
    expect(submitted).toContain("https://admin/video?report=1");
    expect(progressReturnedText(notice, "Контакты в кадре", "https://x")).toContain("Что исправить: Контакты в кадре");
  });
});

describe("вкладки раздела (п. 38) и «Маршрут» (п. 35)", () => {
  it("мобилограф — четыре вкладки, менеджер — «Проверка» и «Медиа ЖК»", () => {
    expect(videoTabsFor("mobilographer").map((tab) => tab.key)).toEqual(["home", "new", "mine", "media"]);
    expect(videoTabsFor("manager").map((tab) => tab.key)).toEqual(["home", "media"]);
    expect(canOpenVideoTab("manager", "new")).toBe(false);
    expect(videoTabLabelKey("mobilographer", "home")).toBe("tasks");
    expect(videoTabLabelKey("head", "home")).toBe("review");
  });

  it("маршрут Яндекс Карт — до точки ЖК, lat,lng", () => {
    expect(yandexRouteUrl({ lat: 40.38, lng: 71.78 })).toBe("https://yandex.uz/maps/?rtext=~40.38,71.78&rtt=auto");
  });
});
