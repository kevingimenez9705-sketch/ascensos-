// data.js
// Fuente de datos del Campus de Ascensos.
//
// Por ahora esto es data local "demo" para poder trabajar la UI sin
// depender todavía de Supabase. Cuando conectemos Supabase de verdad,
// esta misma forma de objeto (ASCENSOS_DATA.brands[]) es la que hay que
// devolver desde las consultas, para no tener que tocar app.js.

const ASCENSOS_DATA = {
  brands: [
    {
      id: "hex",
      name: "Hamburguesas Extremas",
      shortCode: "EXT",
      color: "#e02424",
      logoBg: "#fde2e1",
      logoText: "#e02424",
      manager: { name: "Evangelina Rodriguez", role: "GTE Comercial" },
      stats: { exams: 0, approved: 0, attendance: null },
      organigrama: {
        gerenteRegional: {
          name: "Evangelina Rodriguez",
          role: "Gerente Regional",
        },
        zonas: [
          {
            id: "zona-norte",
            gerenteZonal: { name: "Juan Pérez", role: "Gerente Zonal · Zona Norte" },
            locales: [
              { id: "hex-loc-1", name: "Sucursal Palermo", direccion: "Av. Santa Fe 3253" },
              { id: "hex-loc-2", name: "Sucursal Belgrano", direccion: "Av. Cabildo 2040" },
            ],
          },
          {
            id: "zona-sur",
            gerenteZonal: { name: "María López", role: "Gerente Zonal · Zona Sur" },
            locales: [
              { id: "hex-loc-3", name: "Sucursal Caballito", direccion: "Av. Rivadavia 5200" },
              { id: "hex-loc-4", name: "Sucursal Flores", direccion: "Av. Rivadavia 7100" },
            ],
          },
        ],
      },
    },
    {
      id: "sabores",
      name: "Sabores Express",
      shortCode: "SBX",
      color: "#1d4ed8",
      logoBg: "#dbeafe",
      logoText: "#1d4ed8",
      manager: { name: "Mauro Dalla Valle", role: "GTE Comercial" },
      stats: { exams: 0, approved: 0, attendance: null },
      organigrama: {
        gerenteRegional: {
          name: "Mauro Dalla Valle",
          role: "Gerente Regional",
        },
        zonas: [
          {
            id: "zona-este",
            gerenteZonal: { name: "Lucía Fernández", role: "Gerente Zonal · Zona Este" },
            locales: [
              { id: "sbx-loc-1", name: "Sucursal Once", direccion: "Av. Pueyrredón 800" },
              { id: "sbx-loc-2", name: "Sucursal Retiro", direccion: "Av. Del Libertador 100" },
            ],
          },
          {
            id: "zona-oeste",
            gerenteZonal: { name: "Diego Torres", role: "Gerente Zonal · Zona Oeste" },
            locales: [
              { id: "sbx-loc-3", name: "Sucursal Liniers", direccion: "Av. Rivadavia 11000" },
              { id: "sbx-loc-4", name: "Sucursal Mataderos", direccion: "Av. Directorio 5800" },
            ],
          },
        ],
      },
    },
  ],
};
