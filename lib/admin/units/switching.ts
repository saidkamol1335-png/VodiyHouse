// Переход на другой блок идёт: SwitchPending ставит вкладке data-switching, а уходящему блоку —
// inert. Правка, начатая в нём, и ответ, пришедший в него, пропали бы вместе с блоком: Ctrl+Z
// молчит, а отказ, пришедший в это время, уходит в полосу вкладки — как у закрытой формы.

export const SWITCHING_ATTRIBUTE = "data-switching";

export function blockSwitching(): boolean {
  return document.querySelector(`[data-units-tab][${SWITCHING_ATTRIBUTE}]`) !== null;
}
