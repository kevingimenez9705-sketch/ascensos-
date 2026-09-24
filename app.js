// app.js
// Router simple por hash:
//   #/                                            -> listado de marcas
//   #/organigrama/:brandId                        -> GTE Comercial + listado de Gerentes Regionales
//   #/organigrama/:brandId/:regionalId             -> Gerente Regional + su Asistente + Gerentes Zonales y locales
//   #/organigrama/:brandId/:regionalId/:zonalId/:localSlug -> exámenes de ascenso cargados en ese local
//   #/examen-online                               -> panel del examen online
//   #/citaciones                                  -> citados a examen y no asistencias
//
// Fotos y logos: ver assets/README.md para la convención de nombres de
// archivo. Mientras no exista el archivo real, se muestra automáticamente
// un avatar de iniciales (no hace falta tocar nada acá ni en data.js).

(function () {
  const appEl = document.getElementById("app");
  const brandPillEl = document.getElementById("brandPill");
  const authBarEl = document.getElementById("authBar");
  // Examen online (repo Examenes-Emi).
  const EXAMEN_URL = "https://examenes-emi.vercel.app/";
  const navCrumbEl = document.getElementById("navCrumb");
  const syncPillEl = document.getElementById("syncPill");

  const RESULTADOS = {
    aprobado: "Aprobado",
    desaprobado: "Desaprobado",
    pendiente: "Pendiente de revisión",
    "no-asistio": "No asistió",
  };

  function getBrand(id) {
    return ASCENSOS_DATA.brands.find((b) => b.id === id);
  }

  // Nota: "org" acá siempre es el organigrama EFECTIVO (con los
  // movimientos de OrgOverrides ya aplicados), no brand.organigrama
  // directo — así una zonal/local movida aparece en su lugar nuevo.
  function getRegional(org, regionalId) {
    return org.regionales.find((r) => r.id === regionalId);
  }

  function getZonal(regional, zonalId) {
    return regional.zonales.find((z) => z.id === zonalId);
  }

  // El local no tiene id propio en data.js (es solo un nombre dentro de
  // zonal.locales[]): lo identificamos por el slug de su nombre.
  function getLocalName(zonal, localSlug) {
    return zonal.locales.find((name) => slugify(name) === localSlug) || null;
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
    // Primero el recorte centrado en la cara (assets/photos/caras, generado a
    // partir de la foto original); si no existe, la foto original .jpg o .png.
    const cara = `assets/photos/caras/${slug}.jpg`;
    const fallbacks = `assets/photos/${slug}.jpg|assets/photos/${slug}.png`;
    return `
      <span class="avatar" style="--avatar-size:${size}px">
        <span class="avatar-fallback">${escapeHtml(initialsOf(person.name))}</span>
        <img class="avatar-img" alt="" src="${cara}" data-fallback="${fallbacks}"
             onload="this.style.opacity=1"
             onerror="const r=(this.dataset.fallback||'').split('|').filter(Boolean);if(r.length){this.classList.add('avatar-original');this.dataset.fallback=r.slice(1).join('|');this.src=r[0]}else{this.style.display='none'}">
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
        if (i === 0) return `<b>${icon("cap", { size: 18 })} ${text}</b>`;
        return i === parts.length - 1 ? `<span class="crumb-active">${text}</span>` : text;
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
  // opts.meta: línea (o array de líneas) de resumen, con separador arriba
  //   (ej: "5 zonales · 27 locales", o esa + una línea de stats de exámenes).
  // opts.extra: HTML libre agregado debajo del meta (ej: lista de locales).
  // opts.tag: 'div' (default) o 'button', para tarjetas clickeables.
  // opts.attrs: atributos HTML extra en la etiqueta raíz (ej: data-regional="...").
  function personCard(person, brandId, opts) {
    opts = opts || {};
    const tag = opts.tag || "div";
    const extraClass = opts.extraClass || "";
    const size = opts.size || 68;
    const attrs = opts.attrs || "";
    const metaLines = opts.meta ? (Array.isArray(opts.meta) ? opts.meta : [opts.meta]) : [];
    const metaHtml = metaLines
      .map((line, i) => `<p class="org-card-meta${i > 0 ? " org-card-meta-sub" : ""}">${line}</p>`)
      .join("");
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
        ${metaHtml}
        ${opts.extra || ""}
      </${tag}>`;
  }

  // ---------- Estadísticas de exámenes: formato reutilizable ----------
  function pctLabel(value) {
    return value === null || value === undefined ? "S/D" : `${value}%`;
  }
  function scoreLabel(value) {
    return value === null || value === undefined ? "S/D" : value;
  }

  // Fila de "pills" grandes: exámenes, aprobados, promedio, asistencia,
  // % aprobados. Se usa en la vista de un local y en el resumen de un regional.
  function statsRowHtml(stats) {
    return `
      <div class="stats-row">
        <div class="stat-pill"><b>${stats.exams}</b> exámenes</div>
        <div class="stat-pill"><b>${stats.approved}</b> aprobados</div>
        <div class="stat-pill">Prom. <b>${scoreLabel(stats.avgScore)}</b></div>
        <div class="stat-pill"><b>${pctLabel(stats.attendancePct)}</b> asistencia</div>
        <div class="stat-pill"><b>${pctLabel(stats.approvalPct)}</b> aprobados</div>
      </div>`;
  }

  // Línea compacta de una sola oración, para el meta de una tarjeta
  // (regional o zonal) dentro del organigrama.
  function statsMetaLine(stats) {
    if (!stats.exams) return "Sin exámenes cargados";
    return `${stats.exams} exámenes · ${pctLabel(stats.approvalPct)} aprobados · Prom. ${scoreLabel(stats.avgScore)}`;
  }

  // Dos líneas cortas para la card de una marca en la home.
  function statsBrandLinesHtml(stats) {
    if (!stats.exams) {
      return `<div class="brand-stats">Todavía no se cargaron exámenes en esta marca.</div>`;
    }
    const prom = stats.avgScore === null ? "S/D" : Number(stats.avgScore).toLocaleString("es-AR");
    return `
      <div class="brand-kpis">
        <div><b>${stats.exams.toLocaleString("es-AR")}</b><span>Exámenes</span></div>
        <div><b>${stats.approved.toLocaleString("es-AR")}</b><span>Aprobados</span></div>
        <div><b>${prom}</b><span>Promedio</span></div>
      </div>`;
  }

  // Todos los nombres de local que cuelgan de un regional (organigrama efectivo).
  function localNamesForRegional(regional) {
    return regional.zonales.reduce((acc, z) => acc.concat(z.locales), []);
  }

  // Busca en qué regional/zonal está HOY un local (organigrama efectivo),
  // para poder armar el link correcto aunque se haya movido de lugar.
  function findLocalLocation(org, localName) {
    for (const r of org.regionales) {
      for (const z of r.zonales) {
        if (z.locales.includes(localName)) return { regionalId: r.id, zonalId: z.id };
      }
    }
    return null;
  }

  // Panel de "últimos exámenes cargados" (todas las marcas), para la home.
  function recentExamsHtml() {
    const items = ExamStore.recent(8);
    if (!items.length) {
      return `<div class="empty-state">Todavía no se cargó ningún examen.</div>`;
    }
    return items
      .map((e) => {
        const brand = getBrand(e.brandId);
        if (!brand) return "";
        const org = OrgOverrides.effectiveOrg(brand);
        const loc = findLocalLocation(org, e.localName);
        const href = loc
          ? `#/organigrama/${brand.id}/${loc.regionalId}/${loc.zonalId}/${slugify(e.localName)}`
          : `#/organigrama/${brand.id}`;
        const when = e.fecha || e.createdAt.slice(0, 10);
        return `
          <a class="recent-exam" href="${href}" style="--brand-color:${brand.color}">
            ${avatar({ name: `${e.nombre} ${e.apellido}` }, brand.id, 34)}
            <span class="recent-exam-body">
              <span class="recent-exam-name">${escapeHtml(e.nombre)} ${escapeHtml(e.apellido)}</span>
              <span class="recent-exam-meta">${escapeHtml(e.localName)} · ${escapeHtml(brand.name)} · ${escapeHtml(when)}</span>
            </span>
            <span class="resultado-badge resultado-${e.resultado}">${e.resultado === "aprobado" ? icon("check", { size: 14 }) : ""}${RESULTADOS[e.resultado] || e.resultado}</span>
          </a>`;
      })
      .join("");
  }

  // Nodo principal + su par opcional (asistente / responsable), unidos por
  // una línea horizontal. Se usa tanto para GTE Comercial + su par como
  // para GTE Regional + su Asistente de Operaciones.
  function renderPairRow(main, partner, brandId, brandColor) {
    const mainCard = personCard(main, brandId, { extraClass: "org-card-top", brandColor, size: 84 });
    const partnerHtml = partner
      ? `<div class="org-connector org-connector-h"></div>${personCard(partner, brandId, { extraClass: "org-card-top org-card-secondary", brandColor, size: 72 })}`
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

  // ---------- Pantalla de inicio (previa al panel) ----------
  // Solo presentación: muestra al equipo de Capacitaciones y un botón para
  // entrar. No filtra ni identifica al usuario, es simplemente la portada
  // que se ve antes de llegar al panel de marcas/exámenes.
  const TEAM = [
    { id: "angel", name: "Angel", role: "Jefe de Capacitación", trait: "Mágico", color: "#1d3557" },
    {
      id: "emiliano",
      name: "Emiliano",
      role: "Capacitador",
      trait: "Genuino",
      color: "#2176ae",
      // Examen de ascenso online (repo Examenes-Emi, proyecto examenes-emi en Vercel).
      link: "https://examenes-emi.vercel.app/?marca=sabores",
    },
  ];

  const QUICK_LINKS = [
    { name: "Icheck", image: "assets/logos/quick-icheck.png", color: "#1b998a", href: "https://drive.google.com/drive/u/3/folders/1Qntxhq59U6ELX6T8nWSEWiKqLQQwVWns" },
    { name: "Bloques A2", image: "assets/logos/quick-bloques.png", color: "#3949ab", href: "https://drive.google.com/drive/u/3/folders/1jt4Vv3jgvlqcAXFfQ9PSkwaUvD_aRLuX" },
    { name: "Organigramas", image: "assets/logos/quick-organigramas.png", color: "#2ea8dc", href: "https://drive.google.com/drive/u/3/folders/1VdwO7uJscKcv1NYLHoDoIi3-Oeyb4FhN" },
    { name: "Manuales", image: "assets/logos/quick-manuales.png", color: "#14577a", href: "https://drive.google.com/drive/u/3/folders/1o_q9nqF6GYvQtVtvVWRDrb3L4gx0QRVm" },
    { name: "Biblioteca de Capacitaciones", image: "assets/logos/quick-biblioteca.png", color: "#2b4c6f", href: null },
    { name: "Cronograma", image: "assets/logos/quick-cronograma.png", color: "#4f7cac", href: "https://drive.google.com/drive/folders/1WZSoQy1FUWbYL7t59VOnan_2ojABiwJg?usp=sharing" },
  ];

  function renderIntro(onEnter) {
    navCrumbEl.innerHTML = crumbs([{ label: "Campus" }, { label: "Ascensos" }]);
    brandPillEl.innerHTML = "";
    document.body.classList.add("intro-active");

    const quickLinks = QUICK_LINKS.map((link) => {
      const inner = `
        <span class="quicklink-icon"><img src="${encodeURI(link.image)}" alt=""></span>
        <span class="quicklink-name">${escapeHtml(link.name)}</span>`;
      return link.href
        ? `<a class="quicklink-card" style="--link-color:${link.color}" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
        : `<div class="quicklink-card quicklink-card-disabled" style="--link-color:${link.color}" title="Próximamente">${inner}</div>`;
    }).join("");

    // El Panel de Exámenes va como un acceso más (el primero).
    const panelCard = `
      <button type="button" class="quicklink-card quicklink-panel" id="introEnter">
        <span class="quicklink-icon"><img src="assets/logos/quick-panel-examenes.svg" alt=""></span>
        <span class="quicklink-name">Panel de Exámenes</span>
      </button>`;

    const cards = TEAM.map((person) => {
      const photo = person.link
        ? `<a class="avatar-link" href="${escapeHtml(person.link)}" target="_blank" rel="noopener noreferrer"
              title="Ir al examen de ${escapeHtml(person.name)}">${avatar(person, "equipo", 104).trim()}</a>`
        : avatar(person, "equipo", 104);
      return `
        <div class="team-card" style="--team-color:${person.color}">
          ${photo}
          <p class="team-name">${escapeHtml(person.name)}</p>
          <p class="team-role">${escapeHtml(person.role)}</p>
          ${person.trait ? `<p class="team-trait">${escapeHtml(person.trait)}</p>` : ""}
        </div>`;
    }).join("");

    appEl.innerHTML = `
      <p class="section-label">ACCESOS RÁPIDOS</p>
      <div class="quicklinks-grid">${panelCard}${quickLinks}</div>

      <p class="section-label">NUESTRO EQUIPO</p>
      <div class="team-grid">${cards}</div>
    `;

    document.getElementById("introEnter").addEventListener("click", onEnter);
  }

  // ---------- Home: listado de marcas ----------
  function renderHome() {
    navCrumbEl.innerHTML = crumbs([{ label: "Campus" }, { label: "Ascensos" }]);
    brandPillEl.innerHTML = "";

    const cards = ASCENSOS_DATA.brands
      .map((brand) => {
        const s = ExamStore.statsForBrand(brand.id);
        return `
          <div class="brand-card" data-brand-id="${brand.id}" style="--brand-color:${brand.color}">
            <div class="brand-card-top">
              ${brandLogo(brand)}
              <div>
                <p class="brand-name">${escapeHtml(brand.name)}</p>
                <p class="brand-manager">${escapeHtml(brand.manager.name)} · ${escapeHtml(brand.manager.role)}</p>
              </div>
            </div>
            ${statsBrandLinesHtml(s)}
            <div class="brand-foot">
              <span class="brand-stats">${s.exams ? `<b>${pctLabel(s.attendancePct)}</b> asistencia · <b>${pctLabel(s.approvalPct)}</b> aprobación` : ""}</span>
              <button class="brand-link" data-brand="${brand.id}">Ver organigrama ${icon("arrowRight", { size: 14 })}</button>
            </div>
          </div>`;
      })
      .join("");

    const stats = orgWideStats();
    const today = new Date().toISOString().slice(0, 10);
    const brandOptions = ASCENSOS_DATA.brands.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");

    appEl.innerHTML = `
      <section class="hero">
        <div class="hero-badge">${icon("cap", { size: 14 })} CAMPUS DE ASCENSOS</div>
        <h1>${timeGreeting()}, equipo de<span class="highlight">Capacitaciones</span></h1>
        <p>Elegí una marca para ver su organigrama y cargar exámenes de ascenso.</p>
        <p class="hero-date">${todayLabel()}</p>
        <div class="hero-stats">
          <div class="hero-stat"><b>${stats.brands}</b> marcas</div>
          <div class="hero-stat"><b>${stats.people}</b> personas en el organigrama</div>
          <div class="hero-stat"><b>${stats.locales}</b> locales</div>
        </div>
        <button class="btn-primary hero-cta" id="quickExamToggle">${icon("plus", { size: 16 })} Cargar examen</button>
      </section>

      <div class="quick-exam-section">
        <form id="quickExamForm" class="exam-form" hidden>
          <p class="exam-form-hint">Elegí dónde se rindió el examen:</p>
          <div class="exam-form-grid">
            <label>Marca
              <select name="brandId" id="qBrand" required>
                <option value="">Elegí una marca</option>
                ${brandOptions}
              </select>
            </label>
            <label>Regional
              <select name="regionalId" id="qRegional" required disabled>
                <option value="">Primero elegí una marca</option>
              </select>
            </label>
            <label>Zonal
              <select name="zonalId" id="qZonal" required disabled>
                <option value="">Primero elegí un regional</option>
              </select>
            </label>
            <label>Local
              <select name="localName" id="qLocal" required disabled>
                <option value="">Primero elegí una zonal</option>
              </select>
            </label>
          </div>
          <div class="exam-form-grid exam-form-grid-spaced">
            ${examFieldsHtml(today)}
          </div>
          <div class="exam-form-actions">
            <button type="button" class="btn-ghost" id="quickExamCancel">Cancelar</button>
            <button type="submit" class="btn-primary" id="quickExamSubmit" style="--brand-color:#1e293b" disabled>Guardar examen</button>
          </div>
        </form>
      </div>

      <div class="section-head"><h2>Tus marcas</h2><p>Organigramas y resultados de ascensos.</p></div>
      <div class="brand-grid">${cards}</div>

      <div class="section-head section-head-spaced"><h2>Últimos exámenes cargados</h2></div>
      <div class="recent-exams-panel">${recentExamsHtml()}</div>
    `;

    appEl.querySelectorAll("[data-brand]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.location.hash = `#/organigrama/${btn.dataset.brand}`;
      });
    });

    wireQuickExamForm();
  }

  // Formulario de "Cargar examen" de la home: selects en cascada
  // (marca -> regional -> zonal -> local) + los mismos campos de siempre.
  function wireQuickExamForm() {
    const toggleBtn = document.getElementById("quickExamToggle");
    const formEl = document.getElementById("quickExamForm");
    const cancelBtn = document.getElementById("quickExamCancel");
    const submitBtn = document.getElementById("quickExamSubmit");
    const brandSelect = document.getElementById("qBrand");
    const regionalSelect = document.getElementById("qRegional");
    const zonalSelect = document.getElementById("qZonal");
    const localSelect = document.getElementById("qLocal");

    wireAsistioToggle(formEl);

    function resetSelect(select, placeholder) {
      select.innerHTML = `<option value="">${placeholder}</option>`;
      select.disabled = true;
    }

    function updateSubmitState() {
      submitBtn.disabled = !(brandSelect.value && regionalSelect.value && zonalSelect.value && localSelect.value);
    }

    brandSelect.addEventListener("change", () => {
      resetSelect(regionalSelect, "Primero elegí una marca");
      resetSelect(zonalSelect, "Primero elegí un regional");
      resetSelect(localSelect, "Primero elegí una zonal");
      updateSubmitState();
      const brand = getBrand(brandSelect.value);
      if (!brand) return;
      const org = OrgOverrides.effectiveOrg(brand);
      regionalSelect.innerHTML =
        `<option value="">Elegí un regional</option>` +
        org.regionales.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
      regionalSelect.disabled = false;
    });

    regionalSelect.addEventListener("change", () => {
      resetSelect(zonalSelect, "Primero elegí un regional");
      resetSelect(localSelect, "Primero elegí una zonal");
      updateSubmitState();
      const brand = getBrand(brandSelect.value);
      const org = brand && OrgOverrides.effectiveOrg(brand);
      const regional = org && getRegional(org, regionalSelect.value);
      if (!regional) return;
      zonalSelect.innerHTML =
        `<option value="">Elegí una zonal</option>` +
        regional.zonales.map((z) => `<option value="${z.id}">${escapeHtml(z.name)}</option>`).join("");
      zonalSelect.disabled = false;
    });

    zonalSelect.addEventListener("change", () => {
      resetSelect(localSelect, "Primero elegí una zonal");
      updateSubmitState();
      const brand = getBrand(brandSelect.value);
      const org = brand && OrgOverrides.effectiveOrg(brand);
      const regional = org && getRegional(org, regionalSelect.value);
      const zonal = regional && getZonal(regional, zonalSelect.value);
      if (!zonal) return;
      localSelect.innerHTML =
        `<option value="">Elegí un local</option>` +
        zonal.locales.map((local) => `<option value="${escapeHtml(local)}">${escapeHtml(local)}</option>`).join("");
      localSelect.disabled = false;
    });

    localSelect.addEventListener("change", updateSubmitState);

    toggleBtn.addEventListener("click", () => {
      formEl.hidden = !formEl.hidden;
      if (!formEl.hidden) brandSelect.focus();
    });
    cancelBtn.addEventListener("click", () => {
      formEl.reset();
      resetSelect(regionalSelect, "Primero elegí una marca");
      resetSelect(zonalSelect, "Primero elegí un regional");
      resetSelect(localSelect, "Primero elegí una zonal");
      updateSubmitState();
      formEl.hidden = true;
    });

    formEl.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = "Guardando…";
      try {
        await ExamStore.add(
          examRecordFromForm(formEl, {
            brandId: brandSelect.value,
            regionalId: regionalSelect.value,
            zonalId: zonalSelect.value,
            localName: localSelect.value,
          })
        );
        updateSyncPill();
        route();
      } catch (err) {
        updateSyncPill();
        alert(`No se pudo guardar el examen: ${err.message}. Probá de nuevo en un momento.`);
        submitBtn.disabled = false;
        submitBtn.textContent = "Guardar examen";
      }
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

    const org = OrgOverrides.effectiveOrg(brand);

    const regionalCards = org.regionales
      .map((regional) => {
        const zonalesCount = regional.zonales.length;
        const localesCount = regional.zonales.reduce((n, z) => n + z.locales.length, 0);
        const stats = ExamStore.statsForLocalNames(brand.id, localNamesForRegional(regional));
        return personCard(regional, brand.id, {
          tag: "button",
          extraClass: "org-card-link",
          brandColor: brand.color,
          meta: [`${zonalesCount} zonales · ${localesCount} locales`, statsMetaLine(stats)],
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
        <button class="btn-ghost" id="moverBtn">${icon("move", { size: 14 })} Mover zonales / locales</button>
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
    document.getElementById("moverBtn").addEventListener("click", () => {
      window.location.hash = `#/organigrama/${brand.id}/mover`;
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
    const org = brand ? OrgOverrides.effectiveOrg(brand) : null;
    const regional = org ? getRegional(org, regionalId) : null;

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
            const count = ExamStore.countForLocal(brand.id, local);
            const badge = count > 0 ? `<span class="local-badge">${count}</span>` : "";
            return `<li><button class="local-link" data-zonal="${zonal.id}" data-local="${slugify(local)}">${icon("building", { size: 13 })} ${escapeHtml(local)}${badge}</button></li>`;
          })
          .join("");
        const zonalStats = ExamStore.statsForLocalNames(brand.id, zonal.locales);
        return personCard(zonal, brand.id, {
          extraClass: "org-zonal-card",
          brandColor: brand.color,
          size: 68,
          meta: statsMetaLine(zonalStats),
          extra: `<ul class="org-locales-inline">${locales}</ul>`,
        });
      })
      .join("");

    const regionalStats = ExamStore.statsForLocalNames(brand.id, localNamesForRegional(regional));

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

      ${statsRowHtml(regionalStats)}

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
    const org = brand ? OrgOverrides.effectiveOrg(brand) : null;
    const regional = org ? getRegional(org, regionalId) : null;
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

    const exams = ExamStore.forLocal(brand.id, localName);
    const localStats = ExamStore.computeStats(exams);

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
            <td class="col-actions">${rowActionsHtml(e)}</td>
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

      ${statsRowHtml(localStats)}

      <form id="examForm" class="exam-form" hidden>
        <div class="exam-form-grid">
          ${examFieldsHtml(today)}
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
    wireAsistioToggle(formEl);

    toggleBtn.addEventListener("click", () => {
      formEl.hidden = !formEl.hidden;
      if (!formEl.hidden) formEl.querySelector('[name="nombre"]').focus();
    });
    cancelBtn.addEventListener("click", () => {
      formEl.reset();
      formEl.hidden = true;
    });

    formEl.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const submitBtn = formEl.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "Guardando…";
      try {
        await ExamStore.add(
          examRecordFromForm(formEl, { brandId: brand.id, regionalId: regional.id, zonalId: zonal.id, localName })
        );
        updateSyncPill();
        route();
      } catch (err) {
        updateSyncPill();
        alert(`No se pudo guardar el examen: ${err.message}. Probá de nuevo en un momento.`);
        submitBtn.disabled = false;
        submitBtn.textContent = "Guardar examen";
      }
    });

    wireRowActions(appEl);
  }

  // ---------- Acciones por examen (corregir / borrar) ----------
  // Los del examen online piden la clave de Capacitación (ver exams.js).
  function rowActionsHtml(e) {
    return `
      <button class="row-edit" data-id="${escapeHtml(e.id)}" title="Corregir examen">${icon("edit", { size: 15 })}</button>
      <button class="row-delete" data-id="${escapeHtml(e.id)}" title="Eliminar examen">${icon("trash", { size: 15 })}</button>`;
  }

  function wireRowActions(root) {
    root.querySelectorAll(".row-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("¿Eliminar este examen? No se puede deshacer.")) return;
        btn.disabled = true;
        try {
          await ExamStore.remove(btn.dataset.id);
          updateSyncPill();
          route();
        } catch (err) {
          alert(`No se pudo eliminar: ${err.message}.`);
          btn.disabled = false;
        }
      });
    });
    root.querySelectorAll(".row-edit").forEach((btn) => {
      btn.addEventListener("click", () => openEditDialog(btn.dataset.id));
    });
  }

  // Diálogo para corregir un examen (planilla u online).
  function openEditDialog(id) {
    const exam = ExamStore.all().find((e) => e.id === id);
    if (!exam) return;
    const online = exam.origen === "online";
    const brand = getBrand(exam.brandId);
    const locales = brand ? OrgOverrides.effectiveOrg(brand).regionales.flatMap((r) => r.zonales.flatMap((z) => z.locales)) : [];
    if (exam.localName && !locales.includes(exam.localName)) locales.push(exam.localName);

    const dlg = document.createElement("dialog");
    dlg.className = "edit-dialog";
    dlg.innerHTML = `
      <form method="dialog" class="exam-form">
        <h3>Corregir examen${online ? " online" : ""}</h3>
        <div class="exam-form-grid">
          <label>Nombre <input type="text" name="nombre" required></label>
          <label>Apellido <input type="text" name="apellido"></label>
          <label>Local
            <select name="localName">${locales.sort((a, b) => a.localeCompare(b, "es")).map((l) => `<option>${escapeHtml(l)}</option>`).join("")}</select>
          </label>
          ${online
            ? `<label>Nivel
                 <select name="puestoPostula">${Object.values(NIVELES_ONLINE).map((n) => `<option>${n}</option>`).join("")}</select>
               </label>`
            : `<label>Puesto actual <input type="text" name="puestoActual"></label>
               <label>Puesto al que postula <input type="text" name="puestoPostula"></label>
               <label>Fecha del examen <input type="date" name="fecha"></label>
               <label>¿Asistió?
                 <select name="asistio"><option value="si">Sí</option><option value="no">No</option></select>
               </label>`}
          <label>Puntaje (0-100) <input type="number" name="puntaje" min="0" max="100" step="1"></label>
          <label>Resultado
            <select name="resultado">
              ${online ? "" : `<option value="pendiente">Pendiente de revisión</option>`}
              <option value="aprobado">Aprobado</option>
              <option value="desaprobado">Desaprobado</option>
              ${online ? "" : `<option value="no-asistio">No asistió</option>`}
            </select>
          </label>
          ${online ? "" : `<label class="exam-form-full">Observaciones <textarea name="observaciones" rows="2"></textarea></label>`}
        </div>
        ${online ? `<p class="exam-form-hint">Se pide la clave de Capacitación. Si pasás un examen online a Aprobado, la persona queda habilitada para rendir el nivel siguiente.</p>` : ""}
        <div class="exam-form-actions">
          <button type="button" class="btn-ghost" data-cancel>Cancelar</button>
          <button type="submit" class="btn-primary" style="--brand-color:${brand ? brand.color : "#1e293b"}">Guardar cambios</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector("form");
    const set = (name, value) => { const el = form.elements[name]; if (el && value !== undefined && value !== null) el.value = value; };
    set("nombre", exam.nombre); set("apellido", exam.apellido); set("localName", exam.localName);
    set("puestoActual", exam.puestoActual); set("puestoPostula", exam.puestoPostula); set("fecha", exam.fecha);
    set("asistio", exam.asistio ? "si" : "no"); set("puntaje", exam.puntaje); set("resultado", exam.resultado);
    set("observaciones", exam.observaciones);

    dlg.querySelector("[data-cancel]").addEventListener("click", () => dlg.close());
    dlg.addEventListener("close", () => dlg.remove());
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const data = new FormData(form);
      const puntajeRaw = data.get("puntaje");
      const changes = {
        nombre: String(data.get("nombre") || "").trim(),
        apellido: String(data.get("apellido") || "").trim(),
        localName: data.get("localName"),
        puestoPostula: String(data.get("puestoPostula") || "").trim(),
        puntaje: puntajeRaw === "" || puntajeRaw === null ? null : Number(puntajeRaw),
        resultado: data.get("resultado"),
      };
      if (!online) {
        Object.assign(changes, {
          puestoActual: String(data.get("puestoActual") || "").trim(),
          fecha: data.get("fecha"),
          asistio: data.get("asistio") === "si",
          observaciones: String(data.get("observaciones") || "").trim(),
        });
      }
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Guardando…";
      try {
        await ExamStore.update(id, changes);
        dlg.close();
        route();
      } catch (err) {
        alert(`No se pudo guardar: ${err.message}.`);
        btn.disabled = false;
        btn.textContent = "Guardar cambios";
      }
    });
    dlg.showModal();
  }

  // ---------- Acceso al panel del examen online ----------
  function renderAuthBar() {
    const actual = window.location.hash;
    authBarEl.innerHTML =
      `<a class="auth-link${actual === "#/citaciones" ? " active" : ""}" href="#/citaciones">Citaciones</a>` +
      `<a class="auth-link${actual === "#/examen-online" ? " active" : ""}" href="#/examen-online">Examen online</a>` +
      `<span class="user-chip" title="Capacitación">CA</span>`;
  }

  // ---------- Panel del examen online (Capacitación) ----------
  const panelFiltro = { marca: "", nivel: "", bancoMarca: "sabores", bancoNivel: "entrenador" };

  function motivoTipo(m) {
    return String(m || "").split(":")[0];
  }

  function renderOnlinePanel() {
    navCrumbEl.innerHTML = crumbs([{ label: "Campus" }, { hash: "#/", label: "Ascensos" }, { label: "Examen online" }]);
    brandPillEl.innerHTML = "";

    const todos = ExamStore.all().filter((e) => e.origen === "online");
    const lista = todos.filter((e) =>
      (!panelFiltro.marca || e.brandId === panelFiltro.marca) && (!panelFiltro.nivel || e.nivel === panelFiltro.nivel));
    const cuenta = (fn) => lista.filter(fn).length;
    const aprob = cuenta((e) => e.resultado === "aprobado");
    const kpis = [
      ["Intentos", lista.length],
      ["Aprobados", aprob],
      ["Desaprobados", lista.length - aprob],
      ["Salieron de la pestaña", cuenta((e) => motivoTipo(e.motivoCierre) === "salida")],
      ["Sin tiempo", cuenta((e) => motivoTipo(e.motivoCierre) === "tiempo")],
      ["Cerraron la página", cuenta((e) => motivoTipo(e.motivoCierre) === "abandono")],
      ["No asistieron", cuenta((e) => motivoTipo(e.motivoCierre) === "ausente")],
    ];

    const porNivel = Object.entries(NIVELES_ONLINE).map(([id, nombre]) => {
      const x = lista.filter((e) => e.nivel === id);
      const a = x.filter((e) => e.resultado === "aprobado").length;
      const prom = x.length ? Math.round(x.reduce((s, e) => s + (e.puntaje || 0), 0) / x.length) : null;
      return `<tr><td>${nombre}</td><td class="num">${x.length}</td><td class="num">${a}</td><td class="num">${x.length - a}</td>
        <td class="num">${x.length ? Math.round((a / x.length) * 100) + "%" : "—"}</td><td class="num">${prom === null ? "—" : prom + "%"}</td></tr>`;
    }).join("");

    // Errores por pregunta (sobre las preguntas respondidas de cada intento).
    const porPregunta = {};
    lista.forEach((e) => (e.detalle || []).forEach((p) => {
      if (p.resultado === "S/D") return;
      const k = `${e.brandId}:${e.nivel}:${p.id}`;
      const q = porPregunta[k] || (porPregunta[k] = { texto: p.pregunta, marca: e.brandId, nivel: e.nivel, id: p.id, total: 0, errores: 0 });
      q.total++;
      if (p.resultado !== "correcta") q.errores++;
    }));
    const top = Object.values(porPregunta).filter((q) => q.errores)
      .sort((a, b) => b.errores / b.total - a.errores / a.total || b.total - a.total).slice(0, 10);
    const barras = top.length
      ? top.map((q) => {
          const pct = Math.round((q.errores / q.total) * 100);
          return `<div class="err-bar" title="${escapeHtml(`${q.errores} de ${q.total} con error`)}">
              <span class="err-text">${escapeHtml(q.texto)}</span>
              <span class="err-meta">${escapeHtml((getBrand(q.marca) || {}).name || q.marca)} · ${NIVELES_ONLINE[q.nivel] || q.nivel} · ${q.errores} de ${q.total}</span>
              <span class="err-track"><span class="err-fill" style="width:${pct}%"></span></span>
              <span class="err-pct">${pct}%</span>
            </div>`;
        }).join("")
      : `<p class="empty-table">Todavía no hay errores registrados.</p>`;

    const intentos = lista.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const filas = intentos.length
      ? intentos.map((e) => `
          <tr>
            <td>${escapeHtml(e.fecha)}</td>
            <td>${escapeHtml((getBrand(e.brandId) || {}).name || e.brandId)}</td>
            <td>${escapeHtml(e.localName)}</td>
            <td>${escapeHtml(e.nombre)} ${escapeHtml(e.apellido)}</td>
            <td>${escapeHtml(e.puestoPostula)}</td>
            <td class="num">${e.puntaje === null ? "—" : e.puntaje + "%"}</td>
            <td><span class="resultado-badge resultado-${e.resultado}">${RESULTADOS[e.resultado] || e.resultado}</span></td>
            <td>${escapeHtml({ entregado: "Entregado", tiempo: "Sin tiempo", salida: "Salió de la pestaña", abandono: "Cerró la página", ausente: "No asistió" }[motivoTipo(e.motivoCierre)] || "—")}</td>
            <td class="col-actions">${rowActionsHtml(e)}</td>
          </tr>`).join("")
      : `<tr><td colspan="9" class="empty-table">Todavía no hay exámenes online.</td></tr>`;

    const opt = (value, label, sel) => `<option value="${value}"${value === sel ? " selected" : ""}>${escapeHtml(label)}</option>`;
    const marcaOpts = ASCENSOS_DATA.brands.map((b) => opt(b.id, b.name, panelFiltro.marca)).join("");
    const nivelOpts = Object.entries(NIVELES_ONLINE).map(([id, n]) => opt(id, n, panelFiltro.nivel)).join("");

    appEl.innerHTML = `
      <div class="org-header">
        <div>
          <h2>Examen online</h2>
          <p class="panel-sub">Resultados de <a href="${EXAMEN_URL}" target="_blank" rel="noopener noreferrer">${EXAMEN_URL.replace("https://", "").replace(/\/$/, "")}</a></p>
        </div>
        <div class="panel-filtros">
          <select id="pfMarca">${opt("", "Todas las marcas", panelFiltro.marca)}${marcaOpts}</select>
          <select id="pfNivel">${opt("", "Todos los niveles", panelFiltro.nivel)}${nivelOpts}</select>
        </div>
      </div>

      <div class="kpi-grid">${kpis.map(([l, v]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("")}</div>

      <div class="panel-grid">
        <section class="panel-card">
          <h3>Resultados por nivel</h3>
          <div class="table-scroll"><table class="exam-table">
            <thead><tr><th>Nivel</th><th class="num">Intentos</th><th class="num">Aprob.</th><th class="num">Desaprob.</th><th class="num">% aprob.</th><th class="num">Promedio</th></tr></thead>
            <tbody>${porNivel}</tbody>
          </table></div>
        </section>
        <section class="panel-card">
          <h3>Preguntas con más errores</h3>
          <div class="err-list">${barras}</div>
        </section>
      </div>

      <section class="panel-card">
        <h3>Todos los intentos</h3>
        <div class="table-scroll"><table class="exam-table">
          <thead><tr><th>Fecha</th><th>Marca</th><th>Local</th><th>Nombre y apellido</th><th>Nivel</th><th class="num">%</th><th>Resultado</th><th>Cierre</th><th></th></tr></thead>
          <tbody>${filas}</tbody>
        </table></div>
      </section>

      <section class="panel-card">
        <div class="banco-head">
          <h3>Preguntas de los exámenes</h3>
          <div class="panel-filtros">
            <select id="bMarca">${ASCENSOS_DATA.brands.map((b) => opt(b.id, b.name, panelFiltro.bancoMarca)).join("")}</select>
            <select id="bNivel">${Object.entries(NIVELES_ONLINE).map(([id, n]) => opt(id, n, panelFiltro.bancoNivel)).join("")}</select>
          </div>
        </div>
        <div id="bancoLista" class="banco-lista"><p class="empty-table">Cargando preguntas…</p></div>
      </section>
    `;

    const refiltrar = () => {
      panelFiltro.marca = document.getElementById("pfMarca").value;
      panelFiltro.nivel = document.getElementById("pfNivel").value;
      renderOnlinePanel();
    };
    document.getElementById("pfMarca").addEventListener("change", refiltrar);
    document.getElementById("pfNivel").addEventListener("change", refiltrar);
    ["bMarca", "bNivel"].forEach((idSel) => document.getElementById(idSel).addEventListener("change", () => {
      panelFiltro.bancoMarca = document.getElementById("bMarca").value;
      panelFiltro.bancoNivel = document.getElementById("bNivel").value;
      pintarBanco(porPregunta);
    }));
    wireRowActions(appEl);
    pintarBanco(porPregunta);
  }

  // Lista de preguntas de una marca/nivel con la respuesta correcta y su % de error.
  function pintarBanco(porPregunta) {
    const cont = document.getElementById("bancoLista");
    if (!ExamStore.tieneClave() && !pintarBanco.pedida) {
      cont.innerHTML = `<button class="btn-primary" id="verBanco" style="--brand-color:#4a52b8">${icon("lock", { size: 13 })} Ver preguntas (pide la clave de Capacitación)</button>`;
      document.getElementById("verBanco").addEventListener("click", () => { pintarBanco.pedida = true; pintarBanco(porPregunta); });
      return;
    }
    cont.innerHTML = `<p class="empty-table">Cargando preguntas…</p>`;
    ExamStore.bancoPreguntas().then((bancos) => {
      if (!document.body.contains(cont)) return;
      const preguntas = ((bancos[panelFiltro.bancoMarca] || {})[panelFiltro.bancoNivel]) || [];
      if (!preguntas.length) {
        cont.innerHTML = `<p class="empty-table">Todavía no hay preguntas cargadas para este nivel.</p>`;
        return;
      }
      cont.innerHTML = preguntas.map((p, i) => {
        const stat = porPregunta[`${panelFiltro.bancoMarca}:${panelFiltro.bancoNivel}:${p.id}`];
        const err = stat ? `<span class="banco-err">${Math.round((stat.errores / stat.total) * 100)}% de error (${stat.total} resp.)</span>` : "";
        const cuerpo = p.tipo === "grilla"
          ? p.filas.map((f, j) => `<li class="ok">${escapeHtml(f)} → ${escapeHtml(p.columnas[p.correcta[j]])}</li>`).join("")
          : p.opciones.map((o, j) => `<li class="${j === p.correcta ? "ok" : ""}">${escapeHtml(o)}</li>`).join("");
        return `<div class="banco-item"><p><b>${i + 1}.</b> ${escapeHtml(p.texto)} ${err}</p><ul>${cuerpo}</ul></div>`;
      }).join("");
    }).catch((e) => {
      if (document.body.contains(cont)) cont.innerHTML = `<p class="empty-table">${escapeHtml(e.message)}.</p>`;
    });
  }

  // ---------- Citaciones a examen (Capacitación) ----------
  // Se cita a una persona para un día; si a las 20 hs no hizo ningún examen
  // online ese día, Supabase la marca ausente y genera un Desaprobado.
  const ESTADOS_CITA = { citado: "Pendiente", presente: "Presente", ausente: "No asistió" };
  const ESTADO_BADGE = { citado: "pendiente", presente: "aprobado", ausente: "desaprobado" };
  function isoDia(offset) {
    return new Date(Date.now() + (offset || 0) * 864e5).toLocaleDateString("en-CA");
  }
  const citas = { filas: null, error: null, cargando: false, desde: isoDia(-30), hasta: isoDia(30), marca: "", estado: "", pedida: false };

  function localesDeMarca(brandId) {
    const brand = getBrand(brandId);
    if (!brand) return [];
    const org = OrgOverrides.effectiveOrg(brand);
    return org.regionales.reduce((acc, r) => acc.concat(localNamesForRegional(r)), [])
      .sort((a, b) => a.localeCompare(b, "es"));
  }

  async function cargarCitaciones() {
    citas.cargando = true;
    try {
      citas.filas = await ExamStore.citaciones(citas.desde, citas.hasta);
      citas.error = null;
    } catch (e) {
      citas.error = e.message;
    }
    citas.cargando = false;
    if (window.location.hash === "#/citaciones") renderCitaciones();
  }

  // Acepta filas pegadas de Excel/Sheets (tab, ; o ,): DNI, Nivel, Nombre, Apellido, Local.
  function leerPegado(texto) {
    return texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      .map((l) => l.split(/\t|;|,/).map((c) => c.trim()))
      .filter((c) => /\d/.test(c[0] || ""))
      .map(([dni, nivel, nombre, apellido, local]) => ({ dni, nivel, nombre, apellido, local }));
  }

  function renderCitaciones() {
    navCrumbEl.innerHTML = crumbs([{ label: "Campus" }, { hash: "#/", label: "Ascensos" }, { label: "Citaciones" }]);
    brandPillEl.innerHTML = "";

    const opt = (value, label, sel) => `<option value="${value}"${value === sel ? " selected" : ""}>${escapeHtml(label)}</option>`;
    const marcaOpts = (sel) => ASCENSOS_DATA.brands.map((b) => opt(b.id, b.name, sel)).join("");
    const nivelOpts = Object.entries(NIVELES_ONLINE).map(([id, n]) => opt(id, n, "")).join("");

    const filas = (citas.filas || []).filter((c) =>
      (!citas.marca || c.marca === citas.marca) && (!citas.estado || c.estado === citas.estado));
    const n = (e) => filas.filter((c) => c.estado === e).length;
    const cerradas = n("presente") + n("ausente");
    const kpis = [
      ["Citados", filas.length],
      ["Presentes", n("presente")],
      ["No asistieron", n("ausente")],
      ["Pendientes", n("citado")],
      ["% ausentismo", cerradas ? Math.round((n("ausente") / cerradas) * 100) + "%" : "—"],
    ];

    let cuerpo;
    if (!citas.filas && !ExamStore.tieneClave() && !citas.pedida) {
      cuerpo = `<tr><td colspan="9" class="empty-table"><button class="btn-primary" id="verCitas" style="--brand-color:#4a52b8">${icon("lock", { size: 13 })} Ver citaciones (pide la clave de Capacitación)</button></td></tr>`;
    } else if (!citas.filas && citas.error) {
      cuerpo = `<tr><td colspan="9" class="empty-table">${escapeHtml(`No se pudo cargar: ${citas.error}.`)} <button class="btn-ghost" id="verCitas">Reintentar</button></td></tr>`;
    } else if (!citas.filas) {
      cuerpo = `<tr><td colspan="9" class="empty-table">Cargando citaciones…</td></tr>`;
    } else if (!filas.length) {
      cuerpo = `<tr><td colspan="9" class="empty-table">No hay citaciones en este período.</td></tr>`;
    } else {
      cuerpo = filas.map((c) => `
        <tr>
          <td>${escapeHtml(c.fecha.split("-").reverse().join("/"))}</td>
          <td>${escapeHtml((getBrand(c.marca) || {}).name || c.marca)}</td>
          <td>${escapeHtml(c.local || "")}</td>
          <td>${escapeHtml([c.nombre, c.apellido].filter(Boolean).join(" "))}</td>
          <td>${escapeHtml(c.dni)}</td>
          <td>${escapeHtml(NIVELES_ONLINE[c.nivel] || c.nivel)}</td>
          <td><span class="resultado-badge resultado-${ESTADO_BADGE[c.estado]}">${ESTADOS_CITA[c.estado]}</span></td>
          <td>${c.condicion ? escapeHtml(`${c.condicion} (${c.porcentaje}%)`) : "—"}</td>
          <td class="col-actions">${c.estado === "citado" ? `<button class="row-delete cita-quitar" data-id="${c.id}" title="Quitar citación">${icon("trash", { size: 15 })}</button>` : ""}</td>
        </tr>`).join("");
    }

    appEl.innerHTML = `
      <div class="org-header">
        <div>
          <h2>Citaciones a examen</h2>
          <p class="panel-sub">Si a las 20 hs del día citado la persona no hizo ningún examen, queda como <b>No asistió</b> y se registra un <b>Desaprobado</b>.</p>
        </div>
      </div>

      <section class="panel-card">
        <h3>Citar</h3>
        <form id="citaForm" class="exam-form cita-form">
          <div class="exam-form-grid">
            <label>Marca<select name="marca" id="cMarca" required>${marcaOpts(citas.marca || ASCENSOS_DATA.brands[0].id)}</select></label>
            <label>Fecha del examen<input type="date" name="fecha" value="${isoDia(1)}" required></label>
            <label>DNI<input type="text" name="dni" inputmode="numeric" maxlength="8" pattern="\\d{7,8}" required></label>
            <label>Nivel<select name="nivel" required>${nivelOpts}</select></label>
            <label>Nombre<input type="text" name="nombre" required></label>
            <label>Apellido<input type="text" name="apellido" required></label>
            <label>Local<select name="local" id="cLocal" required></select></label>
          </div>
          <details class="cita-pegar">
            <summary>Citar varios a la vez (pegar desde Excel)</summary>
            <textarea name="lista" rows="5" placeholder="Una persona por fila: DNI · Nivel · Nombre · Apellido · Local&#10;30111222	Entrenador	Ana	Pérez	Boedo"></textarea>
            <p class="exam-form-hint">Si pegás una lista, se usan la marca y la fecha de arriba y se ignoran los demás campos.</p>
          </details>
          <div class="exam-form-actions">
            <span class="cita-msg" id="citaMsg"></span>
            <button type="submit" class="btn-primary" style="--brand-color:#1e293b">${icon("plus", { size: 14 })} Citar</button>
          </div>
        </form>
      </section>

      <div class="kpi-grid kpi-grid-5">${kpis.map(([l, v]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("")}</div>

      <section class="panel-card">
        <div class="banco-head">
          <h3>Citados</h3>
          <div class="panel-filtros">
            <input type="date" id="fDesde" value="${citas.desde}" title="Desde">
            <input type="date" id="fHasta" value="${citas.hasta}" title="Hasta">
            <select id="fMarca">${opt("", "Todas las marcas", citas.marca)}${marcaOpts(citas.marca)}</select>
            <select id="fEstado">${opt("", "Todos los estados", citas.estado)}${Object.entries(ESTADOS_CITA).map(([id, l]) => opt(id, l, citas.estado)).join("")}</select>
            <button type="button" class="btn-ghost" id="citasCsv">Descargar CSV</button>
          </div>
        </div>
        <div class="table-scroll"><table class="exam-table">
          <thead><tr><th>Fecha</th><th>Marca</th><th>Local</th><th>Nombre y apellido</th><th>DNI</th><th>Nivel</th><th>Asistencia</th><th>Resultado</th><th></th></tr></thead>
          <tbody>${cuerpo}</tbody>
        </table></div>
      </section>
    `;

    const form = document.getElementById("citaForm");
    const pintarLocalesCita = () => {
      document.getElementById("cLocal").innerHTML = `<option value="">Elegí el local</option>` +
        localesDeMarca(document.getElementById("cMarca").value).map((l) => opt(l, l, "")).join("");
    };
    document.getElementById("cMarca").addEventListener("change", pintarLocalesCita);
    pintarLocalesCita();

    // Con una lista pegada, los campos de una sola persona dejan de ser obligatorios.
    const lista = form.elements.lista;
    lista.addEventListener("input", () => {
      const hayLista = !!lista.value.trim();
      ["dni", "nivel", "nombre", "apellido", "local"].forEach((k) => { form.elements[k].required = !hayLista; });
    });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const msg = document.getElementById("citaMsg");
      const d = new FormData(form);
      const personas = lista.value.trim()
        ? leerPegado(lista.value)
        : [{ dni: d.get("dni"), nivel: d.get("nivel"), nombre: d.get("nombre"), apellido: d.get("apellido"), local: d.get("local") }];
      if (!personas.length) { msg.textContent = "No se encontró ninguna fila con DNI."; return; }
      const btn = form.querySelector("[type=submit]");
      btn.disabled = true;
      msg.textContent = "Guardando…";
      try {
        const r = await ExamStore.citar(d.get("marca"), d.get("fecha"), personas);
        const rech = r.rechazados || [];
        await cargarCitaciones();
        const m = document.getElementById("citaMsg");
        if (m) m.textContent = `${r.cargados} citado(s).` + (rech.length ? ` Rechazados (DNI o nivel inválido): ${rech.map((p) => p.dni || "?").join(", ")}.` : "");
      } catch (e) {
        msg.textContent = `No se pudo citar: ${e.message}.`;
        btn.disabled = false;
      }
    });

    const verBtn = document.getElementById("verCitas");
    if (verBtn) verBtn.addEventListener("click", () => { citas.pedida = true; cargarCitaciones(); renderCitaciones(); });

    ["fDesde", "fHasta"].forEach((idSel) => document.getElementById(idSel).addEventListener("change", () => {
      citas.desde = document.getElementById("fDesde").value;
      citas.hasta = document.getElementById("fHasta").value;
      citas.filas = null;
      cargarCitaciones();
      renderCitaciones();
    }));
    ["fMarca", "fEstado"].forEach((idSel) => document.getElementById(idSel).addEventListener("change", () => {
      citas.marca = document.getElementById("fMarca").value;
      citas.estado = document.getElementById("fEstado").value;
      renderCitaciones();
    }));

    appEl.querySelectorAll(".cita-quitar").forEach((btn) => btn.addEventListener("click", async () => {
      if (!confirm("¿Quitar esta citación?")) return;
      btn.disabled = true;
      try {
        await ExamStore.borrarCitacion(Number(btn.dataset.id));
        await cargarCitaciones();
      } catch (e) {
        alert(`No se pudo quitar: ${e.message}.`);
        btn.disabled = false;
      }
    }));

    document.getElementById("citasCsv").addEventListener("click", () => {
      const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
      const csv = [["fecha", "marca", "local", "nombre", "apellido", "dni", "nivel", "asistencia", "resultado", "porcentaje"].join(";")]
        .concat(filas.map((c) => [c.fecha, (getBrand(c.marca) || {}).name || c.marca, c.local, c.nombre, c.apellido, c.dni,
          NIVELES_ONLINE[c.nivel] || c.nivel, ESTADOS_CITA[c.estado], c.condicion, c.porcentaje].map(esc).join(";")))
        .join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
      a.download = `citaciones_${isoDia()}.csv`;
      a.click();
    });

    // Primera visita con clave guardada: trae el listado.
    if (!citas.filas && !citas.cargando && !citas.error && (ExamStore.tieneClave() || citas.pedida)) cargarCitaciones();
  }

  // ---------- Formulario de examen: piezas reutilizables ----------
  // Los campos del examen en sí (sin los selects de a dónde pertenece):
  // se usan tanto en la vista de un local como en el "Cargar examen"
  // rápido de la home.
  function examFieldsHtml(today) {
    return `
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
        <select name="asistio" class="asistio-select">
          <option value="si">Sí</option>
          <option value="no">No</option>
        </select>
      </label>
      <label class="puntaje-field">Puntaje (0-100)
        <input type="number" name="puntaje" min="0" max="100" step="1">
      </label>
      <label class="resultado-field">Resultado
        <select name="resultado">
          <option value="pendiente">Pendiente de revisión</option>
          <option value="aprobado">Aprobado</option>
          <option value="desaprobado">Desaprobado</option>
        </select>
      </label>
      <label class="exam-form-full">Observaciones
        <textarea name="observaciones" rows="2" placeholder="Opcional"></textarea>
      </label>`;
  }

  // Muestra/oculta puntaje y resultado según si asistió, dentro de un form dado.
  function wireAsistioToggle(formEl) {
    const asistioSelect = formEl.querySelector(".asistio-select");
    const puntajeField = formEl.querySelector(".puntaje-field");
    const resultadoField = formEl.querySelector(".resultado-field");
    function sync() {
      const asistio = asistioSelect.value === "si";
      puntajeField.style.display = asistio ? "" : "none";
      resultadoField.style.display = asistio ? "" : "none";
    }
    asistioSelect.addEventListener("change", sync);
    sync();
  }

  // Arma el registro a guardar a partir del FormData de un form de examen
  // + a qué local pertenece (ctx).
  function examRecordFromForm(formEl, ctx) {
    const data = new FormData(formEl);
    const asistio = data.get("asistio") === "si";
    const puntajeRaw = data.get("puntaje");
    return {
      brandId: ctx.brandId,
      regionalId: ctx.regionalId,
      zonalId: ctx.zonalId,
      localName: ctx.localName,
      nombre: String(data.get("nombre") || "").trim(),
      apellido: String(data.get("apellido") || "").trim(),
      puestoActual: String(data.get("puestoActual") || "").trim(),
      puestoPostula: String(data.get("puestoPostula") || "").trim(),
      fecha: data.get("fecha"),
      asistio,
      puntaje: asistio && puntajeRaw !== "" ? Number(puntajeRaw) : null,
      resultado: asistio ? data.get("resultado") : "no-asistio",
      observaciones: String(data.get("observaciones") || "").trim(),
    };
  }

  // ---------- Mover zonales / locales ----------
  function renderMover(brandId) {
    const brand = getBrand(brandId);

    if (!brand) {
      navCrumbEl.innerHTML = crumbs([{ label: "Campus" }, { hash: "#/", label: "Ascensos" }]);
      appEl.innerHTML = `<div class="empty-state">No encontramos esa marca.<br><a href="#/">Volver</a></div>`;
      return;
    }

    navCrumbEl.innerHTML = crumbs([
      { label: "Campus" },
      { hash: "#/", label: "Ascensos" },
      { hash: `#/organigrama/${brand.id}`, label: brand.name },
      { label: "Mover zonales / locales" },
    ]);
    brandPillEl.innerHTML = `${brandLogo(brand, 26)} ${escapeHtml(brand.name)}`;
    brandPillEl.style.setProperty("--brand-color", brand.color);

    const org = OrgOverrides.effectiveOrg(brand);
    const allZonales = [];
    org.regionales.forEach((r) => r.zonales.forEach((z) => allZonales.push({ zonal: z, regional: r })));
    const allLocals = [];
    allZonales.forEach(({ zonal }) => zonal.locales.forEach((local) => allLocals.push({ local, zonal })));

    const zonalOptions = allZonales
      .map(({ zonal, regional }) => `<option value="${zonal.id}">${escapeHtml(zonal.name)} (hoy en ${escapeHtml(regional.name)})</option>`)
      .join("");
    const newRegionalOptions = brand.organigrama.regionales
      .map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`)
      .join("");
    const localOptions = allLocals
      .map(({ local, zonal }) => `<option value="${slugify(local)}">${escapeHtml(local)} (hoy en ${escapeHtml(zonal.name)})</option>`)
      .join("");
    const zonalTargetOptions = allZonales
      .map(({ zonal, regional }) => `<option value="${zonal.id}">${escapeHtml(zonal.name)} — ${escapeHtml(regional.name)}</option>`)
      .join("");

    const moves = OrgOverrides.listMoves(brand);
    const movesHtml = moves.length
      ? moves
          .map(
            (m) =>
              `<li>${escapeHtml(m.label)} <button class="undo-move" data-type="${m.type}" data-key="${escapeHtml(m.key)}">${icon("undo", { size: 13 })} Deshacer</button></li>`
          )
          .join("")
      : `<li class="empty-table">No hay movimientos aplicados todavía.</li>`;

    appEl.innerHTML = `
      <button class="back-link" id="backLink">${icon("arrowLeft", { size: 14 })} Volver a ${escapeHtml(brand.name)}</button>

      <div class="org-header">
        <div class="org-brand-title">
          ${brandLogo(brand)}
          <div>
            <h2>Mover zonales y locales</h2>
            <p>${escapeHtml(brand.name)} · los cambios quedan guardados solo en este navegador</p>
          </div>
        </div>
      </div>

      <div class="mover-grid">
        <form id="moveZonalForm" class="mover-card">
          <h3>Mover una zonal a otro regional</h3>
          <label>Zonal
            <select name="zonalId">${zonalOptions}</select>
          </label>
          <label>Nuevo regional
            <select name="regionalId">${newRegionalOptions}</select>
          </label>
          <button type="submit" class="btn-primary" style="--brand-color:${brand.color}">${icon("move", { size: 14 })} Mover zonal</button>
        </form>

        <form id="moveLocalForm" class="mover-card">
          <h3>Mover un local a otra zonal</h3>
          <label>Local
            <select name="localSlug">${localOptions}</select>
          </label>
          <label>Nueva zonal
            <select name="zonalId">${zonalTargetOptions}</select>
          </label>
          <button type="submit" class="btn-primary" style="--brand-color:${brand.color}">${icon("move", { size: 14 })} Mover local</button>
        </form>
      </div>

      <p class="section-label">MOVIMIENTOS APLICADOS</p>
      <ul class="mover-list">${movesHtml}</ul>
      ${moves.length ? `<button class="btn-ghost" id="resetMovesBtn">Restablecer todo (volver al organigrama original)</button>` : ""}
    `;

    document.getElementById("backLink").addEventListener("click", () => {
      window.location.hash = `#/organigrama/${brand.id}`;
    });

    document.getElementById("moveZonalForm").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const data = new FormData(ev.target);
      OrgOverrides.moveZonal(brand.id, data.get("zonalId"), data.get("regionalId"));
      renderMover(brand.id);
    });

    document.getElementById("moveLocalForm").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const data = new FormData(ev.target);
      OrgOverrides.moveLocal(brand.id, data.get("localSlug"), data.get("zonalId"));
      renderMover(brand.id);
    });

    appEl.querySelectorAll(".undo-move").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.type === "zonal") OrgOverrides.undoZonalMove(brand.id, btn.dataset.key);
        else OrgOverrides.undoLocalMove(brand.id, btn.dataset.key);
        renderMover(brand.id);
      });
    });

    const resetBtn = document.getElementById("resetMovesBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (confirm(`¿Restablecer todos los movimientos de ${brand.name}?`)) {
          OrgOverrides.resetBrand(brand.id);
          renderMover(brand.id);
        }
      });
    }
  }

  // ---------- Router ----------
  function route() {
    const hash = window.location.hash || "#/";
    const localMatch = hash.match(/^#\/organigrama\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/);
    const moverMatch = hash.match(/^#\/organigrama\/([^/]+)\/mover$/);
    const onlineMatch = hash === "#/examen-online";
    const citasMatch = hash === "#/citaciones";
    const regionalMatch = hash.match(/^#\/organigrama\/([^/]+)\/([^/]+)$/);
    const brandMatch = hash.match(/^#\/organigrama\/([^/]+)$/);

    renderAuthBar();
    if (onlineMatch) {
      renderOnlinePanel();
    } else if (citasMatch) {
      renderCitaciones();
    } else if (localMatch) {
      renderLocal(localMatch[1], localMatch[2], localMatch[3], localMatch[4]);
    } else if (moverMatch) {
      renderMover(moverMatch[1]);
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

  // Pill de estado de sincronización (arriba a la derecha). Queda siempre
  // visible y al tocarla vuelve a traer los datos (planilla + Supabase y,
  // si estás en Citaciones, el listado de citados) sin recargar la página.
  let sincronizando = false;
  let ultimaSync = null;

  async function sincronizar() {
    if (sincronizando) return;
    sincronizando = true;
    syncPillEl.className = "sync-pill sync-pill-busy";
    syncPillEl.innerHTML = `${icon("refresh", { size: 13, class: "spin" })} Sincronizando…`;
    try {
      await ExamStore.retry();
      if (window.location.hash === "#/citaciones" && citas.filas) await cargarCitaciones();
    } finally {
      sincronizando = false;
      updateSyncPill();
      route();
    }
  }

  function updateSyncPill() {
    const err = ExamStore.getError();
    syncPillEl.hidden = false;
    syncPillEl.setAttribute("role", "button");
    syncPillEl.tabIndex = 0;
    syncPillEl.onclick = sincronizar;
    syncPillEl.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sincronizar(); } };
    if (err) {
      syncPillEl.className = "sync-pill sync-pill-error";
      syncPillEl.title = "No se pudo sincronizar. Tocá para reintentar.";
      syncPillEl.innerHTML = `${icon("cloudOff", { size: 13 })} Sin conexión — mostrando datos guardados. <u>Reintentar</u>`;
    } else {
      ultimaSync = new Date();
      const hora = ultimaSync.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
      syncPillEl.className = "sync-pill sync-pill-ok";
      syncPillEl.title = "Tocá para sincronizar ahora";
      syncPillEl.innerHTML = `${icon("cloud", { size: 13 })} Sincronizado ${hora} ${icon("refresh", { size: 13 })}`;
    }
  }

  window.addEventListener("hashchange", route);

  // Los exámenes se empiezan a sincronizar en cuanto carga la página (en
  // paralelo a la pantalla de inicio), para que al tocar "Ir al Panel de
  // Exámenes" ya estén listos y no haya que esperar de nuevo.
  async function enterApp() {
    document.body.classList.remove("intro-active");
    if (!ExamStore.isLoaded()) {
      appEl.innerHTML = `<div class="empty-state">${icon("cloud", { size: 18 })} Sincronizando datos…</div>`;
    }
    await ExamStore.ensureLoaded();
    updateSyncPill();
    route();
  }

  async function boot() {
    renderIntro(enterApp);
    ExamStore.ensureLoaded(); // dispara la carga en segundo plano, no se espera acá
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
