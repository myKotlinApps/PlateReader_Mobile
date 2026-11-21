import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";
import { registerRbacRoutes } from "./src/server/rbacRoutes.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize runtime Edge SQLite database from deploy/mobile-edge/edge.sqlite3 template
const TEMPLATE_DB_PATH = path.resolve(__dirname, "deploy/mobile-edge/edge.sqlite3");
const RUNTIME_DB_PATH = path.resolve(__dirname, "deploy/mobile-edge/runtime-edge.sqlite3");
const SCHEMA_SQL_PATH = path.resolve(__dirname, "deploy/mobile-edge/schema.sql");

if (!fs.existsSync(RUNTIME_DB_PATH)) {
  if (fs.existsSync(TEMPLATE_DB_PATH)) {
    fs.copyFileSync(TEMPLATE_DB_PATH, RUNTIME_DB_PATH);
  }
}

const db = new DatabaseSync(RUNTIME_DB_PATH);
if (fs.existsSync(SCHEMA_SQL_PATH)) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='township_domain_v1'")
    .all();
  if (tables.length === 0) {
    db.exec(fs.readFileSync(SCHEMA_SQL_PATH, "utf-8"));
  }
}

const SITE_ID = "shahrak_edge_01";
const MAILBOX_PUB_KEY_HEX =
  "8f40c5adb68f25624ae5b214ea767a6ec94d829d3d7b5e1ad1ba6f3e21c9487a";

function putDomainDoc(collection: string, id: string, data: Record<string, unknown>) {
  const key = `township:${SITE_ID}:${collection}:${id}`;
  const now = Date.now();
  const raw = Buffer.from(JSON.stringify({ ...data, id }), "utf-8");
  db.prepare(
    `INSERT INTO township_domain_v1 (key, scope, collection, site_id, id, revision, deleted, updated_at_ms, raw)
     VALUES (?, 'township', ?, ?, ?, 1, 0, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       revision = township_domain_v1.revision + 1,
       deleted = 0,
       updated_at_ms = excluded.updated_at_ms,
       raw = excluded.raw`
  ).run(key, collection, SITE_ID, id, now, raw);
}

function listDomainDocs<T = Record<string, any>>(collection: string): T[] {
  const rows = db
    .prepare(
      `SELECT raw FROM township_domain_v1
       WHERE scope = 'township' AND collection = ? AND site_id = ? AND deleted = 0
       ORDER BY updated_at_ms DESC`
    )
    .all(collection, SITE_ID) as Array<{ raw: Uint8Array }>;
  return rows.map((r) => JSON.parse(Buffer.from(r.raw).toString("utf-8")) as T);
}

function getDomainDoc<T = Record<string, any>>(collection: string, id: string): T | null {
  const key = `township:${SITE_ID}:${collection}:${id}`;
  const row = db
    .prepare(`SELECT raw FROM township_domain_v1 WHERE key = ? AND deleted = 0`)
    .get(key) as { raw: Uint8Array } | undefined;
  if (!row) return null;
  return JSON.parse(Buffer.from(row.raw).toString("utf-8")) as T;
}

// Seed initial edge records if database is empty
function seedEdgeDatabaseIfEmpty() {
  const existingDirectives = listDomainDocs("guard_directives");
  if (existingDirectives.length > 0) return;

  putDomainDoc("guard_directives", "dir_101", {
    id: "dir_101",
    directiveType: "gate_order",
    subject: "کنترل تردد خودروهای باربری در گیت شمالی",
    body: "ورود کامیونت و وانت‌بار به بلوک‌های A و B پس از ساعت ۲۰ فقط با مجوز کتبی مدیریت شهرک مجاز است.",
    plate_text: "68ب742-21",
    priority: "urgent",
    status: "sent",
    sender_name: "مدیریت شهرک",
    created_at_ms: Date.now() - 3600_000,
  });

  putDomainDoc("guard_directives", "dir_102", {
    id: "dir_102",
    directiveType: "gate_order",
    subject: "هماهنگی ورود مهمان واحد ۱۲ بلوک A",
    body: "خودرو پژو ۲۰۷ سفید با پلاک ثبت‌شده مجوز ورود به پارکینگ مهمان را دارد.",
    plate_text: "12ث345-11",
    priority: "normal",
    status: "sent",
    sender_name: "مدیر بلوک A",
    created_at_ms: Date.now() - 7200_000,
  });

  putDomainDoc("guard_events", "ev_201", {
    id: "ev_201",
    direction: "entry",
    plate_text: "12ث345-11",
    guest_name: "علیرضا هاشمی",
    unit_label: "بلوک A - واحد ۱۲",
    note: "شناسایی خودکار با دوربین گیت اصلی",
    created_at_ms: Date.now() - 1800_000,
  });

  putDomainDoc("guard_events", "ev_202", {
    id: "ev_202",
    direction: "exit",
    plate_text: "44ج891-66",
    guest_name: "مهمان واحد ۵",
    unit_label: "بلوک B - واحد ۵",
    note: "",
    created_at_ms: Date.now() - 900_000,
  });

  putDomainDoc("finance_wallets", "w_1", {
    id: "w_1",
    unitLabel: "بلوک A — واحد ۱۰۱ (مهندس رضایی)",
    balanceRials: 18500000,
    debtRials: 0,
  });

  putDomainDoc("finance_wallets", "w_2", {
    id: "w_2",
    unitLabel: "بلوک A — واحد ۱۰۴ (دکتر محمدی)",
    balanceRials: 4200000,
    debtRials: 7500000,
  });

  putDomainDoc("finance_wallets", "w_3", {
    id: "w_3",
    unitLabel: "بلوک B — واحد ۲۰۳ (خانم کریمی)",
    balanceRials: 12000000,
    debtRials: 0,
  });

  putDomainDoc(" finance_wallets".trim(), "w_4", {
    id: "w_4",
    unitLabel: "بلوک B — واحد ۲۰۸ (آقای حسینی)",
    balanceRials: 0,
    debtRials: 11200000,
  });

  putDomainDoc("letters", "let_301", {
    id: "let_301",
    folder: "inbox",
    subject: "برنامه سرویس دوره‌ای دوربین‌های پلاک‌خوان گیت ورودی",
    summary: "بازبینی لنز و کالیبراسیون روشنایی شب در گیت شمالی و جنوبی",
    sender_title: "مسئول فنی و هوشمندسازی",
    indicator_number: "۱۴۰۵/۱۱۲",
    lifecycle_state: "وارده",
    jalali_date_str: "۱۴۰۵/۰۸/۲۹",
  });

  putDomainDoc("letters", "let_302", {
    id: "let_302",
    folder: "inbox",
    subject: "مصوبه هیئت‌مدیره در خصوص شارژ عمرانی پاییز",
    summary: "ابلاغ جدول زمان‌بندی تسویه شارژ واحدهای بلوک A و B",
    sender_title: "هیئت‌مدیره شهرک",
    indicator_number: "۱۴۰۵/۱۰۹",
    lifecycle_state: "ابلاغ‌شده",
    jalali_date_str: "۱۴۰۵/۰۸/۲۷",
  });

  putDomainDoc("notifications", "notif_1", {
    id: "notif_1",
    title: "دستور انتظامات جدید در گیت شمالی",
    detail: "کنترل تردد خودروهای باربری پس از ساعت ۲۰",
    status: "فوری",
    route: "/m/guard",
  });

  putDomainDoc("notifications", "notif_2", {
    id: "notif_2",
    title: "نامه جدید در کارتابل مدیریت",
    detail: "برنامه سرویس دوره‌ای دوربین‌های پلاک‌خوان گیت ورودی",
    status: "جدید",
    route: "/m/letters",
  });

  putDomainDoc("work_orders", "wo_1", {
    id: "wo_1",
    form_id: "maintenance_req",
    status: "open",
    payload: { title: "تنظیم جک پارکینگ بلوک A" },
  });
}

