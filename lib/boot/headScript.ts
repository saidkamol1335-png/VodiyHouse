// Скрипт в <head>, до первой отрисовки: тема и режим анимации из localStorage / ?motion.
// Без него тёмная тема мигала бы светлой, а сохранённый full — стартовым lite.
// Сервер всегда рендерит data-theme="light" data-motion="lite". data-js — скрипты работают: только
// тогда CSS прячет то, что потом проявит useReveal (без JS всё видно сразу). Ссылка на каталог с
// фильтром — выдача ждёт его (lib/site/catalog/pending.ts); отдельным try: хранилище и matchMedia
// бывают недоступны, а это от них не зависит.

import { MOTION_QUERY_PARAM, MOTION_STORAGE_KEY } from "@/lib/motion/tier";
import { ANCHOR_START_ATTRIBUTE } from "./anchorStart";
import {
  CATALOG_FILTER_PARAMS,
  CATALOG_PENDING_ATTRIBUTE,
  CATALOG_PENDING_TIMEOUT_MS,
} from "@/lib/site/catalog/pending";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme";

const PENDING = JSON.stringify(CATALOG_PENDING_ATTRIBUTE);

export const HEAD_BOOT_SCRIPT = `(function(){var d=document.documentElement;d.setAttribute("data-js","");if(location.hash.length>1)d.setAttribute("${ANCHOR_START_ATTRIBUTE}","");try{
var p=new URLSearchParams(location.search);if(/\\/novostroyki\\/?$/.test(location.pathname)&&${JSON.stringify(CATALOG_FILTER_PARAMS)}.some(function(k){return p.has(k)})){d.setAttribute(${PENDING},"");setTimeout(function(){d.removeAttribute(${PENDING})},${CATALOG_PENDING_TIMEOUT_MS});}}catch(e){}try{
var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="dark"||t==="light")d.setAttribute("data-theme",t);
var q=new URLSearchParams(location.search).get(${JSON.stringify(MOTION_QUERY_PARAM)});
var m=(q==="full"||q==="lite"||q==="none")?q:localStorage.getItem(${JSON.stringify(MOTION_STORAGE_KEY)});
if(matchMedia("(prefers-reduced-motion: reduce)").matches)m="none";
if(m==="full"||m==="lite"||m==="none")d.setAttribute("data-motion",m);}catch(e){}})();`;
