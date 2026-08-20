// app.js
// Router simple por hash:
//   #/                                            -> listado de marcas
//   #/organigrama/:brandId                        -> GTE Comercial + listado de Gerentes Regionales
//   #/organigrama/:brandId/:regionalId             -> Gerente Regional + su Asistente + Gerentes Zonales y locales
//   #/organigrama/:brandId/:regionalId/:zonalId/:localSlug -> exámenes de ascenso cargados en ese local

(function () {
  const appEl = document.getElementById("app");
  const brandPillEl = document.getElementById("brandPill");
  const navCrumbEl = document.getElementById("navCrumb");

  const RESULTADOS = {
    aprobado: "Aprobado",
    desaprobado: "Desaprobado",
    pendiente: "Pendiente de revisión",
    "no-asistio": "No asistió",
  };

  function getBrand(id) {
    return ASCENSOS_DATA.brands.find((b) => b.id === id);
  }

  function getRegional(brand, regionalId) {
    return brand.organigrama.regionales.find((r) => r.id === regionalId);
  }

  function getZonal(regional, zonalId) {
    return regional.zonales.find((z) => z.id === zonalId);
  }

  // El local no tiene id propio en data.js (es solo un nombre dentro de
  // zonal.locales[]): lo identificamos por el slug de su nombre.
  function getLocalName(zonal, localSlug) {
    return zonal.locales.find((name) => slugify(name) === localSlug) || null;
  }

  function formatAttendance(value) {
    return value === null || value === undefined ? "S/D" : value;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function brandInitials(brand) {
    if (brand.shortCode) return brand.shortCode;
    return brand.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();
  }

  function renderBrandLogo(brand) {
    return `<div class="brand-logo" style="background:${brand.logoBg};color:${brand.logoText}">${brandInitials(brand)}</div>`;
  }

  function crumbLink(hash, label) {
    return `<a href="${hash}">${escapeHtml(label)}</a>`;
  }

  // Línea de contacto (teléfono / email), omite lo que no haya.
  function contactLines(person) {
    const lines = [];
    if (person.phone) lines.push(`<p class="person-contact">📱 ${escapeHtml(person.phone)}</p>`);
    if (person.email) lines.push(`<p class="person-contact person-email">${escapeHtml(person.email)}</p>`);
    return lines.join("");
  }

  // Nodo principal + su par opcional (asistente / responsable), unidos por
  // una línea horizontal. Se usa tanto para GTE Comercial + su par como
  // para GTE Regional + su Asistente de Operaciones.
  function renderPairRow(main, partner, brandColor) {
    const partnerHtml = partner
      ? `
        <div class="org-connector org-connector-h"></div>
        <div class="org-card org-card-top org-card-secondary" style="--brand-color:${brandColor}">
          <p class="role-tag">${escapeHtml(partner.role)}</p>
          <p class="person-name">${escapeHtml(partner.name)}</p>
          ${contactLines(partner)}
        </div>`
      : "";

    return `
      <div class="org-pair-row">
        <div class="org-card org-card-top" style="--brand-color:${brandColor}">
          <p class="role-tag">${escapeHtml(main.role)}</p>
          <p class="person-name">${escapeHtml(main.name)}</p>
          ${contactLines(main)}
        </div>
        ${partnerHtml}
      </div>`;
  }

  // ---------- Home: listado de marcas ----------
  function renderHome() {
    navCrumbEl.innerHTML = `<b>Campus</b> &gt; Ascensos`;
    brandPillEl.innerHTML = "";

    const cards = ASCENSOS_DATA.brands
      .map((brand) => {
        const s = ExamStore.statsForBrand(brand.id);
        return `
          <div class="brand-card" style="--brand-color:${brand.color}">
            <div class="brand-card-top">
              ${renderBrandLogo(brand)}
              <div>
                <p class="brand-name">${escapeHtml(brand.name)}</p>
                <p class="brand-manager">${escapeHtml(brand.manager.name)} · ${escapeHtml(brand.manager.role)}</p>
              </div>
            </div>
            <div class="brand-stats">
              <b>${s.exams}</b> exámenes <b>${s.approved}</b> aprobados <b>${formatAttendance(s.attendance)}</b> asist.
            </div>
            <button class="brand-link" data-brand="${brand.id}">Ver organigrama →</button>
          </div>`;
      })
      .join("");

    appEl.innerHTML = `
      <section class="hero">
        <div class="hero-badge">🎓 CAMPUS DE ASCENSOS</div>
        <h1>Buenos días, equipo de<span class="highlight">Capacitaciones</span></h1>
        <p>Elegí una marca para ver su organigrama y cargar exámenes de ascenso.</p>
      </section>

      <p class="section-label">MARCAS</p>
      <div class="brand-grid">${cards}</div>
    `;

    appEl.querySelectorAll("[data-brand]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.location.hash = `#/organigrama/${btn.dataset.brand}`;
      });
    });
  }

  // ---------- Nivel 1: GTE Comercial + Gerentes Regionales ----------
  function renderOrganigrama(brandId) {
    const brand = getBrand(brandId);

    if (!brand) {
      navCrumbEl.innerHTML = `<b>Campus</b> &gt; Ascensos`;
      appEl.innerHTML = `<div class="empty-state">No encontramos esa marca.<br><a href="#/">Volver</a></div>`;
      return;
    }

    navCrumbEl.innerHTML = `<b>Campus</b> &gt; ${crumbLink("#/", "Ascensos")} &gt; ${escapeHtml(brand.name)}`;
    brandPillEl.innerHTML = `${renderBrandLogo(brand)} ${escapeHtml(brand.name)}`;
    brandPillEl.style.setProperty("--brand-color", brand.color);

    const org = brand.organigrama;

    const regionalCards = org.regionales
      .map((regional) => {
        const zonalesCount = regional.zonales.length;
        const localesCount = regional.zonales.reduce((n, z) => n + z.locales.length, 0);
        return `
          <button class="org-card org-card-link" style="--brand-color:${brand.color}" data-regional="${regional.id}">
            <p class="role-tag">${escapeHtml(regional.role)}</p>
            <p class="person-name">${escapeHtml(regional.name)}</p>
            ${contactLines(regional)}
            <p class="org-card-meta">${zonalesCount} zonales · ${localesCount} locales</p>
          </button>`;
      })
      .join("");

    appEl.innerHTML = `
      <button class="back-link" id="backLink">← Volver a marcas</button>

      <div class="org-header">
        <div class="org-brand-title">
          ${renderBrandLogo(brand)}
          <div>
            <h2>${escapeHtml(brand.name)}</h2>
            <p>Organigrama de ascensos</p>
          </div>
        </div>
      </div>

      ${org.pending ? `<div class="org-pending-banner">⚠️ Organigrama de ejemplo — pendiente de cargar los datos reales de ${escapeHtml(brand.name)}.</div>` : ""}

      <div class="org-tree">
        ${renderPairRow(org.comercial, org.comercial.asistente, brand.color)}
        <div class="org-connector"></div>
        <div class="org-children-grid">${regionalCards}</div>
      </div>
    `;

    document.getElementById("backLink").addEventListener("click", () => {
      window.location.hash = "#/";
    });
    appEl.querySelectorAll("[data-regional]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.location.hash = `#/organigrama/${brand.id}/${btn.dataset.regional}`;
      });
    });
  }

  // ---------- Nivel 2: Gerente Regional + Asistente + Gerentes Zonales ----------
  function renderRegional(brandId, regionalId) {
    const brand = getBrand(brandId);
    const regional = brand ? getRegional(brand, regionalId) : null;

    if (!brand || !regional) {
      navCrumbEl.innerHTML = `<b>Campus</b> &gt; Ascensos`;
      appEl.innerHTML = `<div class="empty-state">No encontramos ese regional.<br><a href="#/">Volver</a></div>`;
      return;
    }

    navCrumbEl.innerHTML = `<b>Campus</b> &gt; ${crumbLink("#/", "Ascensos")} &gt; ${crumbLink(`#/organigrama/${brand.id}`, brand.name)} &gt; ${escapeHtml(regional.name)}`;
    brandPillEl.innerHTML = `${renderBrandLogo(brand)} ${escapeHtml(brand.name)}`;
    brandPillEl.style.setProperty("--brand-color", brand.color);

    const zonalCards = regional.zonales
      .map((zonal) => {
        const locales = zonal.locales
          .map((local) => {
            const count = ExamStore.countForLocal(brand.id, regional.id, zonal.id, local);
            const badge = count > 0 ? `<span class="local-badge">${count}</span>` : "";
            return `<li><button class="local-link" data-zonal="${zonal.id}" data-local="${slugify(local)}">${escapeHtml(local)}${badge}</button></li>`;
          })
          .join("");
        return `
          <div class="org-card org-zonal-card" style="--brand-color:${brand.color}">
            <p class="role-tag">${escapeHtml(zonal.role)}</p>
            <p class="person-name">${escapeHtml(zonal.name)}</p>
            ${contactLines(zonal)}
            <ul class="org-locales-inline">${locales}</ul>
          </div>`;
      })
      .join("");

    appEl.innerHTML = `
      <button class="back-link" id="backLink">← Volver a ${escapeHtml(brand.name)}</button>

      <div class="org-header">
        <div class="org-brand-title">
          ${renderBrandLogo(brand)}
          <div>
            <h2>${escapeHtml(regional.name)}</h2>
            <p>${escapeHtml(regional.role)} · ${escapeHtml(brand.name)}</p>
          </div>
        </div>
      </div>

      <div class="org-tree">
        ${renderPairRow(regional, regional.asistente, brand.color)}
        <div class="org-connector"></div>
        <div class="org-children-grid org-children-grid-zonales">${zonalCards}</div>
      </div>
    `;

    document.getElementById("backLink").addEventListener("click", () => {
      window.location.hash = `#/organigrama/${brand.id}`;
    });
    appEl.querySelectorAll(".local-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.location.hash = `#/organigrama/${brand.id}/${regional.id}/${btn.dataset.zonal}/${btn.dataset.local}`;
      });
    });
  }

  // ---------- Nivel 3: exámenes de ascenso cargados en un local ----------
  function renderLocal(brandId, regionalId, zonalId, localSlug) {
    const brand = getBrand(brandId);
    const regional = brand ? getRegional(brand, regionalId) : null;
    const zonal = regional ? getZonal(regional, zonalId) : null;
    const localName = zonal ? getLocalName(zonal, localSlug) : null;

    if (!brand || !regional || !zonal || !localName) {
      navCrumbEl.innerHTML = `<b>Campus</b> &gt; Ascensos`;
      appEl.innerHTML = `<div class="empty-state">No encontramos ese local.<br><a href="#/">Volver</a></div>`;
      return;
    }

    navCrumbEl.innerHTML = `<b>Campus</b> &gt; ${crumbLink("#/", "Ascensos")} &gt; ${crumbLink(`#/organigrama/${brand.id}`, brand.name)} &gt; ${crumbLink(`#/organigrama/${brand.id}/${regional.id}`, regional.name)} &gt; ${escapeHtml(localName)}`;
    brandPillEl.innerHTML = `${renderBrandLogo(brand)} ${escapeHtml(brand.name)}`;
    brandPillEl.style.setProperty("--brand-color", brand.color);

    const exams = ExamStore.forLocal(brand.id, regional.id, zonal.id, localName);
    const total = exams.length;
    const aprobados = exams.filter((e) => e.resultado === "aprobado").length;
    const asistieron = exams.filter((e) => e.asistio).length;
    const asistenciaPct = total ? `${Math.round((asistieron / total) * 100)}%` : "S/D";

    const rows = exams
      .map((e) => {
        const puesto = [e.puestoActual, e.puestoPostula].filter(Boolean).join(" → ");
        return `
          <tr>
            <td>${escapeHtml(e.nombre)} ${escapeHtml(e.apellido)}</td>
            <td>${puesto ? escapeHtml(puesto) : "—"}</td>
            <td>${e.fecha ? escapeHtml(e.fecha) : "—"}</td>
            <td>${e.asistio ? "Sí" : "No"}</td>
            <td>${e.puntaje === null || e.puntaje === undefined ? "—" : escapeHtml(e.puntaje)}</td>
            <td><span class="resultado-badge resultado-${e.resultado}">${RESULTADOS[e.resultado] || e.resultado}</span></td>
            <td class="col-obs">${e.observaciones ? escapeHtml(e.observaciones) : "—"}</td>
            <td><button class="row-delete" data-id="${e.id}" title="Eliminar examen">🗑</button></td>
          </tr>`;
      })
      .join("");

    const today = new Date().toISOString().slice(0, 10);

    appEl.innerHTML = `
      <button class="back-link" id="backLink">← Volver a ${escapeHtml(regional.name)}</button>

      <div class="org-header">
        <div class="org-brand-title">
          ${renderBrandLogo(brand)}
          <div>
            <h2>${escapeHtml(localName)}</h2>
            <p>${escapeHtml(zonal.name)} (GTE Zonal) · ${escapeHtml(regional.name)} · ${escapeHtml(brand.name)}</p>
          </div>
        </div>
        <button class="btn-primary" id="toggleFormBtn" style="--brand-color:${brand.color}">+ Cargar examen</button>
      </div>

      <div class="local-stats-row">
        <div class="local-stat"><b>${total}</b> exámenes</div>
        <div class="local-stat"><b>${aprobados}</b> aprobados</div>
        <div class="local-stat"><b>${asistenciaPct}</b> asistencia</div>
      </div>

      <form id="examForm" class="exam-form" hidden>
        <div class="exam-form-grid">
          <label>Nombre
            <input type="text" name="nombre" required>
          </label>
          <label>Apellido
            <input type="text" name="apellido" required>
          </label>
          <label>Puesto actual
            <input type="text" name="puestoActual" placeholder="Ej: Cajero/a">
          </label>
          <label>Puesto al que postula
            <input type="text" name="puestoPostula" placeholder="Ej: Encargado/a de turno">
          </label>
          <label>Fecha del examen
            <input type="date" name="fecha" value="${today}" required>
          </label>
          <label>¿Asistió?
            <select name="asistio" id="asistioSelect">
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </label>
          <label id="puntajeField">Puntaje (0-100)
            <input type="number" name="puntaje" min="0" max="100" step="1">
          </label>
          <label id="resultadoField">Resultado
            <select name="resultado">
              <option value="pendiente">Pendiente de revisión</option>
              <option value="aprobado">Aprobado</option>
              <option value="desaprobado">Desaprobado</option>
            </select>
          </label>
          <label class="exam-form-full">Observaciones
            <textarea name="observaciones" rows="2" placeholder="Opcional"></textarea>
          </label>
        </div>
        <div class="exam-form-actions">
          <button type="button" class="btn-ghost" id="cancelFormBtn">Cancelar</button>
          <button type="submit" class="btn-primary" style="--brand-color:${brand.color}">Guardar examen</button>
        </div>
      </form>

      <div class="table-scroll">
        <table class="exam-table">
          <thead>
            <tr>
              <th>Nombre y apellido</th>
              <th>Puesto</th>
              <th>Fecha</th>
              <th>Asistió</th>
              <th>Puntaje</th>
              <th>Resultado</th>
              <th>Observaciones</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="8" class="empty-table">Todavía no hay exámenes cargados en este local.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById("backLink").addEventListener("click", () => {
      window.location.hash = `#/organigrama/${brand.id}/${regional.id}`;
    });

    const formEl = document.getElementById("examForm");
    const toggleBtn = document.getElementById("toggleFormBtn");
    const cancelBtn = document.getElementById("cancelFormBtn");
    const asistioSelect = document.getElementById("asistioSelect");
    const puntajeField = document.getElementById("puntajeField");
    const resultadoField = document.getElementById("resultadoField");

    function syncAsistioFields() {
      const asistio = asistioSelect.value === "si";
      puntajeField.style.display = asistio ? "" : "none";
      resultadoField.style.display = asistio ? "" : "none";
    }
    asistioSelect.addEventListener("change", syncAsistioFields);
    syncAsistioFields();

    toggleBtn.addEventListener("click", () => {
      formEl.hidden = !formEl.hidden;
      if (!formEl.hidden) formEl.querySelector('[name="nombre"]').focus();
    });
    cancelBtn.addEventListener("click", () => {
      formEl.reset();
      formEl.hidden = true;
    });

    formEl.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const data = new FormData(formEl);
      const asistio = data.get("asistio") === "si";
      const puntajeRaw = data.get("puntaje");

      ExamStore.add({
        brandId: brand.id,
        regionalId: regional.id,
        zonalId: zonal.id,
        localName: localName,
        nombre: String(data.get("nombre") || "").trim(),
        apellido: String(data.get("apellido") || "").trim(),
        puestoActual: String(data.get("puestoActual") || "").trim(),
        puestoPostula: String(data.get("puestoPostula") || "").trim(),
        fecha: data.get("fecha"),
        asistio,
        puntaje: asistio && puntajeRaw !== "" ? Number(puntajeRaw) : null,
        resultado: asistio ? data.get("resultado") : "no-asistio",
        observaciones: String(data.get("observaciones") || "").trim(),
      });

      route();
    });

    appEl.querySelectorAll(".row-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("¿Eliminar este examen?")) {
          ExamStore.remove(btn.dataset.id);
          route();
        }
      });
    });
  }

  // ---------- Router ----------
  function route() {
    const hash = window.location.hash || "#/";
    const localMatch = hash.match(/^#\/organigrama\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/);
    const regionalMatch = hash.match(/^#\/organigrama\/([^/]+)\/([^/]+)$/);
    const brandMatch = hash.match(/^#\/organigrama\/([^/]+)$/);

    if (localMatch) {
      renderLocal(localMatch[1], localMatch[2], localMatch[3], localMatch[4]);
    } else if (regionalMatch) {
      renderRegional(regionalMatch[1], regionalMatch[2]);
    } else if (brandMatch) {
      renderOrganigrama(brandMatch[1]);
    } else {
      renderHome();
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", route);

  document.addEventListener("DOMContentLoaded", route);
})();
