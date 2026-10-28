# Google Таблица «Заявки» — приёмник Apps Script

Шаг 3.7 (ТЗ 10.4, решение фазы 3 «Доставка заявок»): сайт отправляет каждую заявку строкой в таблицу
заказчика через веб-приложение Apps Script внутри самой таблицы — без Google Cloud и сервисных
аккаунтов. Пока таблицы нет — канал выключен, заявки сохраняются в кабинете (TODO-исполнитель:
тестовая таблица; на «Запуске» — таблица заказчика).

## Как подключить (≈5 минут)

1. Создать таблицу «Заявки Vodiy House» (первый лист можно назвать «Заявки»).
2. Расширения → Apps Script → удалить всё в `Code.gs` и вставить код ниже.
3. Слева «Параметры проекта» (шестерёнка) → «Свойства скрипта» → добавить свойство
   `SECRET` со значением — придумать строку от 24 знаков (буквы и цифры). Или без ручного ввода:
   дописать в `Code.gs` функцию ниже, выбрать `setup` → «Выполнить» (Google попросит доступ) и
   взять секрет из журнала выполнения — так подключена тестовая таблица 28.10.2026.

   ```js
   function setup() {
     const secret = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
     PropertiesService.getScriptProperties().setProperty("SECRET", secret);
     Logger.log(secret);
   }
   ```
4. «Развернуть» → «Новое развёртывание» → тип «Веб-приложение»: «Выполнять от имени» — **я**,
   «У кого есть доступ» — **все** → «Развернуть» → разрешить доступ → скопировать адрес
   веб-приложения (`https://script.google.com/macros/s/…/exec`).
5. В `.env.local` (и в настройках сайта Netlify): `LEADS_SHEET_URL=<адрес>`,
   `LEADS_SHEET_SECRET=<тот же SECRET>`. Перезапустить сайт.
6. Отправить тестовую заявку с сайта → в таблице появилась строка, в кабинете у заявки
   «Таблица» зелёная.

Секрет защищает таблицу от чужих строк: адрес веб-приложения открыт, но без секрета приёмник
отвечает отказом. Сменить секрет — новое значение в свойствах скрипта и в `.env`.

## Код приёмника (`Code.gs`)

```js
// Приёмник заявок vodiyhouse.uz: проверяет секрет и добавляет строку. Столбцы — поля ТЗ 10.3.
const COLUMNS = [
  ["number", "№"], ["created_at", "Дата и время (Ташкент)"], ["type", "Тип"], ["name", "Имя"],
  ["phone", "Телефон"], ["contact_lang", "Язык общения"], ["site_lang", "Язык сайта"],
  ["subject", "ЖК / блок / планировка"], ["developer", "Застройщик"], ["details", "Подробности"], ["page", "Страница"],
  ["utm_source", "utm_source"], ["utm_medium", "utm_medium"], ["utm_campaign", "utm_campaign"],
  ["utm_content", "utm_content"], ["utm_term", "utm_term"], ["fbclid", "fbclid"], ["gclid", "gclid"],
  ["referrer", "Откуда пришли"], ["repeat_of", "Повтор заявки №"], ["cabinet", "В кабинете"],
];

function doPost(e) {
  const reply = (body) => ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (error) {
    return reply({ ok: false, error: "bad json" });
  }
  const secret = PropertiesService.getScriptProperties().getProperty("SECRET");
  if (!secret || data.secret !== secret) return reply({ ok: false, error: "forbidden" });
  // Ждём меньше, чем сайт ждёт ответа (8 с): не дождались — сайт повторит позже.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return reply({ ok: false, error: "busy" });
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    // Шапка: недостающие столбцы (новые поля сайта) дописываются справа со своей подписью — шапку
    // руками не править; значения пишутся по подписи столбца, а не по месту.
    const header = sheet.getLastRow() === 0 ? [] : sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const missing = COLUMNS.filter(([, title]) => !header.includes(title)).map(([, title]) => title);
    if (missing.length > 0) {
      sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing]);
      header.push(...missing);
    }
    // Повтор той же заявки (ответ не дошёл до сайта) — строка уже есть, второй не будет.
    const numberColumn = header.indexOf(COLUMNS[0][1]) + 1;
    const numbers = sheet.getLastRow() > 1 ? sheet.getRange(2, numberColumn, sheet.getLastRow() - 1, 1).getValues().flat() : [];
    if (numbers.some((value) => String(value) === String(data.row.number))) return reply({ ok: true });
    // Ячейка, начатая «=», «+», «-», «@», — формула: заявка с сайта ею не станет.
    const safe = (value) => (typeof value === "string" && /^[=+\-@]/.test(value) ? "'" + value : value);
    const keyOf = Object.fromEntries(COLUMNS.map(([key, title]) => [title, key]));
    sheet.appendRow(header.map((title) => (keyOf[title] ? safe(data.row[keyOf[title]] ?? "") : "")));
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}
```

Новое поле сайта — строка в `COLUMNS` (ключ из `sheetRow` в `lib/leads/message.ts` и подпись):
после замены кода приёмник сам допишет столбец в шапку справа. Свои столбцы в таблице (заметки
менеджера) не мешают — значения пишутся по подписи столбца. Юнит в `lib/leads/message.test.ts`
сверяет ключи `sheetRow` со столбцами этого кода. Код, вставленный до 29.10.2026, писал по месту
столбца: заменить его этим (тестовая таблица — тоже).

Номер телефона в таблице — с апострофом (`'+998…`): иначе Google Таблицы считают «+998…» формулой.
