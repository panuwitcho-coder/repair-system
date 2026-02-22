// ============================================================
// Google Apps Script — Code.gs
// ระบบแจ้งซ่อมออนไลน์: ส่ง Email + Action Buttons
// 
// วิธีติดตั้ง:
// 1. ไปที่ https://script.google.com → New Project
// 2. วาง code นี้ แล้วกด Save
// 3. Deploy → New Deployment → Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 4. Copy Web App URL ไปใส่ใน Admin Panel → ตั้งค่า → Google Script URL
// ============================================================

const SITE_URL = 'https://yourusername.github.io/repair-system'; // ← เปลี่ยนให้ตรง

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'sendEmail') {
      return sendRepairEmail(data);
    } else if (data.action === 'updateStatus') {
      return handleStatusUpdate(data);
    }
    
    return jsonResponse({ ok: false, reason: 'Unknown action' });
  } catch(err) {
    return jsonResponse({ ok: false, reason: err.message });
  }
}

function doGet(e) {
  // Handle Gmail action button callbacks
  const action   = e.parameter.action;
  const ticketId = e.parameter.id;
  const token    = e.parameter.token;
  
  if (!action || !ticketId) {
    return HtmlService.createHtmlOutput('<h2>❌ ข้อมูลไม่ครบ</h2>');
  }
  
  // Log the action
  logAction(ticketId, action, token);
  
  // Send webhook back to the system
  notifyWebhook(ticketId, action);
  
  const labels = {
    'accept':   '✅ รับงานแล้ว',
    'start':    '🔧 เริ่มดำเนินการแล้ว',
    'close':    '✅ ปิดงานแล้ว',
    'cancel':   '❌ ยกเลิกงานแล้ว',
  };
  
  const html = `<!DOCTYPE html><html lang="th">
  <head><meta charset="UTF-8"><title>ดำเนินการสำเร็จ</title>
  <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0f4f8;margin:0}
  .box{background:#fff;border-radius:16px;padding:40px;text-align:center;max-width:400px;box-shadow:0 4px 24px rgba(0,0,0,.1)}
  .icon{font-size:3rem;margin-bottom:12px}.title{font-size:1.4rem;font-weight:700;color:#0A2342;margin-bottom:8px}
  .sub{color:#7A8DA0;margin-bottom:20px}.btn{display:inline-block;padding:12px 24px;background:#0A2342;color:#fff;text-decoration:none;border-radius:10px;font-weight:700}</style>
  </head>
  <body><div class="box">
    <div class="icon">✅</div>
    <div class="title">${labels[action] || 'ดำเนินการแล้ว'}</div>
    <div class="sub">หมายเลข: <strong>${ticketId}</strong></div>
    <a href="${SITE_URL}/admin/index.html" class="btn">🔧 ไปยัง Admin Panel</a>
  </div></body></html>`;
  
  return HtmlService.createHtmlOutput(html);
}

/* ── ส่ง Email ── */
function sendRepairEmail(data) {
  const t   = data.ticket;
  const to  = data.to;
  const evt = data.event;
  if (!to || !t) return jsonResponse({ ok: false, reason: 'Missing to/ticket' });
  
  const scriptUrl = ScriptApp.getService().getUrl();
  const baseUrl   = `${scriptUrl}?id=${t.id}&token=${generateToken(t.id)}`;
  
  const subject = buildSubject(evt, t);
  const html    = buildEmailHtml(evt, t, baseUrl);
  
  GmailApp.sendEmail(to, subject, '', { htmlBody: html, name: t.orgName || 'ระบบแจ้งซ่อม' });
  
  // ถ้ามีอีเมลของผู้แจ้ง ให้ CC ด้วย
  if (t.email && t.email !== to && evt === 'done') {
    const subjectCust = `✅ งานซ่อมเสร็จแล้ว — ${t.id}`;
    GmailApp.sendEmail(t.email, subjectCust, '', { htmlBody: buildCustomerEmail(t), name: 'ระบบแจ้งซ่อม' });
  }
  
  return jsonResponse({ ok: true, to, subject });
}

function buildSubject(evt, t) {
  const map = {
    pending:    `🔔 [แจ้งซ่อมใหม่] ${t.id} — ${t.location}`,
    assigned:   `👷 [มอบหมายงาน] ${t.id} → ${t.techName || '?'} — ${t.location}`,
    inprogress: `🔧 [กำลังซ่อม] ${t.id} — ${t.location}`,
    done:       `✅ [ซ่อมเสร็จ] ${t.id} — ${t.location}`,
    rated:      `⭐ [มีการประเมิน] ${t.id} — คะแนน ${t.rating}/5`,
  };
  return map[evt] || `🔔 [แจ้งซ่อม] ${t.id}`;
}

