// exams.js
// Persistencia de los exámenes de ascenso cargados por local.
//
// Backend: una Google Sheet, vía el Web App de Google Apps Script
// (ver google-apps-script/Code.gs). Es la única fuente de verdad
// compartida: todos los que entran a la app, desde cualquier
// navegador/dispositivo, ven los mismos exámenes.
//
// Como respaldo, cada navegador guarda una copia local de la última
// lectura exitosa (localStorage). Si en algún momento no se puede
// contactar a la planilla (sin internet, script caído, etc.) se muestra
// esa copia en vez de dejar la pantalla vacía, y se avisa en pantalla
// que los datos pueden estar desactualizados.
//
// La clave de cada examen depende solo de marca + nombre del local (no
// de en qué zonal/regional está colgado ese local en el organigrama).
// Así, si después se mueve el local a otra zonal (ver overrides.js), los
// exámenes ya cargados lo siguen sin perderse.

const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwWQud8u_W8V3jH3WmpGOrjMwddUEME2KCnoHQytaXvUV1vlghOjAyjcfaCv5VBUtPg/exec";

// Resultados del examen online (Examenes-Emi), guardados en Supabase.
// Se muestran junto a los cargados a mano en la planilla; son de solo
// lectura (no se pueden eliminar desde acá). null = no se consultan.
const SUPABASE_URL = null;       // p.ej. "https://xxxx.supabase.co"
const SUPABASE_ANON_KEY = null;

const NIVELES_ONLINE = { entrenador: "Entrenador", encargado: "Encargado", gerente: "Gerente" };
const MOTIVOS_ONLINE = {
  tiempo: "tiempo agotado",
  abandono: "cerró la página",
  salida: "cerrado por salir de la ventana",
};

