"use strict";
/* Word on the Street -- pre-paint boot. Runs render-blocking in <head> on every page so the theme
   (light/dark) and language (en/ar plus text direction) are set on <html> BEFORE first paint, with
   no flash. Kept as an external file rather than inline so each page's Content-Security-Policy can
   forbid inline scripts outright (script-src 'self'); there is nothing to hash or keep in sync. */
(function () {
  try {
    var d = document.documentElement;
    if (localStorage.getItem('theme') === 'dark') d.setAttribute('data-theme', 'dark');
    var p = new URLSearchParams(location.search).get('lang');
    var l = (p === 'ar' || p === 'en') ? p : (localStorage.getItem('lang') === 'ar' ? 'ar' : 'en');
    if (p === 'ar' || p === 'en') { try { localStorage.setItem('lang', l); } catch (e) {} }
    d.lang = l;
    d.dir = l === 'ar' ? 'rtl' : 'ltr';
  } catch (e) {}
})();
