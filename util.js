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
