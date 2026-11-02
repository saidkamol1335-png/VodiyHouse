import { defineConfig } from "eslint/config";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Общий пакет без React и Next: только правила TypeScript, как у приложений.
export default defineConfig([...nextTs, prettier]);
