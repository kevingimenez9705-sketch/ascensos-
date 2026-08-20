// overrides.js
// Movimientos de zonales/locales guardados por el usuario (mover una
// zonal a otro regional, o un local a otra zonal), aplicados por encima
// de la estructura fija de data.js.
//
// Todo vive en localStorage del navegador: no hay backend. Un movimiento
// hecho acá solo se ve en este navegador/dispositivo — no se comparte
// con otros. Para que un cambio quede permanente para todos hay que
// editar data.js (pedirlo por chat es la vía rápida).

const OrgOverrides = (function () {
  const STORAGE_KEY = "campusAscensos.overrides.v1";

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" ? parsed : { zonalRegional: {}, localZonal: {} };
    } catch (e) {
      return { zonalRegional: {}, localZonal: {} };
    }
  }

  function persist(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // sin persistencia disponible: los cambios quedan solo en memoria
    }
  }

  let state = load();

  function brandZonalMoves(brandId) {
    state.zonalRegional[brandId] = state.zonalRegional[brandId] || {};
    return state.zonalRegional[brandId];
  }
  function brandLocalMoves(brandId) {
    state.localZonal[brandId] = state.localZonal[brandId] || {};
    return state.localZonal[brandId];
  }

  function moveZonal(brandId, zonalId, newRegionalId) {
    brandZonalMoves(brandId)[zonalId] = newRegionalId;
    persist(state);
  }
  function undoZonalMove(brandId, zonalId) {
    delete brandZonalMoves(brandId)[zonalId];
    persist(state);
  }

  function moveLocal(brandId, localSlug, newZonalId) {
    brandLocalMoves(brandId)[localSlug] = newZonalId;
    persist(state);
  }
  function undoLocalMove(brandId, localSlug) {
    delete brandLocalMoves(brandId)[localSlug];
    persist(state);
  }

  function resetBrand(brandId) {
    state.zonalRegional[brandId] = {};
    state.localZonal[brandId] = {};
    persist(state);
  }

  function hasMoves(brandId) {
    return (
      Object.keys(brandZonalMoves(brandId)).length > 0 ||
      Object.keys(brandLocalMoves(brandId)).length > 0
    );
  }

  // Organigrama "efectivo" de una marca: la estructura de data.js con los
  // movimientos guardados ya aplicados. No toca brand.organigrama (eso
  // sigue siendo la fuente original); arma listas nuevas.
  function effectiveOrg(brand) {
    const org = brand.organigrama;
    const zonalMoves = brandZonalMoves(brand.id);
    const localMoves = brandLocalMoves(brand.id);

    // 1) Todas las zonales originales, en una lista plana, cada una con
    //    su regionalId "efectivo" (movido o el original).
    const allZonales = [];
    org.regionales.forEach((r) => {
      r.zonales.forEach((z) => {
        const effectiveRegionalId = zonalMoves[z.id] || r.id;
        // Clon liviano de la zonal, con sus locales ya reordenados según moveLocal.
        const locales = z.locales.filter((local) => {
          const slug = slugify(local);
          const movedTo = localMoves[slug];
          return !movedTo || movedTo === z.id; // se queda acá si no se movió, o si lo movieron A esta zonal (ver abajo)
        });
        allZonales.push({ zonal: z, regionalId: effectiveRegionalId, locales });
      });
    });

    // 2) Agregar a cada zonal los locales que otras zonales "le mandaron".
    org.regionales.forEach((r) => {
      r.zonales.forEach((z) => {
        z.locales.forEach((local) => {
          const slug = slugify(local);
          const movedTo = localMoves[slug];
          if (movedTo && movedTo !== z.id) {
            const target = allZonales.find((az) => az.zonal.id === movedTo);
            if (target) target.locales.push(local);
          }
        });
      });
    });

    // 3) Reagrupar las zonales (ya con sus locales finales) bajo su regional efectivo.
    const regionales = org.regionales.map((r) => ({ ...r, zonales: [] }));
    const regionalById = {};
    regionales.forEach((r) => (regionalById[r.id] = r));

    allZonales.forEach(({ zonal, regionalId, locales }) => {
      const target = regionalById[regionalId];
      if (target) target.zonales.push(Object.assign({}, zonal, { locales }));
    });

    return Object.assign({}, org, { regionales });
  }

  // Lista legible de los movimientos activos de una marca, para mostrar
  // en la pantalla de "mover" con opción de deshacer.
  function listMoves(brand) {
    const org = brand.organigrama;
    const allZonales = [];
    const zonalByLocalSlug = {};
    org.regionales.forEach((r) => {
      r.zonales.forEach((z) => {
        allZonales.push(Object.assign({ originalRegionalId: r.id, originalRegionalName: r.name }, z));
        z.locales.forEach((local) => (zonalByLocalSlug[slugify(local)] = z));
      });
    });
    const zonalById = {};
    allZonales.forEach((z) => (zonalById[z.id] = z));
    const regionalById = {};
    org.regionales.forEach((r) => (regionalById[r.id] = r));

    const moves = [];
    Object.entries(brandZonalMoves(brand.id)).forEach(([zonalId, newRegionalId]) => {
      const z = zonalById[zonalId];
      const newR = regionalById[newRegionalId];
      if (z && newR) {
        moves.push({
          type: "zonal",
          key: zonalId,
          label: `${z.name} — de ${z.originalRegionalName} a ${newR.name}`,
        });
      }
    });
    Object.entries(brandLocalMoves(brand.id)).forEach(([slug, newZonalId]) => {
      const original = zonalByLocalSlug[slug];
      const newZ = zonalById[newZonalId];
      if (original && newZ) {
        const localName = original.locales.find((l) => slugify(l) === slug);
        moves.push({
          type: "local",
          key: slug,
          label: `${localName} — de ${original.name} a ${newZ.name}`,
        });
      }
    });
    return moves;
  }

  return { moveZonal, undoZonalMove, moveLocal, undoLocalMove, resetBrand, hasMoves, effectiveOrg, listMoves };
})();
