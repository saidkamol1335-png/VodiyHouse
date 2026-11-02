"use client";

import { AdminUnavailable } from "@/components/AdminUnavailable";

// Здесь, а не в (cabinet): error.js не ловит ошибки layout своего сегмента (docs: error.md),
// а сессию читает (cabinet)/layout.tsx. Подробности ошибки сотруднику не показываем.
export default function AdminError({ retry }: { error: unknown; retry: () => void }) {
  return <AdminUnavailable onRetry={retry} />;
}
