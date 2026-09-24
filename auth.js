// auth.js
// Acceso de Capacitación con Supabase Auth (email + contraseña).
//
// Sin login el Campus funciona igual que siempre (solo lectura de los
// resultados online). Con login se habilita: editar y borrar exámenes
// (planilla y examen online) y el panel "Examen online" con resumen,
// preguntas más falladas y el banco de preguntas.
//
// Los usuarios se crean a mano en Supabase > Authentication > Users.
// SUPABASE_URL y SUPABASE_ANON_KEY están definidos en exams.js.

const Auth = (function () {
  const STORAGE_KEY = "campusAscensos.sesion.v1";
  let session = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function persist(s) {
    session = s;
    try {
      if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // sin almacenamiento: la sesión dura mientras esté abierta la pestaña
    }
  }

  async function tokenRequest(grantType, body) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grantType}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error_description || data.msg || data.error || `HTTP ${res.status}`;
      throw new Error(/invalid login/i.test(msg) ? "Email o contraseña incorrectos" : msg);
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      email: data.user && data.user.email,
    };
  }

  async function login(email, password) {
    persist(await tokenRequest("password", { email, password }));
    return session;
  }

  function logout() {
    persist(null);
  }

  function isLoggedIn() {
    return !!session;
  }

  function email() {
    return session ? session.email : null;
  }

  // Devuelve un access token vigente (lo renueva si está por vencer).
  // Si la sesión ya no sirve, cierra sesión y devuelve null.
  async function token() {
    if (!session) return null;
    if (Date.now() < session.expiresAt - 60 * 1000) return session.accessToken;
    try {
      const renewed = await tokenRequest("refresh_token", { refresh_token: session.refreshToken });
      persist(Object.assign({}, renewed, { email: renewed.email || session.email }));
      return session.accessToken;
    } catch (e) {
      persist(null);
      return null;
    }
  }

  return { login, logout, isLoggedIn, email, token };
})();
