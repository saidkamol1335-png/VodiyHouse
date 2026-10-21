import { startTransition, type FormEvent } from "react";

/**
 * Отправка формы без автосброса React 19. Функция в `<form action>` после ответа делает
 * form.reset(): неуправляемые радио и списки возвращаются к значениям на момент монтирования, а
 * управляемые на экране расходятся с состоянием — следующее «Сохранить» отправило бы не то, что
 * видно. Через onSubmit сброса нет; pending из useActionState работает как прежде.
 */
export function submitKeepingForm(action: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => action(data));
  };
}
