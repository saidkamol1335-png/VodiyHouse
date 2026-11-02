// Server Action из браузера: обрыв связи и сбой 5xx приходят исключением — без перехвата оно
// уходит в error boundary и роняет экран. settle превращает его в обычный ответ «нет связи».

export async function settle<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}
