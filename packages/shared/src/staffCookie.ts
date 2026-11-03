// Браузер сотрудника (фаза F, п. 40): кабинет при входе ставит метку на общий домен .vodiyhouse.uz,
// сайт по ней не пишет события статистики и не грузит рекламные пиксели. Метка не секрет и не вход —
// только «этот браузер — сотрудника»; на тестовых *.netlify.app общего домена нет, там сотрудники
// считаются (п. 18).

export const STAFF_COOKIE = "vh-staff";
export const STAFF_COOKIE_VALUE = "1";

const MARK = new RegExp(`(?:^|;\\s*)${STAFF_COOKIE}=${STAFF_COOKIE_VALUE}(?:;|$)`);

/** Есть ли метка сотрудника в строке cookie (document.cookie или заголовок Cookie). */
export const hasStaffCookie = (cookieHeader: string) => MARK.test(cookieHeader);
