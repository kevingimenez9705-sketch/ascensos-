// util.js
// Utilidades chicas compartidas por exams.js y app.js.

// Convierte un nombre de local en un slug estable para usar en la URL
// (hash) y como parte de la clave de almacenamiento de exámenes.
function slugify(str) {
  return String(str)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

// Set chico de iconos en línea (stroke=currentColor, sin librerías ni
// pedidos externos) para reemplazar los emoji por algo más consistente
// entre sistemas operativos/navegadores.
const ICONS = {
  cap: '<path d="M12 3 1 8l11 5 9-4.09V17h2V8L12 3Z"/><path d="M5 10.18v4.59c0 .35.16.68.44.89C6.6 16.5 8.98 18 12 18s5.4-1.5 6.56-2.34c.28-.21.44-.54.44-.89v-4.59l-7 3.18-7-3.18Z"/>',
  phone: '<path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .8-.2 1L6.6 10.8Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 6.5L20.5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  chevronRight: '<path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  arrowLeft: '<path d="M19 12H5m0 0 6-6m-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  arrowRight: '<path d="M5 12h14m0 0-6-6m6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  trash: '<path d="M4 7h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  warning: '<path d="M12 3 1.5 21h21L12 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  building: '<path d="M4 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16M12 21v-9a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7 8h1M7 11h1M7 14h1M15 13h1M15 16h1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
};

function icon(name, opts) {
  opts = opts || {};
  const size = opts.size || 16;
  const cls = opts.class ? ` ${opts.class}` : "";
  const body = ICONS[name] || "";
  return `<svg class="icon${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${body}</svg>`;
}
