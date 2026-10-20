import { mkdirSync } from "node:fs";
import { test as setup } from "@playwright/test";
import { cabinetState, e2eStaff, hasCloud, NO_CLOUD, signIn } from "./cloud";

// Сессии руководителя, менеджера и видеографа для тестов кабинета против облака — 3 входа на прогон.
for (const persona of ["head", "manager", "videographer"] as const) {
  setup(`вход: ${persona}`, async ({ page }) => {
    setup.skip(!hasCloud, NO_CLOUD);
    const { email, password } = e2eStaff()[persona];
    await signIn(page, email, password);
    mkdirSync("test-results/.auth", { recursive: true });
    await page.context().storageState({ path: cabinetState(persona)! });
  });
}