function buildEmailHtml(evt, t, baseUrl) {
  const priColor = { low:'#27AE60', medium:'#F4A926', high:'#E74C3C' };
  const statColor= { pending:'#856404', assigned:'#6B21A8', inprogress:'#0056B3', done:'#155724' };
  const statBg   = { pending:'#FFF3CD', assigned:'#E8D5FF', inprogress:'#CCE5FF', done:'#D4EDDA' };
  
  // Action buttons ตาม event
  let actionButtons = '';
  if (evt === 'pending') {
    actionButtons = `
      <a href="${baseUrl}&action=accept" style="display:inline-block;padding:12px 24px;background:#27AE60;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;margin:6px">✅ รับงาน</a>
      <a href="${baseUrl}&action=cancel" style="display:inline-block;padding:12px 24px;background:#E74C3C;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;margin:6px">❌ ยกเลิก</a>`;
  } else if (evt === 'assigned') {
    actionButtons = `
      <a href="${baseUrl}&action=start" style="display:inline-block;padding:12px 24px;background:#F4A926;color:#0A2342;text-decoration:none;border-radius:10px;font-weight:700;margin:6px">🔧 เริ่มงาน</a>
      <a href="${baseUrl}&action=close" style="display:inline-block;padding:12px 24px;background:#27AE60;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;margin:6px">✅ ปิดงาน</a>`;
  } else if (evt === 'inprogress') {
    actionButtons = `
      <a href="${baseUrl}&action=close" style="display:inline-block;padding:12px 24px;background:#27AE60;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;margin:6px">✅ ปิดงาน</a>`;
  }

  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"></head>
<body style="font-family:'Sarabun',sans-serif;background:#EEF2F7;margin:0;padding:20px">
<div style="max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)">
  
  <!-- HEADER -->
  <div style="background:#0A2342;padding:28px 32px;color:#fff">
    <div style="font-size:1.5rem;font-weight:700">🔧 ระบบแจ้งซ่อมออนไลน์</div>
    <div style="opacity:.7;margin-top:4px;font-size:.9rem">${t.orgName || ''}</div>
  </div>
  
  <!-- STATUS BADGE -->
  <div style="padding:20px 32px;background:#F8FAFC;border-bottom:2px solid #D1DCE8">
    <span style="display:inline-block;padding:6px 16px;border-radius:20px;font-weight:700;background:${statBg[evt]||'#EEF2F7'};color:${statColor[evt]||'#0A2342'}">
      ${buildSubject(evt, t).split(']')[0].replace('[','')+']'}
    </span>
    <span style="margin-left:10px;display:inline-block;padding:6px 16px;border-radius:20px;font-weight:700;background:#EDFBF4;color:${priColor[t.priority]||'#7A8DA0'}">
      ⚡ ${t.priority==='high'?'เร่งด่วนมาก':t.priority==='medium'?'ด่วน':'ปกติ'}
    </span>
  </div>
  
  <!-- CONTENT -->
  <div style="padding:28px 32px">
    <table style="width:100%;border-collapse:collapse">
      ${row('🔖 หมายเลข', `<strong>${t.id}</strong>`)}
      ${row('👤 ผู้แจ้ง', `${t.name} (${t.phone})`)}
      ${t.email ? row('📧 อีเมล', t.email) : ''}
      ${row('📍 สถานที่', t.location)}
      ${row('🔩 ประเภท', t.category)}
      ${t.techName ? row('👷 ช่างผู้รับผิดชอบ', `${t.techName}${t.techPhone?' ('+t.techPhone+')':''}`) : ''}
      ${t.rating ? row('⭐ คะแนน', `${t.rating}/5${t.ratingComment?' — "'+t.ratingComment+'"':''}`) : ''}
      ${t.note ? row('📝 หมายเหตุ', t.note) : ''}
      ${row('📅 วันที่', new Date(t.createdAt||Date.now()).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}))}
    </table>
    
    ${t.description ? `<div style="margin-top:16px;padding:14px;background:#F8FAFC;border-radius:10px;border-left:4px solid #0A2342">
      <strong style="color:#0A2342">รายละเอียดปัญหา:</strong>
      <div style="margin-top:6px;color:#1A2B3C;line-height:1.6">${t.description}</div>
    </div>` : ''}
    
    ${actionButtons ? `<div style="margin-top:24px;padding:20px;background:#F0FFF4;border-radius:12px;border:2px solid #27AE60;text-align:center">
      <div style="font-weight:700;color:#0A2342;margin-bottom:14px">⚡ ดำเนินการได้เลย — กดปุ่มด้านล่าง</div>
      <div>${actionButtons}</div>
      <div style="font-size:.78rem;color:#7A8DA0;margin-top:10px">ปุ่มด้านบนจะอัพเดทสถานะระบบโดยอัตโนมัติ</div>
    </div>` : ''}
    
    <!-- LINK -->
    <div style="margin-top:20px;text-align:center">
      <a href="${t.siteUrl||SITE_URL}/admin/index.html" style="display:inline-block;padding:12px 28px;background:#0A2342;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">🔧 เปิด Admin Panel</a>
    </div>
  </div>
  
  <!-- FOOTER -->
  <div style="background:#0A2342;padding:16px 32px;color:rgba(255,255,255,.5);font-size:.78rem;text-align:center">
    © ${new Date().getFullYear()} ระบบแจ้งซ่อมออนไลน์ — อีเมลนี้ส่งโดยอัตโนมัติ
  </div>
