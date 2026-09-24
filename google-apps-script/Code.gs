/**
 * Campus de Ascensos — backend en Google Sheets.
 *
 * Este script convierte una Google Sheet en una base de datos simple de
 * exámenes: la app web lee y escribe acá en vez de usar localStorage, así
 * todos ven los mismos datos sin importar desde qué dispositivo entren.
 *
 * CÓMO INSTALARLO (una sola vez):
 *  1. Creá una Google Sheet nueva (sheets.new).
 *  2. Extensiones > Apps Script.
 *  3. Borrá el contenido de Code.gs que viene por defecto y pegá TODO este archivo.
 *  4. Arriba a la derecha: Implementar > Nueva implementación.
 *  5. Tipo: "Aplicación web".
 *     - Ejecutar como: Yo (tu cuenta).
 *     - Quién tiene acceso: Cualquier usuario.
 *  6. Implementar. La primera vez te va a pedir autorizar permisos (es tu
 *     propio script sobre tu propia planilla, es seguro aceptar).
 *  7. Copiá la URL que te da ("URL de la aplicación web", termina en /exec)
 *     y pasámela — con eso conecto la app.
 *
 * SEGURIDAD: para agregar, corregir o borrar exámenes se pide la clave de
 * Capacitación. Cargala en Configuración del proyecto (engranaje) >
 * Propiedades de la secuencia de comandos > Agregar propiedad:
 *   Propiedad: CLAVE   Valor: (la misma clave de Capacitación de Supabase)
 *
 * Si más adelante cambiás el código de este script, hay que volver a
 * "Implementar > Gestionar implementaciones > editar (lápiz) > Nueva
 * versión" para que el cambio se vea reflejado (si no, la URL sigue
 * sirviendo la versión vieja).
 */

var SHEET_NAME = "Examenes";
var HEADERS = [
  "id", "brandId", "regionalId", "zonalId", "localName",
  "nombre", "apellido", "puestoActual", "puestoPostula",
  "fecha", "asistio", "puntaje", "resultado", "observaciones",
  "createdAt",
];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function rowToRecord_(headers, row) {
  var record = {};
  headers.forEach(function (h, i) {
    var value = row[i];
    if (h === "asistio") {
      record[h] = value === true || value === "TRUE" || value === "true";
    } else if (h === "puntaje") {
      record[h] = value === "" || value === null || value === undefined ? null : Number(value);
    } else {
      record[h] = value === undefined ? "" : value;
    }
  });
  return record;
}

// GET: devuelve todos los exámenes cargados.
function doGet(e) {
  var sheet = getSheet_();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return jsonResponse_({ ok: true, exams: [] });

  var headers = data[0];
  var exams = data.slice(1)
    .filter(function (row) { return row[0]; }) // saltea filas vacías
    .map(function (row) { return rowToRecord_(headers, row); });

  return jsonResponse_({ ok: true, exams: exams });
}

// POST: agregar, corregir o eliminar un examen. Body (texto plano con JSON adentro,
// para evitar el preflight CORS que Apps Script no responde):
//   {"action":"add","record":{...}}
//   {"action":"update","record":{...con id...}}
//   {"action":"remove","id":"..."}
function doPost(e) {
  var sheet = getSheet_();
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ ok: false, error: "JSON inválido" });
  }

  // Toda escritura requiere la clave de Capacitación, guardada en
  // Configuración del proyecto > Propiedades de la secuencia de comandos > CLAVE.
  var claveEsperada = PropertiesService.getScriptProperties().getProperty("CLAVE");
  if (!claveEsperada || String(body.clave || "") !== claveEsperada) {
    return jsonResponse_({ ok: false, error: "clave incorrecta" });
  }

  if (body.action === "add") {
    var record = body.record || {};
    var row = HEADERS.map(function (h) {
      var value = record[h];
      return value === undefined || value === null ? "" : value;
    });
    sheet.appendRow(row);
    return jsonResponse_({ ok: true, record: record });
  }

  if (body.action === "update") {
    var rec = body.record || {};
    var rows = sheet.getDataRange().getValues();
    var idIdx = HEADERS.indexOf("id");
    for (var r = 1; r < rows.length; r++) {
      if (String(rows[r][idIdx]) === String(rec.id)) {
        var updated = HEADERS.map(function (h, i) {
          var value = rec[h];
          if (value === undefined) return rows[r][i];
          return value === null ? "" : value;
        });
        sheet.getRange(r + 1, 1, 1, HEADERS.length).setValues([updated]);
        return jsonResponse_({ ok: true, record: rec });
      }
    }
    return jsonResponse_({ ok: false, error: "no se encontró el examen" });
  }

  if (body.action === "remove") {
    var data = sheet.getDataRange().getValues();
    var idCol = HEADERS.indexOf("id");
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === String(body.id)) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return jsonResponse_({ ok: true });
  }

  return jsonResponse_({ ok: false, error: "acción desconocida: " + body.action });
}
