-- Подсказки «?» калькулятора (шаг 2.8, ТЗ 4.4): набор задаёт код (lib/calc/hints.ts), тексты —
-- справочник hints, правит руководитель в «Справочниках». Здесь — черновики Vodiy House
-- (TODO-заказчик: утвердить формулировки); уже заведённые тексты не трогаем.

-- Начальные данные миграции в журнал не пишутся (как у справочников фазы 1, tests/db/audit.test.ts).
alter table public.hints disable trigger hints_audit;

insert into public.hints (slug, term, text) values
  ('down-payment',
   jsonb_build_object('ru', 'Первоначальный взнос', 'uz', 'Boshlang‘ich to‘lov'),
   jsonb_build_object('ru', 'Сумма, которую вы платите сразу при покупке. Чем больше взнос, тем меньше остаток и платёж в месяц.', 'uz', 'Xarid paytida darhol to‘lanadigan summa. To‘lov qancha katta bo‘lsa, qoldiq va oylik to‘lov shuncha kam.')),
  ('installment',
   jsonb_build_object('ru', 'Рассрочка от застройщика', 'uz', 'Quruvchidan muddatli to‘lov'),
   jsonb_build_object('ru', 'Вы платите за квартиру частями прямо застройщику, без банка и без процентов.', 'uz', 'Kvartira uchun to‘g‘ridan-to‘g‘ri quruvchiga, bankisiz va foizsiz, bo‘lib to‘laysiz.')),
  ('installment-markup',
   jsonb_build_object('ru', 'Рассрочка с наценкой', 'uz', 'Ustama bilan muddatli to‘lov'),
   jsonb_build_object('ru', 'Вы платите застройщику частями, без банка; за срок к цене добавляется наценка.', 'uz', 'Quruvchiga bankisiz bo‘lib to‘laysiz; muddat uchun narxga ustama qo‘shiladi.')),
  ('bank-installment',
   jsonb_build_object('ru', 'Рассрочка через банк', 'uz', 'Bank orqali muddatli to‘lov'),
   jsonb_build_object('ru', 'Банк оплачивает остаток застройщику, а вы возвращаете его банку частями с процентами за 1–2 года.', 'uz', 'Qoldiqni bank quruvchiga to‘laydi, siz uni bankka foizi bilan 1–2 yilda bo‘lib qaytarasiz.')),
  ('mortgage',
   jsonb_build_object('ru', 'Ипотека', 'uz', 'Ipoteka'),
   jsonb_build_object('ru', 'Кредит банка на жильё на много лет под залог квартиры. Платёж в месяц меньше, но проценты за весь срок больше.', 'uz', 'Kvartira garovi ostida ko‘p yilga beriladigan bank krediti. Oylik to‘lov kamroq, lekin butun muddat foizlari ko‘proq.')),
  ('markup',
   jsonb_build_object('ru', 'Наценка', 'uz', 'Ustama'),
   jsonb_build_object('ru', 'Надбавка к цене за оплату частями. Её делят на месяцы вместе с остатком.', 'uz', 'Bo‘lib to‘lash uchun narxga qo‘shimcha. U qoldiq bilan birga oylarga bo‘linadi.')),
  ('bank-interest',
   jsonb_build_object('ru', 'Проценты банка', 'uz', 'Bank foizlari'),
   jsonb_build_object('ru', 'Плата банку за кредит: процент годовых с оставшегося долга. Здесь — сумма за весь срок.', 'uz', 'Kredit uchun bankka to‘lov: qolgan qarzdan yillik foiz. Bu yerda — butun muddat uchun jami.')),
  ('appraisal',
   jsonb_build_object('ru', 'Оценка квартиры', 'uz', 'Kvartirani baholash'),
   jsonb_build_object('ru', 'Отчёт оценщика о стоимости квартиры — банк требует его до выдачи кредита. Платится один раз.', 'uz', 'Kvartira qiymati bo‘yicha baholovchi hisoboti — bank kreditdan oldin talab qiladi. Bir marta to‘lanadi.')),
  ('commission',
   jsonb_build_object('ru', 'Комиссия банка', 'uz', 'Bank komissiyasi'),
   jsonb_build_object('ru', 'Разовая плата банку за выдачу кредита — процент от суммы кредита.', 'uz', 'Kredit berganlik uchun bankka bir martalik to‘lov — kredit summasidan foiz.')),
  ('insurance',
   jsonb_build_object('ru', 'Страхование', 'uz', 'Sug‘urta'),
   jsonb_build_object('ru', 'Страховка квартиры или жизни, которую банк требует на время кредита.', 'uz', 'Kredit muddatida bank talab qiladigan kvartira yoki hayot sug‘urtasi.')),
  ('overpayment',
   jsonb_build_object('ru', 'Переплата', 'uz', 'Ortiqcha to‘lov'),
   jsonb_build_object('ru', 'Сколько вы заплатите сверх цены квартиры: проценты, наценка и разовые платежи банка.', 'uz', 'Kvartira narxidan ortiq to‘laydiganingiz: foizlar, ustama va bankning bir martalik to‘lovlari.'))
on conflict (slug) do nothing;

alter table public.hints enable trigger hints_audit;