function seedFacilitiesAndPettyCashIfEmpty() {
  const existingLeaks = listDomainDocs("water_leaks");
  if (existingLeaks.length === 0) {
    putDomainDoc("water_leaks", "TR-8842", {
      id: "TR-8842",
      code: "#TR-8842",
      severity: "critical",
      status: "active",
      block: "بلوک B پردیس نیلوفر",
      floor: "طبقه سوم (واحد‌های ۳۰۱ تا ۳۰۴)",
      zone: "سقف سرویس بهداشتی مستر واحد ۳۰۲",
      riser: "رایزر ۲ جناح غربی",
      valveCode: "V-B2-03-W",
      originUnit: "واحد ۴۰۲ (دکتر فرزاد رادمنش)",
      originResidentPresent: true,
      damagedUnits: ["واحد ۳۰۲ (مهندس جلالی)", "مشاعات پاگرد غربی طبقه ۳"],
      description:
        "از صبح امروز رطوبت شدیدی در سقف کاذب سرویس مستر واحد ۳۰۲ مشاهده شده و گچ سقف تبله کرده است. نشت از شترگلو یا اتصالات کف‌شور واحد ۴۰۲ گزارش شده است.",
      supervisor: "مهندس صابری (ناظر مقیم)",
      eta: "۱۵ دقیقه",
      reportedAt: "امروز ۱۰:۳۵",
      voucherRef: "",
      hasVoiceNote: true,
      voiceDuration: "۰:۲۸",
      photos: [
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDl5idRmNlxP9J9lTwaDNWEIxyR-qCro_l7glX2W7-NIZLkw2imHbeXCrHywjMp4LjGH8_j9z1L70-cZSWcaSkANirDJ8zIvh71VG4OAriKIN4Mj8b62iEnflBnK9PBQ7TLQ9ltEvVmqIMBeTaOYejKY55H9Oq8Mz7qt97KmPwNGLDCYt5Kz7KYNgg6QLPTIzEix-jj6DvmVwwUgIZiMwUV6t5bMHAKX7h1ETDbk6o",
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAoyyIF-kCCd9zdknhVqUDkg3rWCEdP43_F7bVvfKloX4o7wcOoGyVFruMvqLI_0bLm-ddcwoAuSzlzI-o9gk5FzJT6PYngERxxIx_EfhxJ2WoZSkjhd8Sujf8qRorqaT1zataj8ZdJXUTgRQQZwg2-nWNhWDEYiKNAVW-MKdszlVoWo7vofntmi2IEyMV_RInpJYOY8Ztzc9mKuMA8DVNgp9-tLW6j7exBhg6DC3E",
      ],
      timeline: [
        { time: "۱۰:۳۵", title: "ثبت گزارش توسط واحد ۳۰۲", detail: "پیوست ۲ عکس و فایل صوتی ۲۸ ثانیه‌ای" },
        { time: "۱۰:۴۲", title: "قطع شیر فلکه موضعی V-B2-03-W", detail: "هماهنگی با انتظامات و ارسال پیامک به مالک ۴۰۲" },
        { time: "۱۰:۵۰", title: "اعزام ناظر تاسیسات (مهندس صابری)", detail: "تخمین رسیدن به محل: ۱۵ دقیقه" },
      ],
      created_at_ms: Date.now() - 1200_000,
    });

    putDomainDoc("water_leaks", "TR-8815", {
      id: "TR-8815",
      code: "#TR-8815",
      severity: "moderate",
      status: "repairing",
      block: "بلوک B پردیس نیلوفر",
      floor: "طبقه اول (واحد ۱۰۱)",
      zone: "داکت آشپزخانه واحد ۱۰۱",
      riser: "رایزر ۱ شرق",
      valveCode: "V-B-101",
      originUnit: "واحد ۲۰۱ (آقای علوی)",
      originResidentPresent: true,
      damagedUnits: ["واحد ۱۰۱ (آشپزخانه)"],
      description:
        "چکه متناوب از سیفون آشپزخانه واحد ۲۰۱؛ تعویض زانویی پوش‌فیت ۱۱۰ با حضور استاد بهرامی انجام شد و تست فشار ۱۲ ساعته فعال است.",
      supervisor: "استاد بهرامی (تاسیسات شیفت روز)",
      eta: "در حال تست فشار",
      reportedAt: "۲ روز پیش",
      voucherRef: "VCH-402-882",
      hasVoiceNote: false,
      photos: [],
      timeline: [
        { time: "۲ روز پیش", title: "ثبت گزارش چکه داکت آشپزخانه", detail: "تایید اولیه مدیر بلوک" },
        { time: "دیروز", title: "تعویض زانویی پوش‌فیت ۱۱۰", detail: "اجرا توسط استاد بهرامی" },
      ],
      created_at_ms: Date.now() - 172800_000,
    });

    putDomainDoc("water_leaks", "TR-8790", {
      id: "TR-8790",
      code: "#TR-8790",
      severity: "low",
      status: "resolved",
      block: "بلوک B پردیس نیلوفر",
      floor: "مشاعات همکف",
      zone: "کلکتور پاگرد غربی نزدیک فایرباکس F",
      riser: "رایزر آتش‌نشانی F",
      valveCode: "V-F-00",
      originUnit: "مشاعات بلوک B",
      originResidentPresent: true,
      damagedUnits: ["پاگرد غربی همکف"],
      description:
        "افت فشار و رطوبت کلکتور پاگرد غربی نزدیک فایرباکس F • تعویض مغزی شیرفلکه ۱ اینچ و ترمیم گچکاری انجام و تسویه شد.",
      supervisor: "مهندس صابری",
      eta: "مختومه",
      reportedAt: "۵ اسفند",
      voucherRef: "VCH-402-880",
      settledAmountTomans: 850000,
      hasVoiceNote: false,
      photos: [],
      timeline: [
        { time: "۵ اسفند", title: "گزارش رطوبت اطراف فایرباکس", detail: "بازدید ناظر تاسیسات" },
        { time: "۶ اسفند", title: "تایید نهایی و تسویه ۸۵۰,۰۰۰ تومان", detail: "سند VCH-402-880" },
      ],
      created_at_ms: Date.now() - 432000_000,
    });

    putDomainDoc("water_leaks", "TR-8752", {
      id: "TR-8752",
      code: "#TR-8752",
      severity: "low",
      status: "resolved",
      block: "بلوک B پردیس نیلوفر",
      floor: "طبقه اول (واحد ۱۰۴)",
      zone: "درین اسپلیت سالن واحد ۱۰۴",
      riser: "رایزر ۲ جناح غربی",
      valveCode: "V-B2-01-W",
      originUnit: "واحد ۲۰۴",
      originResidentPresent: true,
      damagedUnits: ["واحد ۱۰۴"],
      description:
        "نشتی لوله درین اسپلیت دیواری واحد ۲۰۴ به سقف کناف سالن واحد ۱۰۴؛ رفع گرفتگی لوله و نقاشی مجدد با توافق طرفین انجام شد.",
      supervisor: "سرویس‌کار مجاز",
      eta: "مختومه",
      reportedAt: "۲۸ بهمن",
      voucherRef: "",
      hasVoiceNote: false,
      photos: [],
      timeline: [
        { time: "۲۸ بهمن", title: "توافق طرفین و رفع گرفتگی درین", detail: "پرونده مختومه شد" },
      ],
      created_at_ms: Date.now() - 864000_000,
    });
  }

  const petty = getDomainDoc("petty_cash_state", "block_b_winter");
  if (!petty) {
    putDomainDoc("petty_cash_state", "block_b_winter", {
      id: "block_b_winter",
      scopeTitle: "تنخواه بلوک B (مهندس کاویانی)",
      period: "سه ماهه زمستان ۱۴۰۳",
      approvedCapTomans: 65000000,
      spentTomans: 52850000,
      dailyBurnTomans: 587000,
      runwayDays: 20,
      rebalanced: false,
      categories: [
        {
          id: "cat_pumps",
          title: "تعمیر و نگهداری تاسیسات آبرسانی و پمپ‌ها",
          subtitle: "شامل بوسترپمپ آبرسانی و منبع دیافراگمی",
          icon: "water_pump",
          spentTomans: 18500000,
          budgetTomans: 25000000,
        },
        {
          id: "cat_elevators",
          title: "سرویس ادواری آسانسورها و بالابرها",
          subtitle: "انحراف نامساعد و بیش‌بودجه",
          icon: "elevator",
          spentTomans: 19200000,
          budgetTomans: 18000000,
        },
        {
          id: "cat_lighting",
          title: "روشنایی، سنسورها و برق مشاعات",
          subtitle: "تعویض پروژکتور حیاط و فتوسل‌ها",
          icon: "lightbulb",
          spentTomans: 8350000,
          budgetTomans: 10000000,
        },
        {
          id: "cat_cleaning",
          title: "اقلام مصرفی نظافت، باغبانی و بهداشت",
          subtitle: "شوینده لابی، کود تقویتی و کیسه زباله",
          icon: "cleaning_services",
          spentTomans: 6800000,
          budgetTomans: 12000000,
        },
      ],
      expenses: [
        {
          id: "exp_1",
          title: "اورهال کامل بوسترپمپ B",
          vendor: "شرکت تاسیسات پایتخت • فاکتور VCH-402-882",
          date: "۱۸ بهمن ۱۴۰۳",
          amountTomans: 18500000,
          official: true,
          voucherId: "VCH-402-882",
          icon: "precision_manufacturing",
        },
        {
          id: "exp_2",
          title: "کنتاکتور تابلو برق آسانسور B",
          vendor: "فروشگاه الکترو لاله زار • نقدی تنخواه",
          date: "۲۶ بهمن ۱۴۰۳",
          amountTomans: 4200000,
          official: false,
          icon: "electric_meter",
        },
        {
          id: "exp_3",
          title: "تعویض شیرفلکه آتش‌نشانی",
          vendor: "راهرو طبقه سوم بلوک B • فاکتور عادی",
          date: "۰۴ اسفند ۱۴۰۳",
          amountTomans: 1650000,
          official: false,
          icon: "plumbing",
        },
        {
          id: "exp_4",
          title: "مایع نظافت و پلاستیک زباله",
          vendor: "انباری مشاعات بلوک B • خرید دوره‌ای",
          date: "۱۰ اسفند ۱۴۰۳",
          amountTomans: 1100000,
          official: false,
          icon: "sanitizer",
        },
      ],
      replenishmentRequests: [],
    });
  }
}

