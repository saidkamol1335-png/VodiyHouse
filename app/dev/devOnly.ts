// Действия стендов — открытые POST: их ID общие для всего приложения, и вызвать их можно мимо
// layout /dev. Поэтому каждое первой строкой проверяет, что это не продакшен (lib/admin/devStands.test.ts).
export function devOnly() {
  if (process.env.NODE_ENV === "production") throw new Error("Стенд только для разработки");
}
