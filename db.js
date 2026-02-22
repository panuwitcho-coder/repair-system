// ============================================================
// db.js — Database Layer v2 (localStorage)
// ระบบแจ้งซ่อมออนไลน์ — เพิ่มช่าง, รูปภาพ, ประเมิน, แจ้งเตือน
// ============================================================

const DB = {
  KEYS: {
    tickets:    'repair_tickets_v2',
    technicians:'repair_technicians',
    settings:   'repair_settings',
  },

  /* ─── TICKETS ─── */
  getAll()  { return JSON.parse(localStorage.getItem(this.KEYS.tickets) || '[]'); },
  saveAll(d){ localStorage.setItem(this.KEYS.tickets, JSON.stringify(d)); },

  add(ticket) {
    const tickets = this.getAll();
    const id = 'REP-' + Date.now().toString().slice(-6);
    const obj = {
      id,
      ...ticket,
      status: 'pending',
      technicianId: null,
      assignedAt: null,
      startedAt: null,
      closedAt: null,
      imagesBefore: ticket.imagesBefore || [],
      imagesAfter:  ticket.imagesAfter  || [],
      rating: null,
      ratingComment: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [{ action:'created', date:new Date().toISOString(), note:'สร้างคำขอแจ้งซ่อม', by:'system' }]
    };
    tickets.unshift(obj);
    this.saveAll(tickets);
    return obj;
  },

  getById(id) { return this.getAll().find(t => t.id === id); },

  update(id, patch) {
    const tickets = this.getAll();
    const i = tickets.findIndex(t => t.id === id);
    if (i < 0) return null;
    tickets[i] = { ...tickets[i], ...patch, updatedAt: new Date().toISOString() };
    this.saveAll(tickets);
    return tickets[i];
  },

  addHistory(id, action, note, by='admin') {
    const tickets = this.getAll();
    const i = tickets.findIndex(t => t.id === id);
    if (i < 0) return;
    tickets[i].history.push({ action, date:new Date().toISOString(), note, by });
    tickets[i].updatedAt = new Date().toISOString();
    this.saveAll(tickets);
    return tickets[i];
  },

  updateStatus(id, status, note='', by='admin') {
    const now = new Date().toISOString();
    const patch = { status };
    if (status === 'inprogress') patch.startedAt = now;
    if (status === 'done')       patch.closedAt  = now;
    this.update(id, patch);
    return this.addHistory(id, status, note || this.statusLabel(status), by);
  },

  assign(id, technicianId, note='', by='admin') {
    const tech = this.getTechById(technicianId);
    const patch = { technicianId, assignedAt: new Date().toISOString(), status: 'assigned' };
    this.update(id, patch);
    return this.addHistory(id, 'assigned', note || `มอบหมายให้ ${tech?.name||technicianId}`, by);
  },

  addImages(id, type, base64List) {
    const t = this.getById(id);
    if (!t) return null;
    const key = type === 'before' ? 'imagesBefore' : 'imagesAfter';
    const imgs = [...(t[key]||[]), ...base64List];
    this.update(id, { [key]: imgs });
    this.addHistory(id, 'image', `เพิ่มรูปภาพ${type==='before'?'ก่อน':'หลัง'}ซ่อม ${base64List.length} รูป`);
    return this.getById(id);
  },

  setRating(id, rating, comment) {
    this.update(id, { rating, ratingComment: comment });
    this.addHistory(id, 'rated', `ลูกค้าให้คะแนน ${rating}/5 ⭐`, 'customer');
    return this.getById(id);
  },

  delete(id) { this.saveAll(this.getAll().filter(t => t.id !== id)); },
  deleteAll() { this.saveAll([]); },

  search(q) {
    const lq = q.toLowerCase();
    return this.getAll().filter(t =>
      [t.id, t.name, t.location, t.description, t.phone].some(f => f?.toLowerCase().includes(lq))
    );
  },

  filter({ status, category, priority, technicianId } = {}) {
    return this.getAll().filter(t => {
      if (status       && t.status       !== status)       return false;
      if (category     && t.category     !== category)     return false;
      if (priority     && t.priority     !== priority)     return false;
      if (technicianId && t.technicianId !== technicianId) return false;
      return true;
    });
  },

  stats() {
    const all = this.getAll();
    const avgRating = (() => {
      const rated = all.filter(t => t.rating);
      return rated.length ? (rated.reduce((s,t)=>s+t.rating,0)/rated.length).toFixed(1) : '-';
    })();
    return {
      total:      all.length,
      pending:    all.filter(t => t.status === 'pending').length,
      assigned:   all.filter(t => t.status === 'assigned').length,
      inprogress: all.filter(t => t.status === 'inprogress').length,
      done:       all.filter(t => t.status === 'done').length,
      avgRating,
    };
  },

  /* ─── TECHNICIANS ─── */
  getTechs()  { return JSON.parse(localStorage.getItem(this.KEYS.technicians) || '[]'); },
  saveTechs(d){ localStorage.setItem(this.KEYS.technicians, JSON.stringify(d)); },

  addTech(tech) {
    const techs = this.getTechs();
    const obj = { id: 'TECH-' + Date.now().toString().slice(-5), ...tech, active: true, createdAt: new Date().toISOString() };
    techs.push(obj);
    this.saveTechs(techs);
    return obj;
  },
  getTechById(id) { return this.getTechs().find(t => t.id === id); },
  updateTech(id, patch) {
    const techs = this.getTechs();
    const i = techs.findIndex(t => t.id === id);
    if (i < 0) return null;
    techs[i] = { ...techs[i], ...patch };
    this.saveTechs(techs);
    return techs[i];
  },
  deleteTech(id) { this.saveTechs(this.getTechs().filter(t => t.id !== id)); },

  techWorkload(techId) {
    return this.getAll().filter(t => t.technicianId === techId && t.status !== 'done').length;
  },

  /* ─── SETTINGS ─── */
  getSettings() {
    return JSON.parse(localStorage.getItem(this.KEYS.settings) || JSON.stringify({
      telegramBotToken: '',
      telegramChatId:   '',
      webhookUrl:       '',
      emailjsServiceId: '',
      emailjsTemplateId:'',
      emailjsPublicKey: '',
      googleScriptUrl:  '',
      adminEmail:       '',
      orgName:          'ระบบแจ้งซ่อมออนไลน์',
      notifyOnNew:      true,
      notifyOnAssign:   true,
      notifyOnDone:     true,
      notifyOnRating:   true,
    }));
  },
  saveSettings(s){ localStorage.setItem(this.KEYS.settings, JSON.stringify(s)); },

  /* ─── LABELS ─── */
  statusLabel(s)   { return ({pending:'รอดำเนินการ',assigned:'มอบหมายแล้ว',inprogress:'กำลังซ่อม',done:'ซ่อมเสร็จ',cancelled:'ยกเลิก'})[s]||s; },
  categoryLabel(c) { return ({electrical:'ไฟฟ้า/ระบบไฟ',plumbing:'ประปา/น้ำ',ac:'เครื่องปรับอากาศ',furniture:'เฟอร์นิเจอร์',network:'คอมพิวเตอร์/เครือข่าย',other:'อื่นๆ'})[c]||c; },
  priorityLabel(p) { return ({low:'ปกติ',medium:'ด่วน',high:'เร่งด่วนมาก'})[p]||p; },
};
