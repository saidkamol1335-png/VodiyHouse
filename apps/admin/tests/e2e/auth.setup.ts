import { mkdirSync } from "node:fs";
import { test as setup } from "./fixtures";
import { cabinetState, e2eStaff, hasCloud, NO_CLOUD, passSecondFactor, signIn } from "./cloud";

// Сессии руководителя (со вторым фактором), менеджера и двух мобилографов (фаза E) для тестов кабинета
// против облака — 4 входа на прогон.
for (const persona of ["head", "manager", "mobilographer", "mobilographer2"] as const) {
  setup(`вход: ${persona}`, async ({ page }) => {
    setup.skip(!hasCloud, NO_CLOUD);
    const { id, email, password } = e2eStaff()[persona];
    await signIn(page, email, password);
    // Руководителю после пароля — код второго фактора (PLAN §10, п. 8).
    if (persona === "head") await passSecondFactor(page, id);
    mkdirSync("test-results/.auth", { recursive: true });
    await page.context().storageState({ path: cabinetState(persona)! });
  });
}
