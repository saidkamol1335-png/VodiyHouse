"use client";

import { useEffect, useState } from "react";

// «Форма ещё на экране?» для ответа, пришедшего после её закрытия: тогда отказ покажет не она, а
// общая полоса (useUnitsEdit). Объект в useState — читается из обработчиков, не из рендера.

class Presence {
  private on = true;

  enter() {
    this.on = true;
  }

  leave() {
    this.on = false;
  }

  here = () => this.on;
}

export function usePresence(): () => boolean {
  const [presence] = useState(() => new Presence());
  useEffect(() => {
    presence.enter();
    return () => presence.leave();
  }, [presence]);
  return presence.here;
}
