// app.js
// Router simple por hash:
//   #/                    -> listado de marcas
//   #/organigrama/:brandId -> organigrama de una marca

(function () {
  const appEl = document.getElementById("app");
  const syncPillEl = document.getElementById("syncPill");
  const brandPillEl = document.getElementById("brandPill");
  const navCrumbEl = document.getElementById("navCrumb");

  function getBrand(id) {
    return ASCENSOS_DATA.brands.find((b) => b.id === id);
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

  // ---------- Organigrama de una marca ----------
  function renderOrganigrama(brandId) {
    const brand = getBrand(brandId);

    if (!brand) {
      navCrumbEl.innerHTML = `<b>Campus</b> &gt; Ascensos`;
      appEl.innerHTML = `<div class="empty-state">No encontramos esa marca.<br><a href="#/">Volver</a></div>`;
      return;
    }

    navCrumbEl.innerHTML = `<b>Campus</b> &gt; Ascensos &gt; ${escapeHtml(brand.name)}`;
    brandPillEl.innerHTML = `${renderBrandLogo(brand)} ${escapeHtml(brand.name)}`;
    brandPillEl.style.setProperty("--brand-color", brand.color);

    const org = brand.organigrama;
    const zonasHtml = org.zonas
      .map(
        (zona) => `
        <div class="org-zona-branch">
          <div class="org-node" style="--brand-color:${brand.color}">
            <p class="role-tag">Gerente Zonal</p>
            <p class="person-name">${escapeHtml(zona.gerenteZonal.name)}</p>
            <p class="person-sub">${escapeHtml(zona.gerenteZonal.role)}</p>
          </div>
          <div class="org-locales-list">
            ${zona.locales
              .map(
                (local) => `
                <div class="org-local-card">
                  <p class="local-name">${escapeHtml(local.name)}</p>
                  <p class="local-dir">${escapeHtml(local.direccion)}</p>
                </div>`
              )
              .join("")}
          </div>
        </div>`
      )
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

      <div class="org-tree">
        <div class="org-node regional" style="--brand-color:${brand.color}">
          <p class="role-tag">Gerente Regional</p>
          <p class="person-name">${escapeHtml(org.gerenteRegional.name)}</p>
        </div>
        <div class="org-connector"></div>
        <div class="org-zonas-row ${org.zonas.length > 1 ? "multi" : ""}">
          ${zonasHtml}
        </div>
      </div>
    `;

    document.getElementById("backLink").addEventListener("click", () => {
      window.location.hash = "#/";
    });
  }

  // ---------- Router ----------
  function route() {
    const hash = window.location.hash || "#/";
    const orgMatch = hash.match(/^#\/organigrama\/([^/]+)$/);

    if (orgMatch) {
      renderOrganigrama(orgMatch[1]);
    } else {
      renderHome();
    }
  }

  window.addEventListener("hashchange", route);

  // Placeholder de sincronización con Supabase: por ahora los datos son
  // locales (data.js), así que simulamos el estado "sincronizado" apenas
  // arranca. Cuando conectemos Supabase de verdad, este es el lugar para
  // hacer el fetch real antes de renderizar.
  function init() {
    route();
    setTimeout(() => {
      syncPillEl.classList.add("is-synced");
      syncPillEl.innerHTML = `<span class="sync-pill-icon">✓</span> Sincronizado`;
    }, 500);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