seedEdgeDatabaseIfEmpty();
seedFacilitiesAndPettyCashIfEmpty();

// Track whether the default browser session explicitly logged out
let defaultSessionLoggedIn = true;

const FORM_TEMPLATES = [
  {
    id: "maintenance_req",
    title: "گزارش خرابی و تعمیرات",
    section: "forms",
    icon: "wrench",
    fields: [
      {
        name: "category",
        label: "بخش مربوطه",
        type: "select",
        required: true,
        options: ["آسانسور و پله‌برقی", "روشنایی و برق مشاعات", "دوربین پلاک‌خوان و گیت", "تأسیسات و موتورخانه"],
      },
      { name: "location", label: "بلوک / محل دقیق", type: "text", required: true },
      { name: "description", label: "شرح خرابی یا درخواست", type: "textarea", required: true },
    ],
  },
  {
    id: "guest_vehicle_permit",
    title: "مجوز ورود خودرو مهمان",
    section: "forms",
    requires_camera_addon: true,
    icon: "car",
    fields: [
      { name: "guestName", label: "نام مهمان", type: "text", required: true },
      { name: "plateText", label: "پلاک خودرو (مثلاً 12ب345-44)", type: "text", required: true },
      { name: "unitNumber", label: "واحد میزبان", type: "text", required: true },
      {
        name: "duration",
        label: "مدت اعتبار مجوز",
        type: "select",
        required: true,
        options: ["یک نوبت (امروز)", "۲۴ ساعت", "تا پایان هفته"],
      },
    ],
  },
  {
    id: "meter_reading",
    title: "ثبت قرائت کنتور",
    section: "forms",
    icon: "gauge",
    fields: [
      {
        name: "meterType",
        label: "نوع کنتور",
        type: "select",
        required: true,
        options: ["آب مشترک", "برق مشاعات", "گاز موتورخانه"],
      },
      { name: "currReading", label: "عدد فعلی کنتور", type: "number", required: true },
      { name: "note", label: "توضیحات تکمیلی", type: "textarea" },
    ],
  },
];

