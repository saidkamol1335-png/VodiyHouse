// Скрипт в <head>, до первой отрисовки: режим анимации из localStorage / ?motion.
// Без него сохранённый full мигал бы стартовым lite.
// Сервер всегда рендерит data-motion="lite". data-js — скрипты работают: только
// тогда CSS прячет то, что потом проявит useReveal (без JS всё видно сразу). Ссылка на каталог с
// фильтром — выдача ждёт его (lib/site/catalog/pending.ts); отдельным try: хранилище и matchMedia
// бывают недоступны, а это от них не зависит.

import { MOTION_QUERY_PARAM, MOTION_STORAGE_KEY } from "@/lib/motion/tier";
import { LOCALES } from "@/lib/i18n/routing";
import { ANCHOR_START_ATTRIBUTE, REVEAL_FAILSAFE_MS, REVEAL_OFF_ATTRIBUTE, SCROLL_MEMORY_KEY } from "./anchorStart";
import { HYDRATED_ATTRIBUTE } from "./hydrated";
import { PRELOADER_ATTRIBUTE, PRELOADER_FAILSAFE_MS, PRELOADER_SEEN_KEY } from "./preloader";
import { POSTER_ONLY_QUERY } from "@/lib/site/timelapse/assets";
import {
  CATALOG_FILTER_PARAMS,
  CATALOG_PENDING_ATTRIBUTE,
  CATALOG_PENDING_TIMEOUT_MS,
} from "@/lib/site/catalog/pending";

const PENDING = JSON.stringify(CATALOG_PENDING_ATTRIBUTE);

export const HEAD_BOOT_SCRIPT = `(function(){var d=document.documentElement;d.setAttribute("data-js","");setTimeout(function(){if(!d.hasAttribute("${HYDRATED_ATTRIBUTE}"))d.setAttribute("${REVEAL_OFF_ATTRIBUTE}","")},${REVEAL_FAILSAFE_MS});if(location.hash.length>1){d.setAttribute("${ANCHOR_START_ATTRIBUTE}","");d.setAttribute("${REVEAL_OFF_ATTRIBUTE}","")}try{
var n=performance.getEntriesByType("navigation")[0];if(n&&(n.type==="reload"||n.type==="back_forward")&&Number(sessionStorage.getItem(${JSON.stringify(SCROLL_MEMORY_KEY)}+location.pathname))>0){d.setAttribute("${ANCHOR_START_ATTRIBUTE}","");d.setAttribute("${REVEAL_OFF_ATTRIBUTE}","")}}catch(e){}try{
var p=new URLSearchParams(location.search);if(/\\/novostroyki\\/?$/.test(location.pathname)&&${JSON.stringify(CATALOG_FILTER_PARAMS)}.some(function(k){return p.has(k)})){d.setAttribute(${PENDING},"");setTimeout(function(){d.removeAttribute(${PENDING})},${CATALOG_PENDING_TIMEOUT_MS});}}catch(e){}try{
var q=new URLSearchParams(location.search).get(${JSON.stringify(MOTION_QUERY_PARAM)});
var m=(q==="full"||q==="lite"||q==="none")?q:localStorage.getItem(${JSON.stringify(MOTION_STORAGE_KEY)});
if(m==="full"||m==="lite"||m==="none")d.setAttribute("data-motion",m);
var s=sessionStorage.getItem(${JSON.stringify(PRELOADER_SEEN_KEY)});sessionStorage.setItem(${JSON.stringify(PRELOADER_SEEN_KEY)},"1");
if(!s&&/^\\/(${LOCALES.join("|")})\\/?$/.test(location.pathname)&&!d.hasAttribute("${ANCHOR_START_ATTRIBUTE}")&&m!=="none"&&!matchMedia(${JSON.stringify(POSTER_ONLY_QUERY)}).matches&&!(navigator.connection&&navigator.connection.saveData)){d.setAttribute("${PRELOADER_ATTRIBUTE}","");setTimeout(function(){d.removeAttribute("${PRELOADER_ATTRIBUTE}")},${PRELOADER_FAILSAFE_MS});}}catch(e){}})();`;