</div>
</body></html>`;
}

function buildCustomerEmail(t) {
  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;background:#EEF2F7;margin:0;padding:20px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)">
  <div style="background:#27AE60;padding:28px 32px;color:#fff;text-align:center">
    <div style="font-size:3rem">✅</div>
    <div style="font-size:1.4rem;font-weight:700;margin-top:8px">งานซ่อมเสร็จแล้ว!</div>
  </div>
  <div style="padding:28px 32px">
    <p>เรียน คุณ<strong>${t.name}</strong></p>
    <p style="margin-top:12px">งานแจ้งซ่อมของคุณ <strong>${t.id}</strong> ที่ <strong>${t.location}</strong> ได้รับการดำเนินการเสร็จสิ้นแล้ว</p>
    ${t.techName ? `<p style="margin-top:8px">ช่างผู้ดำเนินการ: <strong>${t.techName}</strong></p>` : ''}
    <div style="margin-top:20px;padding:16px;background:#F0FFF4;border-radius:10px;text-align:center">
      <p style="font-weight:700;color:#0A2342">กรุณาประเมินการให้บริการ</p>
      <p style="font-size:.85rem;color:#7A8DA0">เพื่อพัฒนาคุณภาพการบริการ</p>
      <a href="${SITE_URL}/status.html?id=${t.id}" style="display:inline-block;margin-top:10px;padding:12px 28px;background:#F4A926;color:#0A2342;text-decoration:none;border-radius:10px;font-weight:700">⭐ ประเมินความพึงพอใจ</a>
    </div>
  </div>
  <div style="background:#0A2342;padding:14px;color:rgba(255,255,255,.5);font-size:.75rem;text-align:center">ระบบแจ้งซ่อมออนไลน์</div>
</div></body></html>`;
}

function row(label, value) {
  return `<tr>
    <td style="padding:8px 0;color:#7A8DA0;font-weight:500;font-size:.88rem;width:35%;vertical-align:top">${label}</td>
    <td style="padding:8px 0;font-weight:700;font-size:.9rem">${value}</td>
  </tr>`;
}

/* ── Webhook Callback ── */
function notifyWebhook(ticketId, action) {
  // ถ้าต้องการแจ้งกลับ webhook จาก GAS
  // ตั้งค่า webhookUrl ด้านล่าง หรือดึงจาก PropertiesService
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('WEBHOOK_URL');
  if (!webhookUrl) return;
  try {
    UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ event: 'email_action', action, ticketId, timestamp: new Date().toISOString() }),
      muteHttpExceptions: true,
    });
  } catch(e) { console.error(e); }
}

/* ── Utilities ── */
function generateToken(id) {
  return Utilities.base64Encode(id + '_' + new Date().toDateString()).replace(/[+/=]/g,'');
}

function logAction(ticketId, action, token) {
  const sheet = getOrCreateSheet('ActionLog');
  sheet.appendRow([new Date(), ticketId, action, token]);
}

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create('RepairSystem_Log');
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// SETUP: ตั้งค่า Script Properties (ทำครั้งเดียว)
// รัน function นี้ใน GAS Editor เพื่อตั้งค่า Webhook URL
// ============================================================
function setupProperties() {
  PropertiesService.getScriptProperties().setProperties({
    'WEBHOOK_URL': 'YOUR_WEBHOOK_URL_HERE', // ← ใส่ URL ของ Webhook ถ้ามี
  });
  Logger.log('Setup complete!');
}