const ORG_POSITIONS = [
  { id: "pos_township_mgr", title: "مدیرعامل / هیئت‌مدیره شهرک" },
  { id: "pos_block_a_mgr", title: "مدیریت بلوک A" },
  { id: "pos_block_b_mgr", title: "مدیریت بلوک B" },
  { id: "pos_finance_mgr", title: "امور مالی و حسابداری" },
  { id: "pos_tw_guard_chief", title: "سرشیفت انتظامات و گیت پلاک‌خوان" },
  { id: "pos_off_sec_mgr", title: "مدیریت حراست و امنیت" },
];

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "25mb" }));

  // Register full 10-role RBAC & Server-Side NoSQL API routes
  registerRbacRoutes(app, { putDomainDoc });

  // 1. Connect discovery info
  app.get("/api/v1/connect/info", (req, res) => {
    const origin = `${req.protocol}://${req.get("host")}`;
    res.json({
      endpoints: [{ kind: "origin", url: origin, priority: 0 }],
      mailbox_public_key_hex: MAILBOX_PUB_KEY_HEX,
    });
  });

  // 2. Device password login
  app.post("/api/v1/auth/device/login", (req, res) => {
    const { username = "admin", device_name = "گوشی مدیر / انتظامات" } = (req.body || {}) as {
      username?: string;
      password?: string;
      device_name?: string;
    };
    defaultSessionLoggedIn = true;
    const cleanUser = String(username || "admin").trim() || "admin";
    res.json({
      access_token: `edge_tok_${Date.now()}`,
      refresh_token: `edge_ref_${Date.now()}`,
      expires_at_ms: Date.now() + 12 * 3600_000,
      refresh_expires_at_ms: Date.now() + 30 * 86400_000,
      device: {
        id: `dev_${cleanUser}_01`,
        device_name,
      },
      user: {
        id: `usr_${cleanUser}`,
        username: cleanUser,
        display_name: cleanUser === "admin" ? "مدیر ارشد شهرک و انتظامات" : `کاربر (${cleanUser})`,
        role: "admin",
      },
    });
  });

  // 3. Token refresh
  app.post("/api/v1/auth/device/refresh", (_req, res) => {
    defaultSessionLoggedIn = true;
    res.json({
      access_token: `edge_tok_${Date.now()}`,
      refresh_token: `edge_ref_${Date.now()}`,
      expires_at_ms: Date.now() + 12 * 3600_000,
      refresh_expires_at_ms: Date.now() + 30 * 86400_000,
    });
  });

  // 4. QR code pairing redeem
  app.post("/api/v1/connect/qr/redeem", (req, res) => {
    defaultSessionLoggedIn = true;
    const origin = `${req.protocol}://${req.get("host")}`;
    res.json({
      access_token: `edge_qr_tok_${Date.now()}`,
      refresh_token: `edge_qr_ref_${Date.now()}`,
      expires_at_ms: Date.now() + 12 * 3600_000,
      refresh_expires_at_ms: Date.now() + 30 * 86400_000,
      device: {
        id: "dev_qr_01",
        device_name: "گوشی متصل با QR",
      },
      user: {
        id: "usr_guard_chief",
        username: "guard_chief",
        display_name: "افسر ارشد انتظامات و گیت",
        role: "admin",
      },
      connect: {
        endpoints: [{ kind: "origin", url: origin, priority: 0 }],
        mailbox_public_key_hex: MAILBOX_PUB_KEY_HEX,
      },
    });
  });

  // 5. Logout
  app.post("/api/v1/auth/logout", (_req, res) => {
    defaultSessionLoggedIn = false;
    res.json({ ok: true });
  });

  // 6. Push token registration
  app.post("/api/v1/auth/devices/push-token", (req, res) => {
    const { push_token, push_kind, device_id } = (req.body || {}) as Record<string, string>;
    putDomainDoc("push_tokens", device_id || `dev_${Date.now()}`, {
      push_token,
      push_kind,
      device_id,
      updated_at: new Date().toISOString(),
    });
    res.json({ ok: true });
  });

  // 7. Mobile Bootstrap
  app.get("/api/v1/mobile/bootstrap", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!defaultSessionLoggedIn && !authHeader) {
      res.status(401).json({
        error: {
          code: "unauthenticated",
          message: "لطفاً وارد حساب کاربری خود شوید.",
        },
      });
      return;
    }

    const directives = listDomainDocs("guard_directives");
    const unreadDirectives = directives.filter((d) => d.status === "sent").length;
    const workOrders = listDomainDocs("work_orders");
    const waterLeaks = listDomainDocs("water_leaks");
    const activeLeaks = waterLeaks.filter((l) => l.status !== "resolved").length;

    res.json({
      ok: true,
      server_version: "1.9.0",
      site_id: SITE_ID,
      organization_name: "شهرک مسکونی هوشمند نیلوفر و سامانه پلاک‌خوان",
      user: {
        id: "usr_admin",
        username: "admin",
        display_name: "مدیر شهرک و انتظامات",
        role: "admin",
        allowed_block_ids: ["بلوک A", "بلوک B", "گیت اصلی"],
        allowed_menus: ["dashboard", "facilities", "forms", "letters", "finance", "guard", "notifications"],
      },
      permissions: {
        forms: "write",
        letters: "write",
        finance: "write",
        guard: "write",
        facilities: "write",
      },
      license: {
        profile_id: "lic_small_township_alpr",
        scale_tier: "small_township",
        max_blocks: 14,
        max_phases: 3,
        alpr_addon_enabled: true,
        guard_enabled: true,
      },
      mobile_modules: ["facilities", "forms", "letters", "finance", "guard"],
      counters: {
        unread_guard_directives: unreadDirectives,
        open_work_orders: workOrders.length,
        active_leaks: activeLeaks,
      },
    });
  });

  // 8. List Operational Forms
  app.get("/api/v1/mobile/forms", (_req, res) => {
    res.json({ forms: FORM_TEMPLATES });
  });

  // 9. Submit Operational Form
  app.post("/api/v1/mobile/forms/submit", (req, res) => {
    const { form_id, payload, idempotency_key } = (req.body || {}) as {
      form_id?: string;
      payload?: Record<string, unknown>;
      idempotency_key?: string;
    };
    const id = idempotency_key || `wo_${Date.now()}`;
    const record = {
      id,
      form_id: form_id || "maintenance_req",
      payload: payload || {},
      status: "open",
      created_at_ms: Date.now(),
    };
    putDomainDoc("work_orders", id, record);
    res.json({ ok: true, record });
  });

  // 10. Notifications
  app.get("/api/v1/mobile/notifications", (_req, res) => {
    const items = listDomainDocs("notifications");
    res.json({ items });
  });

  // 11. Finance Wallets
  app.get("/api/v1/mobile/finance", (_req, res) => {
    const wallets = listDomainDocs("finance_wallets");
    res.json({ wallets });
  });

  // 12. Guard Summary (Directives, Entry/Exit Events, Guest Permits, Incidents)
  app.get("/api/v1/mobile/guard/summary", (_req, res) => {
    res.json({
      guard_enabled: true,
      directives: listDomainDocs("guard_directives"),
      recent_events: listDomainDocs("guard_events"),
      guest_permits: listDomainDocs("guest_permits"),
      incidents: listDomainDocs("guard_incidents"),
    });
  });

  // 13. Send Guard Directive
  app.post("/api/v1/mobile/guard/directives", (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const id = `dir_${Date.now()}`;
    const directive = {
      id,
      directiveType: body.directiveType || "gate_order",
      subject: String(body.subject || "دستور انتظامات"),
      body: String(body.body || ""),
      plate_text: String(body.plateText || body.plate_text || ""),
      priority: String(body.priority || "urgent"),
      status: "sent",
      sender_name: "مدیر شهرک",
      created_at_ms: Date.now(),
    };
    putDomainDoc("guard_directives", id, directive);
    res.json({ ok: true, directive });
  });

  // 14. Acknowledge / Complete Guard Directive
  app.post("/api/v1/mobile/guard/directives/:id/ack", (req, res) => {
    const { id } = req.params;
    const { status = "acknowledged", note = "" } = (req.body || {}) as {
      status?: "acknowledged" | "completed";
      note?: string;
    };
    const existing = getDomainDoc("guard_directives", id);
    if (!existing) {
      res.status(404).json({ error: { message: "دستور مورد نظر یافت نشد." } });
      return;
    }
    const updated = {
      ...existing,
      status,
      ack_note: note,
      ack_by_name: "افسر نگهبانی گیت",
      ack_at_ms: Date.now(),
    };
    putDomainDoc("guard_directives", id, updated);
    res.json({ ok: true, directive: updated });
  });

  // 15. Record Guard Entry/Exit
  app.post("/api/v1/mobile/guard/entry-exit", (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const id = String(body.idempotency_key || `ev_${Date.now()}`);
    const event = {
      id,
      direction: body.direction === "exit" ? "exit" : "entry",
      plate_text: String(body.plate_text || ""),
      guest_name: String(body.guest_name || ""),
      unit_label: String(body.unit_label || ""),
      note: String(body.note || ""),
      has_photo: Boolean(body.photo_base64),
      created_at_ms: Date.now(),
    };
    putDomainDoc("guard_events", id, event);
    res.json({ ok: true, event });
  });

  // 16. Report Guard Incident
  app.post("/api/v1/mobile/guard/incidents", (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const id = `inc_${Date.now()}`;
    const incident = {
      id,
      title: String(body.title || ""),
      description: String(body.description || ""),
      location: String(body.location || ""),
      severity: String(body.severity || "high"),
      has_photo: Boolean(body.photo_base64),
      created_at_ms: Date.now(),
    };
    putDomainDoc("guard_incidents", id, incident);
    putDomainDoc("notifications", `notif_${id}`, {
      id: `notif_${id}`,
      title: `گزارش حادثه: ${incident.title}`,
      detail: `${incident.location ? incident.location + " — " : ""}${incident.description}`,
      status: "حادثه",
      route: "/m/guard",
    });
    res.json({ ok: true, incident });
  });

  // 17. Correspondence Bootstrap & Cartable
  app.get("/api/v1/correspondence/bootstrap", (_req, res) => {
    res.json({
      org_positions: ORG_POSITIONS,
    });
  });

  app.get("/api/v1/correspondence/cartable", (req, res) => {
    const folder = req.query.folder === "sent" ? "sent" : "inbox";
    const allLetters = listDomainDocs("letters");
    const items = allLetters.filter((l) => (l.folder || "inbox") === folder);
    res.json({ items });
  });

  app.post("/api/v1/correspondence/letters", (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const id = `let_${Date.now()}`;
    const recipients = Array.isArray(body.recipients) ? body.recipients : [];
    const targetPosId = recipients[0]?.target_position_id;
    const targetTitle =
      ORG_POSITIONS.find((p) => p.id === targetPosId)?.title || "واحد گیرنده";
    const letter = {
      id,
      folder: "sent",
      subject: String(body.subject || ""),
      summary: String(body.body_plain_text || ""),
      sender_title: `به: ${targetTitle}`,
      indicator_number: `۱۴۰۵/${Math.floor(120 + Math.random() * 800)}`,
      lifecycle_state: "ارسال‌شده",
      jalali_date_str: "۱۴۰۵/۰۸/۳۰",
    };
    putDomainDoc("letters", id, letter);
    // Also mirror in inbox so user can see it immediately in cartable
    putDomainDoc("letters", `${id}_in`, {
      ...letter,
      id: `${id}_in`,
      folder: "inbox",
      lifecycle_state: "ثبت‌شده",
    });
    res.json({ ok: true, letter });
  });

  // 18. Confirm unit charge payment (Stitch _2 & _4)
  app.post("/api/v1/mobile/finance/pay", (req, res) => {
    const { wallet_id } = (req.body || {}) as { wallet_id?: string };
    if (!wallet_id) {
      res.status(400).json({ error: { message: "شناسه واحد مشخص نشده است." } });
      return;
    }
    const existing = getDomainDoc("finance_wallets", wallet_id);
    if (!existing) {
      res.status(404).json({ error: { message: "پرونده مالی واحد یافت نشد." } });
      return;
    }
    const paidAmount = Number(existing.debtRials || 0) || 18500000;
    const updated = {
      ...existing,
      debtRials: 0,
      balanceRials: Number(existing.balanceRials || 0) + paidAmount,
      lastPaidAt: "۱۴۰۵/۰۸/۳۰",
    };
    putDomainDoc("finance_wallets", wallet_id, updated);
    res.json({ ok: true, wallet: updated });
  });

  // 19. Send SMS debt reminder (Stitch _2 & _4)
  app.post("/api/v1/mobile/finance/remind", (req, res) => {
    const { unit_label } = (req.body || {}) as { unit_label?: string };
    const id = `notif_sms_${Date.now()}`;
    putDomainDoc("notifications", id, {
      id,
      title: `پیامک یادآوری شارژ ارسال شد`,
      detail: `پیامک لینک پرداخت شارژ برای «${unit_label || "واحد بدهکار"}» ارسال گردید.`,
      status: "مالی",
      route: "/m/finance",
    });
    res.json({ ok: true });
  });

  // 20. Letter Referral & Annotation (Stitch _12)
  app.post("/api/v1/correspondence/refer", (req, res) => {
    const { letter_number, recipient_name, action_type, annotation } = (req.body || {}) as Record<
      string,
      string
    >;
    const id = `let_ref_${Date.now()}`;
    const letter = {
      id,
      folder: "inbox",
      subject: `ارجاع نامه ${letter_number || "NL-B-1402"} — ${action_type || "جهت اقدام فوری"}`,
      summary: `${ recipient_name ? "گیرنده ارجاع: " + recipient_name + " | " : "" }هامش: ${annotation || "لطفا در اسرع وقت بررسی و اقدام شود."}`,
      sender_title: `هامش مدیریت (${recipient_name || "کمیته فنی"})`,
      indicator_number: letter_number || "NL-B-1402",
      lifecycle_state: "ارجاع‌شده",
      jalali_date_str: "۱۴۰۵/۰۸/۳۰",
    };
    putDomainDoc("letters", id, letter);
    res.json({ ok: true, letter });
  });

  // 21. Water Leak Incidents & Facilities API (Stitch _16, _17, _18)
  app.get("/api/v1/mobile/leaks", (_req, res) => {
    const items = listDomainDocs("water_leaks");
    res.json({ items });
  });

  app.post("/api/v1/mobile/leaks", (req, res) => {
    const body = (req.body || {}) as Record<string, any>;
    const numCode = Math.floor(8850 + Math.random() * 900);
    const id = `TR-${numCode}`;
    const riser = String(body.riser || "رایزر ۲ جناح غربی");
    const valveCode = String(body.valveCode || "V-B2-03-W");
    const originUnit = String(body.originUnit || "واحد ۴۰۲ (دکتر فرزاد رادمنش)");
    const zone = String(body.zone || "سقف سرویس بهداشتی مستر");
    const floor = String(body.floor || "طبقه سوم");

    const leak = {
      id,
      code: `#${id}`,
      severity: String(body.severity || "moderate"),
      status: "active",
      block: String(body.block || "بلوک B پردیس نیلوفر"),
      floor,
      zone,
      riser,
      valveCode,
      originUnit,
      originResidentPresent: body.originResidentPresent !== false,
      damagedUnits: Array.isArray(body.damagedUnits) && body.damagedUnits.length > 0
        ? body.damagedUnits
        : ["واحد ۳۰۲ (گزارش‌دهنده)"],
      description: String(body.description || "گزارش نشت و رطوبت ثبت‌شده توسط ساکن/مدیر"),
      supervisor: "مهندس صابری (ناظر مقیم)",
      eta: body.severity === "critical" ? "اعزام فوری (۱۰ دقیقه)" : "بررسی تا ۳۰ دقیقه",
      reportedAt: "هم‌اکنون",
      voucherRef: "",
      hasVoiceNote: Boolean(body.hasVoiceNote),
      voiceDuration: body.hasVoiceNote ? "۰:۱۸" : "",
      photos: Array.isArray(body.photos) ? body.photos : [],
      timeline: [
        {
          time: "هم‌اکنون",
          title: `ثبت پرونده نشتی #${id}`,
          detail: `${floor} — ${zone} (${riser})`,
        },
      ],
      created_at_ms: Date.now(),
    };

    putDomainDoc("water_leaks", id, leak);

    // Cross-module wiring: Notification + Guard Directive if requested
    if (body.notifyOriginSms) {
      putDomainDoc("notifications", `notif_leak_${id}`, {
        id: `notif_leak_${id}`,
        title: `هشدار نشت آب #${id} (${zone})`,
        detail: `پیامک هشدار برای مالک ${originUnit} و تیکت برای مهندس صابری ارسال شد.`,
        status: body.severity === "critical" ? "بحرانی" : "تاسیسات",
        route: "/m/facilities",
      });
    }

    if (body.requestGuardValve) {
      const dirId = `dir_valve_${Date.now()}`;
      putDomainDoc("guard_directives", dirId, {
        id: dirId,
        directiveType: "valve_shutoff",
        subject: `بستن فوری شیر فلکه ${valveCode} (${riser})`,
        body: `به دلیل حادثه نشتی #${id} در ${floor} (${zone})، لطفاً شیر فلکه ${valveCode} را به مدت ۱ ساعت ببندید و به مهندس صابری اطلاع دهید.`,
        plate_text: "",
        priority: "immediate",
        status: "sent",
        sender_name: "سامانه حوادث تاسیسات (بلوک B)",
        created_at_ms: Date.now(),
      });
    }

    res.json({ ok: true, leak });
  });

  app.post("/api/v1/mobile/leaks/:id/status", (req, res) => {
    const { id } = req.params;
    const { status, note, voucherRef } = (req.body || {}) as {
      status?: "active" | "repairing" | "resolved";
      note?: string;
      voucherRef?: string;
    };
    const existing = getDomainDoc<Record<string, any>>("water_leaks", id);
    if (!existing) {
      res.status(404).json({ error: { message: "پرونده حادثه یافت نشد." } });
      return;
    }
    const nextStatus = status || existing.status;
    const statusFa =
      nextStatus === "resolved"
        ? "رفع شده و مختومه"
        : nextStatus === "repairing"
          ? "در حال تعمیر و تست فشار"
          : "نشت فعال / بحرانی";
    const timeline = Array.isArray(existing.timeline) ? [...existing.timeline] : [];
    timeline.unshift({
      time: "هم‌اکنون",
      title: `تغییر وضعیت به «${statusFa}»`,
      detail: note || "به‌روزرسانی توسط مدیر بلوک / ناظر تاسیسات",
    });
    const updated = {
      ...existing,
      status: nextStatus,
      eta: nextStatus === "resolved" ? "مختومه" : nextStatus === "repairing" ? "تست فشار فعال" : "اعزام فوری",
      voucherRef: voucherRef !== undefined ? voucherRef : existing.voucherRef,
      timeline,
    };
    putDomainDoc("water_leaks", id, updated);
    res.json({ ok: true, leak: updated });
  });

  // 22. Petty Cash & Budget Analytics API (Stitch _15)
  app.get("/api/v1/mobile/petty-cash", (_req, res) => {
    const state = getDomainDoc("petty_cash_state", "block_b_winter");
    res.json({ data: state });
  });

  app.post("/api/v1/mobile/petty-cash/replenish", (req, res) => {
    const { amountTomans, reason } = (req.body || {}) as {
      amountTomans?: number;
      reason?: string;
    };
    const state = getDomainDoc<Record<string, any>>("petty_cash_state", "block_b_winter");
    const amt = Math.max(1000000, Number(amountTomans || 15000000));
    const reqItem = {
      id: `PCR-${Math.floor(400 + Math.random() * 500)}`,
      amountTomans: amt,
      reason: String(reason || "تامین نقدینگی تنخواه تاسیسات و هزینه‌های جاری بلوک B"),
      date: "هم‌اکنون",
      status: "ارسال‌شده به خزانه‌دار",
    };
    if (state) {
      const list = Array.isArray(state.replenishmentRequests) ? state.replenishmentRequests : [];
      state.replenishmentRequests = [reqItem, ...list];
      putDomainDoc("petty_cash_state", "block_b_winter", state);
    }
    // Also mirror as a letter in correspondence inbox so manager & treasurer see it
    putDomainDoc("letters", `let_pcr_${Date.now()}`, {
      id: `let_pcr_${Date.now()}`,
      folder: "inbox",
      subject: `درخواست شارژ تنخواه بلوک B به مبلغ ${amt.toLocaleString("fa-IR")} تومان`,
      summary: reqItem.reason,
      sender_title: "مهندس کاویانی (تنخواه‌گردان بلوک B)",
      indicator_number: reqItem.id,
      lifecycle_state: "در انتظار تایید خزانه‌دار",
      jalali_date_str: "۱۴۰۵/۰۸/۳۰",
    });
    res.json({ ok: true, request: reqItem, data: state });
  });

  app.post("/api/v1/mobile/petty-cash/rebalance", (_req, res) => {
    const state = getDomainDoc<Record<string, any>>("petty_cash_state", "block_b_winter");
    if (state && !state.rebalanced && Array.isArray(state.categories)) {
      state.categories = state.categories.map((c: Record<string, any>) => {
        if (c.id === "cat_pumps") {
          return { ...c, budgetTomans: Number(c.budgetTomans) - 1200000 };
        }
        if (c.id === "cat_elevators") {
          return {
            ...c,
            budgetTomans: Number(c.budgetTomans) + 1200000,
            subtitle: "متعادل‌شده با سند اصلاحی متمم از محل صرفه‌جویی تاسیسات",
          };
        }
        return c;
      });
      state.rebalanced = true;
      putDomainDoc("petty_cash_state", "block_b_winter", state);
    }
    res.json({ ok: true, data: state });
  });

  // 22b. Smart Bank Reconciliation API (Stitch _20)
  app.get("/api/v1/mobile/finance/reconciliation", (_req, res) => {
    const existing = getDomainDoc<Record<string, any>>("bank_reconciliation", "aban_1403");
    if (existing) {
      res.json({ data: existing });
      return;
    }
    const seed = {
      id: "aban_1403",
      blockTitle: "بلوک B پردیس نیلوفر (۲۴ واحد)",
      period: "دوره آبان ۱۴۰۳",
      fileName: "Bank_Statement_Aban_1403.xlsx",
      smartCentEnabled: true,
      closed: false,
      expenses: [
        {
          id: "rexp_1",
          title: "تعمیر برد آسانسور بلوک B",
          subtitle: "فاکتور رسمی شرکت البرز + عکس قطعه",
          amountTomans: 4200000,
          photoUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuBfbhl0MY_Z-8bFMSCKExjGIbSzMTeuF1lZK7SxQ0BMsMxa6v1igz-K-zn6Z5w5ppXJ7GEu2TlwYj2ZIfXUTWR3K_djtPimwaJphaMRFt2j_eN5zPnaN8wJiBMZu_KyewVrp-EVga_Zu-vBKJJMqlel1PD-eIxAEo1xqpDkPMT1cZZ9LBBKwN8VOq9JUPbyR9zYY3jad60MjYYpP-hswsh_SWDFXb0EeolZLAPwxTI",
        },
        {
          id: "rexp_2",
          title: "سرویس ماهانه پمپ و موتورخانه",
          subtitle: "برگه تأیید سرویسکار و فاکتور",
          amountTomans: 3500000,
          photoUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuAYFR7KmVVhCBD2nYdReG1zP3SORheeLnwt3fVDfCXJnD2cY3uAObVRM_hxxo5-8X4USF7rfvo-Wm5MTi5tFK_vJApW90gxgBKyNQ5FisaMq-Y0Brz5iaFwYmJ07WovdDDeYDwiy1UrTmYy7Z44_G2pwH6lA4xm_mKJ3rUtXGbhKOLfIbvLzZNNAq7VUHHeuypRyUdCjP4yTqyZb0nVoUyLmQSWn8KNuJ_cuZ2fw-8",
        },
        {
          id: "rexp_3",
          title: "شوینده و نظافت پاگردها",
          subtitle: "رسید خرید فروشگاهی هایپرمارکت",
          amountTomans: 1200000,
          photoUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuCE_1PxyHDIngUrby1EDo131-myTaVccKtHLR6nNoYqjlpWykMNaoDH2HpG74e6rFxJyRLr0Z0YOxrLp-fGvzK1Qm6IIhp1N3egxWaETijD2j_z8doaeM9lf86AAlBZ4bm1fukAd5wLly6zi0zYSnt0yeT23_Pq2ZeJNm3c73jCaEAr_Jb1RhlMrWHNlc5Ou2YJF21164iTvR1FXCkV_ZEnxZI5V2PX8uMegacCwcE",
        },
      ],
      units: [
        {
          id: "ru_101",
          unitNo: "۱۰۱",
          resident: "آقای علوی",
          meta: "۳ نفر • ۹۵ متر",
          centCode: 1,
          chargeTomans: 1450001,
          paidTomans: 1450001,
          status: "matched",
          bankTrace: "واریز بانک ملت • پیگیری: ۶۴۸۲۹۱ • ۵ آبان",
        },
        {
          id: "ru_102",
          unitNo: "۱۰۲",
          resident: "خانم کریمی",
          meta: "۲ نفر • ۹۵ متر",
          centCode: 2,
          chargeTomans: 1330002,
          paidTomans: 1330002,
          status: "matched",
          bankTrace: "انتقال پایا • شماره ارجاع: ۸۸۲۳۱۰ • ۶ آبان",
        },
        {
          id: "ru_203",
          unitNo: "۲۰۳",
          resident: "دکتر رادمنش",
          meta: "۴ نفر • ۱۴۰ متر",
          centCode: 3,
          chargeTomans: 1850003,
          paidTomans: 0,
          status: "pending",
          bankTrace: "تراکنشی با شناسه ۳ در پرینت یافت نشد",
        },
        {
          id: "ru_204",
          unitNo: "۲۰۴",
          resident: "مهندس شریفی",
          meta: "۳ نفر • ۱۲۰ متر",
          centCode: 4,
          chargeTomans: 1580004,
          paidTomans: 1500000,
          status: "mismatch",
          bankTrace: "واریز مبلغ رند ۱,۵۰۰,۰۰۰ تومان (بدون شناسه ۴) • کسری: ۸۰,۰۰۴ تومان",
        },
      ],
    };
    putDomainDoc("bank_reconciliation", "aban_1403", seed);
    res.json({ data: seed });
  });

  app.post("/api/v1/mobile/finance/reconciliation/action", (req, res) => {
    const body = (req.body || {}) as {
      action?: "run_auto" | "resolve_unit" | "add_expense" | "close_period";
      unitId?: string;
      expenseTitle?: string;
      expenseAmount?: number;
      fileName?: string;
    };
    const state = getDomainDoc<Record<string, any>>("bank_reconciliation", "aban_1403");
    if (!state) {
      res.status(404).json({ error: { message: "دوره تطبیق یافت نشد." } });
      return;
    }
    if (body.action === "run_auto") {
      if (body.fileName) state.fileName = body.fileName;
      state.units = (state.units || []).map((u: Record<string, any>) =>
        u.status === "pending" && u.id === "ru_203"
          ? {
              ...u,
              status: "matched",
              paidTomans: u.chargeTomans,
              bankTrace: `تطبیق خودکار شناسه ${u.centCode} • بانک ملت • پیگیری: ۷۷۴۱۹۲ • هم‌اکنون`,
            }
          : u
      );
    } else if (body.action === "resolve_unit" && body.unitId) {
      state.units = (state.units || []).map((u: Record<string, any>) =>
        u.id === body.unitId
          ? {
              ...u,
              status: "matched",
              paidTomans: u.chargeTomans,
              bankTrace: "تطبیق دستی توسط مدیر و انتقال مانده کسری به دوره بعد",
            }
          : u
      );
    } else if (body.action === "add_expense" && body.expenseTitle) {
      const amt = Math.max(50000, Number(body.expenseAmount || 500000));
      state.expenses = [
        {
          id: `rexp_${Date.now()}`,
          title: body.expenseTitle,
          subtitle: "فاکتور ثبت‌شده توسط مدیر بلوک B",
          amountTomans: amt,
          photoUrl: "",
        },
        ...(state.expenses || []),
      ];
    } else if (body.action === "close_period") {
      state.closed = true;
      putDomainDoc("notifications", `notif_rec_close_${Date.now()}`, {
        id: `notif_rec_close_${Date.now()}`,
        title: "صورت‌حساب دوره آبان بلوک B بسته شد",
        detail: "تطبیق هوشمند بانکی تایید نهایی و آماده چاپ پوستر تابلوی لابی شد.",
        status: "مالی",
        route: "/m/finance?tab=lobby",
      });
    }
    putDomainDoc("bank_reconciliation", "aban_1403", state);
    res.json({ ok: true, data: state });
  });

  // 23. Google Stitch Design System & 20 Screens API (/design/stitch/_1 .. _20)
  const STITCH_SCREENS_META = [
    { id: "_1", num: 1, title: "داشبورد جامع مدیریت مجتمع (نمای دسکتاپ)", category: "desktop", badge: "Desktop Command", tab: "dashboard?view=overview" },
    { id: "_2", num: 2, title: "حسابداری شارژ و صندوق مجتمع", category: "finance", badge: "Charge Accounting", tab: "finance?tab=charge" },
    { id: "_3", num: 3, title: "داشبورد موبایل مدیر مجتمع نیلوفر", category: "mobile", badge: "Mobile Home", tab: "dashboard?view=mobile" },
    { id: "_4", num: 4, title: "مدیریت بلوک‌ها، واحدها و پلاک خودروها", category: "finance", badge: "Units & Blocks", tab: "finance?tab=units" },
    { id: "_5", num: 5, title: "شیفت و نگهبانی و گیت پلاک‌خوان", category: "guard", badge: "Guard & ALPR", tab: "guard?tab=gate" },
    { id: "_6", num: 6, title: "میز کار تخصصی حسابدار مجتمع", category: "desktop", badge: "Accountant Desk", tab: "finance?tab=accountant" },
    { id: "_7", num: 7, title: "پنل مدیریت عالی و راهبردی شهرک", category: "desktop", badge: "Executive Panel", tab: "dashboard?view=executive" },
    { id: "_8", num: 8, title: "تنظیم و صدور مصوبه قانونی هیئت‌مدیره", category: "forms", badge: "Board Resolution", tab: "forms?mode=resolution" },
    { id: "_9", num: 9, title: "صدور دعوت‌نامه رسمی مجمع عمومی", category: "forms", badge: "General Assembly", tab: "forms?mode=assembly" },
    { id: "_10", num: 10, title: "ارتباط مدیر بلوک با شهرک و انتظامات", category: "letters", badge: "Block Correspondence", tab: "letters?view=cartable" },
    { id: "_11", num: 11, title: "جزئیات نامه اداری و گردش کار ۴ مرحله‌ای", category: "letters", badge: "Letter Workflow", tab: "letters?view=detail" },
    { id: "_12", num: 12, title: "ارجاع و هامش اداری نامه", category: "letters", badge: "Referral & Note", tab: "letters?view=referral" },
    { id: "_13", num: 13, title: "جزئیات سند پرداخت و حواله پایا (VCH-402-882)", category: "finance", badge: "Payment Voucher", tab: "finance?tab=voucher" },
    { id: "_14", num: 14, title: "پیش‌نمایش چاپ سربرگ رسمی A4 دبیرخانه", category: "letters", badge: "Official A4 Print", tab: "letters?view=print" },
    { id: "_15", num: 15, title: "گزارش تحلیلی تنخواه و انحراف بودجه", category: "finance", badge: "Petty Cash Analytics", tab: "finance?tab=petty" },
    { id: "_16", num: 16, title: "آرشیو نقشه‌های As-Built و شناسنامه فنی بلوک", category: "facilities", badge: "Blueprints & Risers", tab: "facilities?tab=blueprints" },
    { id: "_17", num: 17, title: "ثبت گزارش نشتی آب و رطوبت (TR-8842)", category: "facilities", badge: "Leak Incident Form", tab: "facilities?tab=report" },
    { id: "_18", num: 18, title: "کارتابل حوادث تاسیساتی و نشتی آب", category: "facilities", badge: "Leaks Cartable", tab: "facilities?tab=leaks" },
    { id: "_19", num: 19, title: "گزارش چاپی تراز شارژ لابی (پوستر A4 اعلانات)", category: "finance", badge: "Lobby A4 Poster", tab: "finance?tab=lobby" },
    { id: "_20", num: 20, title: "محاسبه شارژ و تطبیق هوشمند بانکی (Smart Cent)", category: "finance", badge: "Smart Reconciliation", tab: "finance?tab=reconcile" },
  ];

  app.get("/api/v1/stitch/screens", (_req, res) => {
    const designMdPath = path.resolve(
      __dirname,
      "design/stitch/chargeplus_residential_system/DESIGN.md"
    );
    const designMd = fs.existsSync(designMdPath)
      ? fs.readFileSync(designMdPath, "utf-8")
      : "";
    const screens = STITCH_SCREENS_META.map((s) => ({
      ...s,
      hasImage: fs.existsSync(path.resolve(__dirname, "design/stitch", s.id, "screen.png")),
    }));
    res.json({ screens, designMd });
  });

  app.get("/api/v1/stitch/screen/:id", (req, res) => {
    const cleanId = String(req.params.id || "_1").replace(/[^_0-9]/g, "");
    const htmlPath = path.resolve(__dirname, "design/stitch", cleanId, "code.html");
    if (!fs.existsSync(htmlPath)) {
      res.status(404).send("Stitch screen not found");
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(htmlPath);
  });

  app.get("/api/v1/stitch/image/:id", (req, res) => {
    const cleanId = String(req.params.id || "_1").replace(/[^_0-9]/g, "");
    const imgPath = path.resolve(__dirname, "design/stitch", cleanId, "screen.png");
    if (!fs.existsSync(imgPath)) {
      res.status(404).send("Stitch image not found");
      return;
    }
    res.sendFile(imgPath);
  });

  const distPath = path.resolve(__dirname, "dist");
  const isProd = process.env.NODE_ENV === "production" && fs.existsSync(distPath);

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PlateReader_Mobile Edge server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
