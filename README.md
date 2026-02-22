# 🔧 ระบบแจ้งซ่อมออนไลน์ v2

ระบบแจ้งซ่อมออนไลน์ที่สมบูรณ์ — ไม่ต้องการ Backend Server ทำงานได้ทันทีบน GitHub Pages!

## ✨ ฟีเจอร์ทั้งหมด

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| 📋 แจ้งซ่อมออนไลน์ | แบบฟอร์มครบ + แนบรูปภาพก่อนซ่อม |
| 👷 ระบบมอบหมายช่าง | เพิ่ม/แก้ไขช่าง, ดู Workload, มอบหมายงาน |
| 📷 รูปภาพก่อน-หลัง | ช่างแนบรูปหลังซ่อมได้จากหน้าช่าง |
| ⭐ แบบประเมินความพึงพอใจ | 5 ดาว + ความคิดเห็น |
| 📱 Telegram Bot | แจ้งเตือนทุก event อัตโนมัติ |
| 🔗 Webhook | ส่ง JSON ไปยัง Zapier, n8n, Make.com |
| 📧 Gmail Action | กดปุ่ม Accept/Close ใน Email ได้เลย |
| 🔍 ตรวจสอบสถานะ | ค้นหาด้วยหมายเลขหรือชื่อ |
| 📊 Export CSV | ดาวน์โหลดข้อมูลทั้งหมด |

## 🗂️ โครงสร้างโปรเจค

```
repair-system/
├── index.html              # หน้าแจ้งซ่อม (ผู้ใช้)
├── status.html             # ตรวจสอบสถานะ + ประเมิน
├── README.md
├── js/
│   ├── db.js               # Database Layer (localStorage)
│   └── notify.js           # Notification Service (TG/Webhook/Gmail)
├── admin/
│   └── index.html          # Admin Panel ครบ
├── technician/
│   └── index.html          # หน้าช่าง (Login + จัดการงาน)
├── gas/
│   └── Code.gs             # Google Apps Script สำหรับ Gmail
└── .github/workflows/
    └── deploy.yml          # Auto Deploy GitHub Pages
```

---

## 🚀 วิธีติดตั้งบน GitHub Pages

```bash
git clone https://github.com/yourusername/repair-system.git
cd repair-system
git add . && git commit -m "Initial commit"
git push origin main
```

จากนั้นไปที่ **Settings → Pages → Branch: main → Save**

เปิดได้ที่: `https://yourusername.github.io/repair-system/`

---

## 📱 ตั้งค่า Telegram Bot

1. ค้นหา **@BotFather** ใน Telegram
2. พิมพ์ `/newbot` → ตั้งชื่อ Bot
3. คัดลอก **Bot Token** (รูปแบบ `123456789:AABBCCddEE...`)
4. เพิ่ม Bot เข้ากลุ่ม admin หรือส่งข้อความหา Bot ก่อน
5. เปิด URL เพื่อหา Chat ID:
   ```
   https://api.telegram.org/bot[TOKEN]/getUpdates
   ```
6. คัดลอก `chat.id` (กลุ่มจะขึ้นต้นด้วย `-100`)
7. ไปที่ **Admin Panel → ตั้งค่า → Telegram Bot** → กรอก Token + Chat ID
8. กด **ทดสอบ Telegram** เพื่อยืนยัน

---

## 🔗 ตั้งค่า Webhook

รองรับ:
- **Zapier**: สร้าง Zap → Trigger: Webhooks by Zapier → Catch Hook
- **n8n**: Webhook node → ตั้ง HTTP Method: POST
- **Make.com**: Custom webhook → สร้าง URL
- **Discord**: Webhook URL ของ Discord channel

**Payload ที่ส่งไป:**
```json
{
  "event": "pending",
  "ticket": {
    "id": "REP-123456",
    "name": "สมชาย",
    "phone": "081-234-5678",
    "location": "ห้อง 301",
    "category": "ไฟฟ้า/ระบบไฟ",
    "priority": "เร่งด่วนมาก",
    "status": "รอดำเนินการ",
    "technician": "ช่างสมศักดิ์",
    "rating": null,
    "note": ""
  },
  "timestamp": "2025-01-01T10:00:00.000Z"
}
```

---

## 📧 ตั้งค่า Gmail via Google Apps Script

### ฟีเจอร์พิเศษ:
- ผู้รับ Email สามารถ **กดปุ่มในอีเมล** เพื่อรับงาน/ปิดงานได้เลย!
- Email จะส่งให้ Admin เมื่อมีงานใหม่, มอบหมายแล้ว, เสร็จแล้ว
- Email จะส่งให้ลูกค้าเมื่องานเสร็จ พร้อมลิงก์ประเมิน

### ขั้นตอน:
1. ไปที่ [script.google.com](https://script.google.com) → **New Project**
2. วาง code จากไฟล์ `gas/Code.gs`
3. แก้ไขบรรทัด `const SITE_URL = '...'` ให้ตรงกับ URL ของคุณ
4. กด **Deploy → New deployment → Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy **Web App URL** → ไปวางใน Admin Panel → ตั้งค่า → Google Script URL
6. ทดสอบโดยส่งคำขอแจ้งซ่อมใหม่ แล้วเช็ค Gmail!

---

## 📊 Database Schema

ข้อมูลเก็บใน `localStorage` ของเบราว์เซอร์:

```json
{
  "id": "REP-123456",
  "name": "สมชาย ใจดี",
  "phone": "081-234-5678",
  "email": "somchai@email.com",
  "location": "ห้อง 301 อาคาร A",
  "category": "electrical",
  "priority": "high",
  "description": "ไฟในห้องดับ",
  "status": "done",
  "technicianId": "TECH-12345",
  "imagesBefore": ["data:image/jpeg;base64,..."],
  "imagesAfter": ["data:image/jpeg;base64,..."],
  "rating": 5,
  "ratingComment": "ช่างเก่งมาก",
  "assignedAt": "2025-01-01T11:00:00.000Z",
  "startedAt": "2025-01-01T11:30:00.000Z",
  "closedAt": "2025-01-01T14:00:00.000Z",
  "createdAt": "2025-01-01T10:00:00.000Z",
  "history": [
    {"action": "created", "date": "...", "note": "สร้างคำขอ", "by": "system"},
    {"action": "assigned", "date": "...", "note": "มอบหมายให้ช่างสมศักดิ์", "by": "admin"},
    {"action": "done", "date": "...", "note": "ซ่อมเสร็จ", "by": "technician"}
  ]
}
```

---

## 🔔 เงื่อนไขการแจ้งเตือน

| Event | Telegram | Webhook | Gmail |
|-------|----------|---------|-------|
| มีงานใหม่ | ✅ | ✅ | ✅ ส่งหา Admin |
| มอบหมายช่าง | ✅ | ✅ | ✅ ส่งหา Admin + ช่าง |
| ช่างรับงาน | ✅ | ✅ | ✅ |
| งานเสร็จ | ✅ | ✅ | ✅ ส่งหาลูกค้า + Admin |
| ลูกค้าให้คะแนน | ✅ | ✅ | ✅ |

---

## 📝 License

MIT License — ใช้ได้ฟรีสำหรับทุกวัตถุประสงค์
