"use client";

import { type MouseEvent, type PointerEvent, useRef } from "react";

// Закрытие модального <dialog> нажатием по фону (окно заявки, «Поделиться»): target === dialog
// бывает и у его отступов и промежутков сетки, и у выделения текста, отпущенного над фоном, — поэтому
// закрываем, только если и нажатие, и отпускание пришлись за край окна.

/** Точка за краем окна: target === dialog бывает и у его отступов. */
function outsideBox(event: PointerEvent<HTMLDialogElement> | MouseEvent<HTMLDialogElement>): boolean {
  const dialog = event.currentTarget;
  if (event.target !== dialog) return false;
  const box = dialog.getBoundingClientRect();
  return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
}

/**
 * Нажатие по фону — закрыть, как .mdl-wrap мокапа: и нажатие, и отпускание — за краем окна.
 * Выделение текста в поле, отпущенное над фоном, окно не закрывает и введённое не теряет.
 */
export function useBackdropClose() {
  const pressedOutside = useRef(false);
  return {
    onPointerDown: (event: PointerEvent<HTMLDialogElement>) => {
      pressedOutside.current = outsideBox(event);
    },
    onClick: (event: MouseEvent<HTMLDialogElement>) => {
      if (pressedOutside.current && outsideBox(event)) event.currentTarget.close();
      pressedOutside.current = false;
    },
  };
}