const ExamStore = (function () {
  const LOCAL_BACKUP_KEY = "campusAscensos.examenes.v1";

  let exams = [];
  let loaded = false;
  let lastError = null;
  let loadPromise = null;

  function localKey(brandId, localName) {
    return `${brandId}/${slugify(localName)}`;
  }

  function withLocalKey(record) {
    return Object.assign({}, record, { localKey: localKey(record.brandId, record.localName) });
  }

  function loadBackup() {
    try {
      const raw = localStorage.getItem(LOCAL_BACKUP_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveBackup(list) {
    try {
      localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(list));
    } catch (e) {
      // sin espacio/no disponible: no es grave, es solo el respaldo offline
    }
  }

  // POST con Content-Type text/plain a propósito: evita el preflight CORS
  // que Apps Script no responde. El body sigue siendo JSON; Code.gs lo
  // parsea igual.
  async function post(action, extra) {
    const res = await fetch(SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ action }, extra)),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "la planilla devolvió un error");
    return data;
  }

  async function fetchSheet() {
    const res = await fetch(SHEET_API_URL, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "la planilla devolvió un error");
    return data.exams.map(withLocalKey);
  }

  function fechaLocal(iso) {
    return new Date(iso).toLocaleDateString("en-CA"); // AAAA-MM-DD en hora local
  }

  // Convierte un resultado del examen online al mismo formato que los de la planilla.
  function onlineToRecord(r) {
    const motivo = MOTIVOS_ONLINE[String(r.motivo_cierre || "").split(":")[0]];
    return withLocalKey({
      id: `online-${r.id}`,
      origen: "online",
      brandId: r.marca,
      localName: r.local || "",
      nombre: r.nombre || "",
      apellido: r.apellido || "",
      puestoActual: "",
      puestoPostula: NIVELES_ONLINE[r.nivel] || r.nivel,
      fecha: fechaLocal(r.creado),
      asistio: true,
      puntaje: typeof r.porcentaje === "number" ? r.porcentaje : null,
      resultado: r.condicion === "Aprobado" ? "aprobado" : "desaprobado",
      observaciones: "Examen online" + (motivo ? ` (${motivo})` : ""),
      createdAt: r.creado,
    });
  }

  async function fetchOnline() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/examenes_campus`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: "{}",
    });
    if (!res.ok) throw new Error(`Supabase HTTP ${res.status}`);
    return (await res.json()).map(onlineToRecord);
  }

  // Trae planilla + examen online en paralelo. Si falla una sola fuente se
  // muestra lo de la otra y se marca el error (la pill ofrece reintentar).
  async function fetchAll() {
    const [sheet, online] = await Promise.allSettled([fetchSheet(), fetchOnline()]);
    if (sheet.status === "rejected" && online.status === "rejected") throw sheet.reason;
    const partialError = sheet.status === "rejected" ? sheet.reason : online.status === "rejected" ? online.reason : null;
    return {
      sheet: sheet.status === "fulfilled" ? sheet.value : null,
      online: online.status === "fulfilled" ? online.value : [],
      partialError,
    };
  }

  // Sube a la planilla los exámenes que hayan quedado guardados en este
  // navegador ANTES de conectar la planilla (o cargados mientras no había
  // conexión) y que todavía no estén ahí. Se fija por id, así que es
  // seguro llamarla en cada carga: si ya está todo subido, no hace nada.
  async function migratePending(remoteExams) {
    const local = loadBackup().filter((e) => e.origen !== "online");
    if (!local.length) return;
    const remoteIds = new Set(remoteExams.map((e) => e.id));
    const missing = local.filter((e) => e.id && !remoteIds.has(e.id));
    for (const record of missing) {
      try {
        await post("add", { record });
        remoteExams.push(withLocalKey(record));
      } catch (e) {
        // si falla uno, seguimos con los demás; se reintenta en la próxima carga
      }
    }
  }

  // Trae los exámenes de la planilla (una sola vez; llamados repetidos
  // devuelven la misma promesa ya en curso/resuelta). Hay que esperarla
  // antes de la primera renderización de la app.
  function ensureLoaded() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      try {
        const { sheet, online, partialError } = await fetchAll();
        // Si la planilla no respondió, se usan los de la copia local para no perderlos de vista.
        const manual = sheet || loadBackup().filter((e) => e.origen !== "online");
        if (sheet) await migratePending(sheet);
        exams = manual.concat(online);
        loaded = true;
        lastError = partialError;
        saveBackup(exams);
      } catch (err) {
        lastError = err;
        exams = loadBackup();
        loaded = true;
      }
    })();
    return loadPromise;
  }

  // Para reintentar manualmente si la primera carga falló.
  function retry() {
    loadPromise = null;
    return ensureLoaded();
  }

  function isLoaded() {
    return loaded;
  }
  function getError() {
    return lastError;
  }

  function forLocal(brandId, localName) {
    const key = localKey(brandId, localName);
    return exams
      .filter((e) => e.localKey === key)
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function forBrand(brandId) {
    return exams.filter((e) => e.brandId === brandId);
  }

  function countForLocal(brandId, localName) {
    return forLocal(brandId, localName).length;
  }

  // Estadísticas de una lista de exámenes: cantidad, aprobados, promedio
  // de puntaje, % de asistencia y % de aprobados. El % de aprobados se
  // calcula sobre quienes asistieron (a alguien que faltó no se lo puede
  // calificar), no sobre el total cargado.
  function computeStats(list) {
    const total = list.length;
    const asistieron = list.filter((e) => e.asistio);
    const aprobados = list.filter((e) => e.resultado === "aprobado").length;
    const puntajes = list.filter((e) => typeof e.puntaje === "number").map((e) => e.puntaje);
    const avgScore = puntajes.length ? puntajes.reduce((a, b) => a + b, 0) / puntajes.length : null;

    return {
      exams: total,
      approved: aprobados,
      avgScore: avgScore === null ? null : Math.round(avgScore * 10) / 10,
      attendancePct: total ? Math.round((asistieron.length / total) * 100) : null,
      approvalPct: asistieron.length ? Math.round((aprobados / asistieron.length) * 100) : null,
    };
  }

  function statsForBrand(brandId) {
    return computeStats(forBrand(brandId));
  }

  function statsForLocalNames(brandId, localNames) {
    const list = localNames.reduce((acc, name) => acc.concat(forLocal(brandId, name)), []);
    return computeStats(list);
  }

  function recent(limit) {
    return exams
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, limit || 8);
  }

  async function add(record) {
    const entry = Object.assign({}, record, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    });
    await post("add", { record: entry });
    exams.push(withLocalKey(entry));
    saveBackup(exams);
    return entry;
  }

  async function remove(id) {
    if (String(id).startsWith("online-")) throw new Error("los resultados del examen online no se eliminan desde el Campus");
    await post("remove", { id });
    exams = exams.filter((e) => e.id !== id);
    saveBackup(exams);
  }

  return {
    ensureLoaded,
    retry,
    isLoaded,
    getError,
    forLocal,
    forBrand,
    add,
    remove,
    countForLocal,
    computeStats,
    statsForBrand,
    statsForLocalNames,
    recent,
    localKey,
  };
})();
