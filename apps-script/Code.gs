/**
 * Приём заявок дилерского портала «Алмалы-Керамик».
 * Заявки складываются в лист «Заявки», статусы меняются из панели продавца.
 *
 * Настройка: см. apps-script/README.md
 */
var ADMIN_CODE = 'almaly2026';                 // ← придумайте свой код для продавцов
var NOTIFY_EMAIL = '';                         // ← почта для уведомлений, можно оставить пустой
var SHEET = 'Заявки';

var HEAD = ['Номер', 'Получена', 'Статус', 'Дата заявки', 'Заказчик', 'ИНН', 'Контактное лицо',
            'Телефон', 'Почта', 'Город', 'Доставка', 'ТК / адрес', 'Оплата', 'Отгрузка',
            'Комментарий', 'Упаковок', 'м²', 'Позиции (JSON)'];

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HEAD);
    sh.getRange(1, 1, 1, HEAD.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function totals_(items) {
  var packs = 0, sqm = 0;
  (items || []).forEach(function (i) { packs += Number(i.packs) || 0; sqm += (Number(i.packs) || 0) * (Number(i.sqm) || 0); });
  return {packs: packs, sqm: Math.round(sqm * 100) / 100};
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents || '{}');

    if (body.action === 'create') {
      var o = body.order || {};
      if (!o.customer || !o.phone || !(o.items || []).length)
        return json_({ok: false, error: 'не заполнены обязательные поля'});
      var t = totals_(o.items);
      var no = o.no || ('АК-' + Utilities.formatDate(new Date(), 'Europe/Moscow', 'yyMMdd') + '-' +
        Math.floor(Math.random() * 900 + 100));
      sheet_().appendRow([no, new Date(), 'new', o.date || '', o.customer, o.inn || '', o.person || '',
        o.phone, o.email || '', o.city || '', o.delivery || '', o.address || '', o.payment || '',
        o.ship || '', o.note || '', t.packs, t.sqm, JSON.stringify(o.items)]);
      if (NOTIFY_EMAIL) {
        MailApp.sendEmail(NOTIFY_EMAIL, 'Заявка № ' + no + ' — ' + o.customer,
          o.customer + ', ' + (o.person || '') + ', ' + o.phone + '\n' +
          t.packs + ' уп. / ' + t.sqm + ' м²\n' +
          (o.items || []).map(function (i) {
            return i.name + ' (' + i.art + ') — ' + i.packs + ' уп., ' + i.wh;
          }).join('\n'));
      }
      return json_({ok: true, no: no});
    }

    if (body.code !== ADMIN_CODE) return json_({ok: false, error: 'неверный код доступа'});

    if (body.action === 'list') {
      var rows = sheet_().getDataRange().getValues().slice(1);
      var orders = rows.filter(function (r) { return r[0]; }).map(function (r) {
        return {no: r[0], received: r[1] instanceof Date ? r[1].toISOString() : String(r[1]),
          status: r[2] || 'new', date: r[3] instanceof Date ? Utilities.formatDate(r[3], 'Europe/Moscow', 'yyyy-MM-dd') : String(r[3]),
          customer: r[4], inn: r[5], person: r[6], phone: r[7], email: r[8], city: r[9],
          delivery: r[10], address: r[11], payment: r[12],
          ship: r[13] instanceof Date ? Utilities.formatDate(r[13], 'Europe/Moscow', 'yyyy-MM-dd') : String(r[13]),
          note: r[14], items: JSON.parse(r[17] || '[]')};
      }).reverse();
      return json_({ok: true, orders: orders});
    }

    if (body.action === 'status') {
      var sh = sheet_(), values = sh.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(body.no)) {
          sh.getRange(i + 1, 3).setValue(body.status);
          return json_({ok: true});
        }
      }
      return json_({ok: false, error: 'заявка не найдена'});
    }

    return json_({ok: false, error: 'неизвестное действие'});
  } catch (err) {
    return json_({ok: false, error: String(err)});
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ok: true, service: 'Алмалы-Керамик: приём заявок'});
}
