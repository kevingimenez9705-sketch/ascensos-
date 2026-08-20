// app.js
// Router simple por hash:
//   #/                                  -> listado de marcas
//   #/organigrama/:brandId              -> GTE Comercial + listado de Gerentes Regionales
//   #/organigrama/:brandId/:regionalId  -> Gerente Regional + su Asistente + Gerentes Zonales y locales

(function () {
  const appEl = document.getElementById("app");
  const brandPillEl = document.getElementById("brandPill");
  const navCrumbEl = document.getElementById("navCrumb");

  function getBrand(id) {
    return ASCENSOS_DATA.brands.find((b) => b.id === id);
  }

  function getRegional(brand, regionalId) {
    return brand.organigrama.regionales.find((r) => r.id === regionalId);
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

  // ---------- Home: listado de marcas ----------
  function renderHome() {
    navCrumbEl.innerHTML = `<b>Campus</b> &gt; Ascensos`;
    brandPillEl.innerHTML = "";

    const cards = ASCENSOS_DATA.brands
      .map((brand) => {
        const s = brand.stats;
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
        <div class="org-card org-card-top" style="--brand-color:${brand.color}">
          <p class="role-tag">${escapeHtml(org.comercial.role)}</p>
          <p class="person-name">${escapeHtml(org.comercial.name)}</p>
          ${contactLines(org.comercial)}
        </div>
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
          .map((local) => `<li>${escapeHtml(local)}</li>`)
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

    const asistenteHtml = regional.asistente
      ? `
        <div class="org-connector org-connector-h"></div>
        <div class="org-card org-card-top org-card-secondary" style="--brand-color:${brand.color}">
          <p class="role-tag">${escapeHtml(regional.asistente.role)}</p>
          <p class="person-name">${escapeHtml(regional.asistente.name)}</p>
          ${contactLines(regional.asistente)}
        </div>`
      : "";

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
        <div class="org-pair-row">
          <div class="org-card org-card-top" style="--brand-color:${brand.color}">
            <p class="role-tag">${escapeHtml(regional.role)}</p>
            <p class="person-name">${escapeHtml(regional.name)}</p>
            ${contactLines(regional)}
          </div>
          ${asistenteHtml}
        </div>
        <div class="org-connector"></div>
        <div class="org-children-grid org-children-grid-zonales">${zonalCards}</div>
      </div>
    `;

    document.getElementById("backLink").addEventListener("click", () => {
      window.location.hash = `#/organigrama/${brand.id}`;
    });
  }

  // ---------- Router ----------
  function route() {
    const hash = window.location.hash || "#/";
    const regionalMatch = hash.match(/^#\/organigrama\/([^/]+)\/([^/]+)$/);
    const brandMatch = hash.match(/^#\/organigrama\/([^/]+)$/);

    if (regionalMatch) {
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
