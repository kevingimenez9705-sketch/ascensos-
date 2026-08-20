// app.js
// Router simple por hash:
//   #/                                            -> listado de marcas
//   #/organigrama/:brandId                        -> GTE Comercial + listado de Gerentes Regionales
//   #/organigrama/:brandId/:regionalId             -> Gerente Regional + su Asistente + Gerentes Zonales y locales
//   #/organigrama/:brandId/:regionalId/:zonalId/:localSlug -> exámenes de ascenso cargados en ese local
//
// Fotos y logos: ver assets/README.md para la convención de nombres de
// archivo. Mientras no exista el archivo real, se muestra automáticamente
// un avatar de iniciales (no hace falta tocar nada acá ni en data.js).

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

  function initialsOf(name) {
    return String(name)
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function brandInitials(brand) {
    return brand.shortCode || initialsOf(brand.name);
  }

  // Avatar circular de una persona. Busca assets/photos/<brandId>-<slug>.jpg
  // (o .png); si no existe todavía, se ve directamente el círculo de
  // iniciales de abajo — no hace falta ningún cambio en data.js.
  function avatar(person, brandId, size) {
    size = size || 44;
    const slug = `${brandId}-${slugify(person.name)}`;
    const jpg = `assets/photos/${slug}.jpg`;
    const png = `assets/photos/${slug}.png`;
    return `
      <span class="avatar" style="--avatar-size:${size}px">
        <span class="avatar-fallback">${escapeHtml(initialsOf(person.name))}</span>
        <img class="avatar-img" alt="" src="${jpg}" data-fallback="${png}"
             onload="this.style.opacity=1"
             onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src=this.dataset.fallback}else{this.style.display='none'}">
      </span>`;
  }

  // Logo de marca (cuadrado redondeado). Busca assets/logos/<brandId>.jpg
  // (o .png); si no existe, se ve el cuadrado de iniciales con los colores
  // de la marca.
  function brandLogo(brand, size) {
    size = size || 56;
    const jpg = `assets/logos/${brand.id}.jpg`;
    const png = `assets/logos/${brand.id}.png`;
    return `
      <span class="brand-logo" style="--logo-size:${size}px;background:${brand.logoBg};color:${brand.logoText}">
        <span class="brand-logo-fallback">${escapeHtml(brandInitials(brand))}</span>
        <img class="brand-logo-img" alt="" src="${jpg}" data-fallback="${png}"
             onload="this.style.opacity=1"
             onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src=this.dataset.fallback}else{this.style.display='none'}">
      </span>`;
  }

  function crumbLink(hash, label) {
    return `<a href="${hash}">${escapeHtml(label)}</a>`;
  }

  function crumbs(parts) {
    // parts: [{hash, label} | {label}], el último va sin link.
    return parts
      .map((p, i) => {
        const text = p.hash ? crumbLink(p.hash, p.label) : escapeHtml(p.label);
        return i === 0 ? `<b>${text}</b>` : text;
      })
      .join(` ${icon("chevronRight", { size: 12, class: "crumb-sep" })} `);
  }

  // Línea de contacto (teléfono / email), omite lo que no haya.
  function contactLines(person) {
    const lines = [];
    if (person.phone) {
      lines.push(`<p class="person-contact">${icon("phone", { size: 12 })} ${escapeHtml(person.phone)}</p>`);
    }
    if (person.email) {
      lines.push(`<p class="person-contact person-email">${icon("mail", { size: 12 })} ${escapeHtml(person.email)}</p>`);
    }
    return lines.join("");
  }

  // Tarjeta de persona: avatar a la izquierda, info a la derecha.
  // opts.extra: HTML libre agregado debajo de la fila (ej: lista de locales).
  // opts.meta: línea de resumen con separador arriba (ej: "5 zonales · 27 locales").
  // opts.tag: 'div' (default) o 'button', para tarjetas clickeables.
  // opts.attrs: atributos HTML extra en la etiqueta raíz (ej: data-regional="...").
  function personCard(person, brandId, opts) {
    opts = opts || {};
    const tag = opts.tag || "div";
    const extraClass = opts.extraClass || "";
    const size = opts.size || 44;
    const attrs = opts.attrs || "";
    return `
      <${tag} class="org-card ${extraClass}" style="--brand-color:${opts.brandColor}" ${attrs}>
        <div class="org-card-row">
          ${avatar(person, brandId, size)}
          <div class="org-card-body">
            <p class="role-tag">${escapeHtml(person.role)}</p>
            <p class="person-name">${escapeHtml(person.name)}</p>
            ${contactLines(person)}
          </div>
        </div>
        ${opts.extra || ""}
        ${opts.meta ? `<p class="org-card-meta">${opts.meta}</p>` : ""}
      </${tag}>`;
  }

  // Nodo principal + su par opcional (asistente / responsable), unidos por
  // una línea horizontal. Se usa tanto para GTE Comercial + su par como
  // para GTE Regional + su Asistente de Operaciones.
  function renderPairRow(main, partner, brandId, brandColor) {
    const mainCard = personCard(main, brandId, { extraClass: "org-card-top", brandColor, size: 52 });
    const partnerHtml = partner
      ? `<div class="org-connector org-connector-h"></div>${personCard(partner, brandId, { extraClass: "org-card-top org-card-secondary", brandColor, size: 44 })}`
      : "";

    return `<div class="org-pair-row">${mainCard}${partnerHtml}</div>`;
  }

  // Saludo según la hora del día de quien está mirando la pantalla.
  function timeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  }

  // Fecha de hoy en español, ej: "Miércoles 20 de agosto".
  function todayLabel() {
    const str = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Totales de todo el campus (todas las marcas), para el banner.
  function orgWideStats() {
    let people = 0;
    let locales = 0;
    ASCENSOS_DATA.brands.forEach((brand) => {
      const org = brand.organigrama;
      people += 1;
      if (org.comercial.asistente) people += 1;
      org.regionales.forEach((r) => {
        people += 1;
        if (r.asistente) people += 1;
        r.zonales.forEach((z) => {
          people += 1;
          locales += z.locales.length;
        });
      });
    });
    return { brands: ASCENSOS_DATA.brands.length, people, locales };
  }

  // Mini "foto de equipo": el comercial y el primer regional de cada
  // marca, superpuestos como en un stack de avatares.
  function heroAvatarsHtml() {
    const faces = [];
    ASCENSOS_DATA.brands.forEach((brand) => {
      const org = brand.organigrama;
      faces.push({ person: org.comercial, brand });
      if (org.regionales[0]) faces.push({ person: org.regionales[0], brand });
    });
    return faces
      .map(
        ({ person, brand }) =>
          `<span class="hero-avatar" style="--brand-color:${brand.color}">${avatar(person, brand.id, 48)}</span>`
      )
      .join("");
  }

  // ---------- Home: listado de marcas ----------
  function renderHome() {
    navCrumbEl.innerHTML = crumbs([{ label: "Campus" }, { label: "Ascensos" }]);
    brandPillEl.innerHTML = "";

    const cards = ASCENSOS_DATA.brands
      .map((brand) => {
        const s = ExamStore.statsForBrand(brand.id);
        return `
          <div class="brand-card" style="--brand-color:${brand.color}">
            <div class="brand-card-top">
              ${brandLogo(brand)}
              <div>
                <p class="brand-name">${escapeHtml(brand.name)}</p>
                <p class="brand-manager">${escapeHtml(brand.manager.name)} · ${escapeHtml(brand.manager.role)}</p>
              </div>
            </div>
            <div class="brand-stats">
              <b>${s.exams}</b> exámenes <b>${s.approved}</b> aprobados <b>${formatAttendance(s.attendance)}</b> asist.
            </div>
            <button class="brand-link" data-brand="${brand.id}">Ver organigrama ${icon("arrowRight", { size: 14 })}</button>
          </div>`;
      })
      .join("");

    const stats = orgWideStats();

    appEl.innerHTML = `
      <section class="hero">
        <div class="hero-avatars">${heroAvatarsHtml()}</div>
        <div class="hero-badge">${icon("cap", { size: 14 })} CAMPUS DE ASCENSOS</div>
        <h1>${timeGreeting()}, equipo de<span class="highlight">Capacitaciones</span></h1>
        <p>Elegí una marca para ver su organigrama y cargar exámenes de ascenso.</p>
        <p class="hero-date">${todayLabel()}</p>
        <div class="hero-stats">
          <div class="hero-stat"><b>${stats.brands}</b> marcas</div>
          <div class="hero-stat"><b>${stats.people}</b> personas en el organigrama</div>
          <div class="hero-stat"><b>${stats.locales}</b> locales</div>
        </div>
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
      navCrumbEl.innerHTML = crumbs([{ label: "Campus" }, { hash: "#/", label: "Ascensos" }]);
      appEl.innerHTML = `<div class="empty-state">No encontramos esa marca.<br><a href="#/">Volver</a></div>`;
      return;
    }

    navCrumbEl.innerHTML = crumbs([
      { label: "Campus" },
      { hash: "#/", label: "Ascensos" },
      { label: brand.name },
    ]);
    brandPillEl.innerHTML = `${brandLogo(brand, 26)} ${escapeHtml(brand.name)}`;
    brandPillEl.style.setProperty("--brand-color", brand.color);

    const org = brand.organigrama;

    const regionalCards = org.regionales
      .map((regional) => {
        const zonalesCount = regional.zonales.length;
        const localesCount = regional.zonales.reduce((n, z) => n + z.locales.length, 0);
        return personCard(regional, brand.id, {
          tag: "button",
          extraClass: "org-card-link",
          brandColor: brand.color,
          meta: `${zonalesCount} zonales · ${localesCount} locales`,
          attrs: `data-regional="${regional.id}"`,
        });
      })
      .join("");

    appEl.innerHTML = `
      <button class="back-link" id="backLink">${icon("arrowLeft", { size: 14 })} Volver a marcas</button>

      <div class="org-header">
        <div class="org-brand-title">
          ${brandLogo(brand)}
          <div>
            <h2>${escapeHtml(brand.name)}</h2>
            <p>Organigrama de ascensos</p>
          </div>
        </div>
      </div>

      ${org.pending ? `<div class="org-pending-banner">${icon("warning", { size: 15 })} Organigrama de ejemplo — pendiente de cargar los datos reales de ${escapeHtml(brand.name)}.</div>` : ""}

      <div class="org-tree">
        ${renderPairRow(org.comercial, org.comercial.asistente, brand.id, brand.color)}
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
      navCrumbEl.innerHTML = crumbs([{ label: "Campus" }, { hash: "#/", label: "Ascensos" }]);
      appEl.innerHTML = `<div class="empty-state">No encontramos ese regional.<br><a href="#/">Volver</a></div>`;
      return;
    }

    navCrumbEl.innerHTML = crumbs([
      { label: "Campus" },
      { hash: "#/", label: "Ascensos" },
      { hash: `#/organigrama/${brand.id}`, label: brand.name },
      { label: regional.name },
    ]);
    brandPillEl.innerHTML = `${brandLogo(brand, 26)} ${escapeHtml(brand.name)}`;
    brandPillEl.style.setProperty("--brand-color", brand.color);

    const zonalCards = regional.zonales
      .map((zonal) => {
        const locales = zonal.locales
          .map((local) => {
            const count = ExamStore.countForLocal(brand.id, regional.id, zonal.id, local);
            const badge = count > 0 ? `<span class="local-badge">${count}</span>` : "";
            return `<li><button class="local-link" data-zonal="${zonal.id}" data-local="${slugify(local)}">${icon("building", { size: 13 })} ${escapeHtml(local)}${badge}</button></li>`;
          })
          .join("");
        return personCard(zonal, brand.id, {
          extraClass: "org-zonal-card",
          brandColor: brand.color,
          size: 38,
          extra: `<ul class="org-locales-inline">${locales}</ul>`,
        });
      })
      .join("");

    appEl.innerHTML = `
      <button class="back-link" id="backLink">${icon("arrowLeft", { size: 14 })} Volver a ${escapeHtml(brand.name)}</button>

      <div class="org-header">
        <div class="org-brand-title">
          ${brandLogo(brand)}
          <div>
            <h2>${escapeHtml(regional.name)}</h2>
            <p>${escapeHtml(regional.role)} · ${escapeHtml(brand.name)}</p>
          </div>
        </div>
      </div>

      <div class="org-tree">
        ${renderPairRow(regional, regional.asistente, brand.id, brand.color)}
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
      navCrumbEl.innerHTML = crumbs([{ label: "Campus" }, { hash: "#/", label: "Ascensos" }]);
      appEl.innerHTML = `<div class="empty-state">No encontramos ese local.<br><a href="#/">Volver</a></div>`;
      return;
    }

    navCrumbEl.innerHTML = crumbs([
      { label: "Campus" },
      { hash: "#/", label: "Ascensos" },
      { hash: `#/organigrama/${brand.id}`, label: brand.name },
      { hash: `#/organigrama/${brand.id}/${regional.id}`, label: regional.name },
      { label: localName },
    ]);
    brandPillEl.innerHTML = `${brandLogo(brand, 26)} ${escapeHtml(brand.name)}`;
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
            <td><button class="row-delete" data-id="${e.id}" title="Eliminar examen">${icon("trash", { size: 15 })}</button></td>
          </tr>`;
      })
      .join("");

    const today = new Date().toISOString().slice(0, 10);

    appEl.innerHTML = `
      <button class="back-link" id="backLink">${icon("arrowLeft", { size: 14 })} Volver a ${escapeHtml(regional.name)}</button>

      <div class="org-header">
        <div class="org-brand-title">
          ${brandLogo(brand)}
          <div>
            <h2>${escapeHtml(localName)}</h2>
            <p>${escapeHtml(zonal.name)} (GTE Zonal) · ${escapeHtml(regional.name)} · ${escapeHtml(brand.name)}</p>
          </div>
        </div>
        <button class="btn-primary" id="toggleFormBtn" style="--brand-color:${brand.color}">${icon("plus", { size: 14 })} Cargar examen</button>
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
    appEl.classList.remove("fade-in");
    // reflow para poder re-disparar la animación en cada navegación
    void appEl.offsetWidth;
    appEl.classList.add("fade-in");
  }

  window.addEventListener("hashchange", route);

  document.addEventListener("DOMContentLoaded", route);
})();
