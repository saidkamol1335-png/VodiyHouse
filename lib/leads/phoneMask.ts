// Маска телефона формы (ТЗ 10.2): «+998 XX XXX XX XX» по мере набора. Код страны дописываем сами,
// вставленный номер в любой записи («901234567», «+998 (90) 123-45-67») приводим к ней же.

const COUNTRY = "998";

export function maskPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith(COUNTRY)) digits = digits.slice(COUNTRY.length);
  digits = digits.slice(0, 9);
  if (digits.length === 0) return raw.trim() === "" ? "" : "+998 ";
  const groups = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return `+998 ${groups.filter(Boolean).join(" ")}`;
}
