// Скрипт в <head>, до первой отрисовки: тема и режим анимации из localStorage / ?motion.
// Без него тёмная тема мигала бы светлой, а сохранённый full — стартовым lite.
// Сервер всегда рендерит data-theme="light" data-motion="lite". data-js — скрипты работают: только
// тогда CSS прячет то, что потом проявит useReveal (без JS всё видно сразу). Ссылка на каталог с
// фильтром — выдача ждёт его (lib/site/catalog/pending.ts); отдельным try: хранилище и matchMedia
// бывают недоступны, а это от них не зависит.

import { MOTION_QUERY_PARAM, MOTION_STORAGE_KEY } from "@/lib/motion/tier";
import { LOCALES } from "@/lib/i18n/routing";
import { ANCHOR_START_ATTRIBUTE, SCROLL_MEMORY_KEY } from "./anchorStart";
import { PRELOADER_ATTRIBUTE, PRELOADER_FAILSAFE_MS, PRELOADER_SEEN_KEY } from "./preloader";
import {
  CATALOG_FILTER_PARAMS,
  CATALOG_PENDING_ATTRIBUTE,
  CATALOG_PENDING_TIMEOUT_MS,
} from "@/lib/site/catalog/pending";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme";

const PENDING = JSON.stringify(CATALOG_PENDING_ATTRIBUTE);

export const HEAD_BOOT_SCRIPT = `(function(){var d=document.documentElement;d.setAttribute("data-js","");if(location.hash.length>1)d.setAttribute("${ANCHOR_START_ATTRIBUTE}","");try{
var n=performance.getEntriesByType("navigation")[0];if(n&&(n.type==="reload"||n.type==="back_forward")&&Number(sessionStorage.getItem(${JSON.stringify(SCROLL_MEMORY_KEY)}+location.pathname))>0)d.setAttribute("${ANCHOR_START_ATTRIBUTE}","");}catch(e){}try{
var p=new URLSearchParams(location.search);if(/\\/novostroyki\\/?$/.test(location.pathname)&&${JSON.stringify(CATALOG_FILTER_PARAMS)}.some(function(k){return p.has(k)})){d.setAttribute(${PENDING},"");setTimeout(function(){d.removeAttribute(${PENDING})},${CATALOG_PENDING_TIMEOUT_MS});}}catch(e){}try{
var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="dark"||t==="light")d.setAttribute("data-theme",t);
var q=new URLSearchParams(location.search).get(${JSON.stringify(MOTION_QUERY_PARAM)});
var m=(q==="full"||q==="lite"||q==="none")?q:localStorage.getItem(${JSON.stringify(MOTION_STORAGE_KEY)});
if(matchMedia("(prefers-reduced-motion: reduce)").matches)m="none";
if(m==="full"||m==="lite"||m==="none")d.setAttribute("data-motion",m);
var s=sessionStorage.getItem(${JSON.stringify(PRELOADER_SEEN_KEY)});sessionStorage.setItem(${JSON.stringify(PRELOADER_SEEN_KEY)},"1");
if(!s&&/^\\/(${LOCALES.join("|")})\\/?$/.test(location.pathname)&&!d.hasAttribute("${ANCHOR_START_ATTRIBUTE}")&&m!=="none"&&!(navigator.connection&&navigator.connection.saveData)){d.setAttribute("${PRELOADER_ATTRIBUTE}","");setTimeout(function(){d.removeAttribute("${PRELOADER_ATTRIBUTE}")},${PRELOADER_FAILSAFE_MS});}}catch(e){}})();`;
