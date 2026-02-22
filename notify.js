// ============================================================
// notify.js — Notification Service
// รองรับ: Telegram Bot, Webhook, Google Apps Script (Gmail)
// ============================================================

const NOTIFY = {

  /* ── ดึง Settings ── */
  cfg() { return DB.getSettings(); },

  /* ── Format ข้อความ ── */
  buildMsg(ticket, event, extra = '') {
    const cfg = this.cfg();
    const org = cfg.orgName || 'ระบบแจ้งซ่อม';
    const icons = { pending:'📋', assigned:'👷', inprogress:'🔧', done:'✅', rated:'⭐', image:'📸' };
    const icon = icons[event] || '🔔';
    const tech = ticket.technicianId ? DB.getTechById(ticket.technicianId) : null;

    return `${icon} *${org}*
━━━━━━━━━━━━━━━━━━━━
📌 *${DB.statusLabel(ticket.status || event).toUpperCase()}*
🔖 หมายเลข: \`${ticket.id}\`
👤 ผู้แจ้ง: ${ticket.name}
📞 โทร: ${ticket.phone}
📍 สถานที่: ${ticket.location}
🔩 ประเภท: ${DB.categoryLabel(ticket.category)}
⚡ ความเร่งด่วน: ${DB.priorityLabel(ticket.priority)}
${tech ? `👷 ช่าง: ${tech.name} (${tech.phone})` : ''}
${ticket.rating ? `⭐ คะแนน: ${ticket.rating}/5 — ${ticket.ratingComment}` : ''}
${extra ? `📝 หมายเหตุ: ${extra}` : ''}
━━━━━━━━━━━━━━━━━━━━
📅 ${new Date().toLocaleString('th-TH')}`;
  },

  /* ── TELEGRAM ── */
  async sendTelegram(ticket, event, extra = '') {
    const cfg = this.cfg();
    if (!cfg.telegramBotToken || !cfg.telegramChatId) return { ok: false, reason: 'no_config' };
    const text = this.buildMsg(ticket, event, extra);
    const url = `https://api.telegram.org/bot${cfg.telegramBotToken}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: cfg.telegramChatId, text, parse_mode: 'Markdown' })
      });
      return await res.json();
    } catch(e) { return { ok: false, reason: e.message }; }
  },

  /* ── WEBHOOK ── */
  async sendWebhook(ticket, event, extra = '') {
    const cfg = this.cfg();
    if (!cfg.webhookUrl) return { ok: false, reason: 'no_config' };
    try {
      const res = await fetch(cfg.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          ticket: {
            id: ticket.id,
            name: ticket.name,
            phone: ticket.phone,
            location: ticket.location,
            category: DB.categoryLabel(ticket.category),
            priority: DB.priorityLabel(ticket.priority),
            status: DB.statusLabel(ticket.status),
            technician: ticket.technicianId ? DB.getTechById(ticket.technicianId)?.name : null,
            rating: ticket.rating,
            note: extra,
          },
          timestamp: new Date().toISOString(),
        })
      });
      return { ok: res.ok, status: res.status };
    } catch(e) { return { ok: false, reason: e.message }; }
  },

  /* ── GMAIL via Google Apps Script ──
     Google Apps Script จะส่ง Email พร้อม Inline Action Buttons
     ผู้รับ (Admin/ช่าง) กดปุ่มในอีเมลได้เลย → GAS จะ call webhook กลับมา
  */
  async sendGmail(ticket, event, toEmail, extra = '') {
    const cfg = this.cfg();
    if (!cfg.googleScriptUrl) return { ok: false, reason: 'no_gas_url' };
    const tech = ticket.technicianId ? DB.getTechById(ticket.technicianId) : null;
    try {
      const res = await fetch(cfg.googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendEmail',
          to: toEmail || cfg.adminEmail,
          event,
          ticket: {
            id: ticket.id,
            name: ticket.name,
            phone: ticket.phone,
            email: ticket.email || '',
            location: ticket.location,
            category: DB.categoryLabel(ticket.category),
            priority: DB.priorityLabel(ticket.priority),
            status: DB.statusLabel(ticket.status),
            description: ticket.description,
            techName: tech?.name || '',
            techPhone: tech?.phone || '',
            rating: ticket.rating || '',
            ratingComment: ticket.ratingComment || '',
            note: extra,
            createdAt: ticket.createdAt,
            siteUrl: window.location.origin + window.location.pathname.replace(/\/[^/]*$/, ''),
            callbackUrl: cfg.googleScriptUrl,
          }
        })
      });
      return await res.json();
    } catch(e) { return { ok: false, reason: e.message }; }
  },

  /* ── Master Send (ส่งทุก channel พร้อมกัน) ── */
  async sendAll(ticket, event, extra = '', toEmail = '') {
    const cfg = this.cfg();
    const results = {};

    // กรองตาม setting
    const shouldSend = {
      new:    cfg.notifyOnNew,
      assign: cfg.notifyOnAssign,
      done:   cfg.notifyOnDone,
      rated:  cfg.notifyOnRating,
    };
    const map = { pending:'new', assigned:'assign', inprogress:'assign', done:'done', rated:'rated' };
    if (shouldSend[map[event]] === false) return {};

    const [tg, wh, gm] = await Promise.allSettled([
      this.sendTelegram(ticket, event, extra),
      this.sendWebhook(ticket, event, extra),
      toEmail || cfg.adminEmail ? this.sendGmail(ticket, event, toEmail || cfg.adminEmail, extra) : Promise.resolve({ok:false,reason:'no_email'}),
    ]);

    results.telegram = tg.status === 'fulfilled' ? tg.value : { ok:false, reason: tg.reason };
    results.webhook  = wh.status === 'fulfilled' ? wh.value : { ok:false, reason: wh.reason };
    results.gmail    = gm.status === 'fulfilled' ? gm.value : { ok:false, reason: gm.reason };

    console.log('[NOTIFY]', event, results);
    return results;
  },

  /* ── Test ping ── */
  async testTelegram() {
    const cfg = this.cfg();
    if (!cfg.telegramBotToken || !cfg.telegramChatId) return { ok:false, reason:'กรุณากรอก Bot Token และ Chat ID ก่อน' };
    try {
      const res = await fetch(`https://api.telegram.org/bot${cfg.telegramBotToken}/sendMessage`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ chat_id:cfg.telegramChatId, text:`✅ ทดสอบการเชื่อมต่อ ${cfg.orgName||''} สำเร็จ!\n⏰ ${new Date().toLocaleString('th-TH')}` })
      });
      const d = await res.json();
      return d.ok ? {ok:true} : {ok:false, reason: d.description};
    } catch(e) { return {ok:false, reason:e.message}; }
  },

  async testWebhook() {
    const cfg = this.cfg();
    if (!cfg.webhookUrl) return { ok:false, reason:'กรุณากรอก Webhook URL ก่อน' };
    try {
      const res = await fetch(cfg.webhookUrl, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ event:'test', message:'ทดสอบ Webhook จากระบบแจ้งซ่อม', timestamp:new Date().toISOString() })
      });
      return { ok:res.ok, status:res.status };
    } catch(e) { return {ok:false, reason:e.message}; }
  },
};
