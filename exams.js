// exams.js
// Persistencia de los exámenes de ascenso cargados por local.
//
// Todo queda en localStorage del navegador: no hay backend ni conexión a
// ningún servicio. Los datos son propios de cada navegador/dispositivo
// donde se cargan.

const ExamStore = (function () {
  const STORAGE_KEY = "campusAscensos.examenes.v1";

  function safeParseArray(json) {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? safeParseArray(raw) : [];
    } catch (e) {
      // localStorage no disponible (modo privado, navegador viejo, etc.)
      return [];
    }
  }

  function persist(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      // Si falla el guardado (cuota llena, etc.) los datos quedan solo en
      // memoria durante esta sesión de la página.
    }
  }

  let exams = load();

  function localKey(brandId, regionalId, zonalId, localName) {
    return [brandId, regionalId, zonalId, slugify(localName)].join("/");
  }

  function forLocal(brandId, regionalId, zonalId, localName) {
    const key = localKey(brandId, regionalId, zonalId, localName);
    return exams
      .filter((e) => e.localKey === key)
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || b.createdAt.localeCompare(a.createdAt));
  }

  function forBrand(brandId) {
    return exams.filter((e) => e.brandId === brandId);
  }

  function add(record) {
    const entry = Object.assign({}, record, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      localKey: localKey(record.brandId, record.regionalId, record.zonalId, record.localName),
      createdAt: new Date().toISOString(),
    });
    exams.push(entry);
    persist(exams);
    return entry;
  }

  function remove(id) {
    exams = exams.filter((e) => e.id !== id);
    persist(exams);
  }

  function countForLocal(brandId, regionalId, zonalId, localName) {
    return forLocal(brandId, regionalId, zonalId, localName).length;
  }

  // Estadísticas agregadas de una marca, para las cards de la home.
  function statsForBrand(brandId) {
    const list = forBrand(brandId);
    const total = list.length;
    const asistieron = list.filter((e) => e.asistio).length;
    const aprobados = list.filter((e) => e.resultado === "aprobado").length;
    return {
      exams: total,
      approved: aprobados,
      attendance: total ? `${Math.round((asistieron / total) * 100)}%` : null,
    };
  }

  return { forLocal, forBrand, add, remove, countForLocal, statsForBrand, localKey };
})();
