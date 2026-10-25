// Скрипт в <head>, до первой отрисовки: тема и режим анимации из localStorage / ?motion.
// Без него тёмная тема мигала бы светлой, а сохранённый full — стартовым lite.
// Сервер всегда рендерит data-theme="light" data-motion="lite". data-js — скрипты работают: только
// тогда CSS прячет то, что потом проявит useReveal (без JS всё видно сразу).

import { MOTION_QUERY_PARAM, MOTION_STORAGE_KEY } from "@/lib/motion/tier";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme";

export const HEAD_BOOT_SCRIPT = `(function(){var d=document.documentElement;d.setAttribute("data-js","");try{
var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="dark"||t==="light")d.setAttribute("data-theme",t);
var q=new URLSearchParams(location.search).get(${JSON.stringify(MOTION_QUERY_PARAM)});
var m=(q==="full"||q==="lite")?q:localStorage.getItem(${JSON.stringify(MOTION_STORAGE_KEY)});
if(matchMedia("(prefers-reduced-motion: reduce)").matches)m="none";
if(m==="full"||m==="lite"||m==="none")d.setAttribute("data-motion",m);}catch(e){}})();`;
