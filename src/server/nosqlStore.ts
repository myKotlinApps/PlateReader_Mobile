import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RbacUserRecord, UserRoleId } from '../mobile/rbac/roles';
import { INITIAL_JOURNAL_ENTRIES, INITIAL_SAYADI_CHECKS } from '../mobile/accounting/accountingEngine';
import type { JournalEntry, SayadiCheck } from '../mobile/accounting/accountingEngine';
import type {
  ApprovedVehicleDoc,
  ResidentSubmissionDoc,
  ResidentVehicleEntry,
  UnitInviteCodeDoc,
} from '../mobile/utils/residentOnboarding';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORE_PATH = path.resolve(__dirname, '../../deploy/mobile-edge/niloofar-nosql.json');

export interface StoredUserDoc extends RbacUserRecord {
  passwordHash: string;
}

export interface BlockDoc {
  id: string; // 'A' | 'B' | 'C'
  name: string;
  floors: number;
  unitsCount: number;
  managerUserId: string;
  managerName: string;
  monthlyChargeBaseTomans: number;
}

export interface UnitDoc {
  id: string;
  blockId: string;
  unitCode: string;
  unitNumber?: number;
  floor: number;
  residentUserId: string | null;
  residentName: string;
  occupancyType: 'مالک ساکن' | 'مستأجر' | 'خالی';
  phone: string;
  secondaryPhone?: string;
  nationalId?: string;
  householdCount?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  landlordName?: string;
  landlordPhone?: string;
  leaseStartJalali?: string;
  leaseEndJalali?: string;
  leaseContractDataUrl?: string;
  hasPets?: boolean;
  specialNeedsNote?: string;
  vehicles?: ResidentVehicleEntry[];
  onboardingVerified?: boolean;
  lastVerifiedAtMs?: number;
  plateText: string;
  parkingCode: string;
  storageCode: string;
  balanceTomans: number;
  debtTomans: number;
  expectedChargeTomans?: number;
}

export interface CaretakerTaskDoc {
  id: string;
  blockId: string;
  title: string;
  description: string;
  category: 'نظافت' | 'تاسیسات سبک' | 'باغبانی و محوطه' | 'بازرسی ایمنی' | 'تحویل و هماهنگی';
  priority: 'normal' | 'urgent';
  assignedToUserId: string;
  assignedToName: string;
  assignedByUserId: string;
  assignedByName: string;
  dueLabel: string;
  status: 'todo' | 'in_progress' | 'done_pending_review' | 'approved' | 'needs_fix';
  completionNote?: string;
  completionPhoto?: string;
  reviewNote?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ResidentRequestDoc {
  id: string;
  blockId: string;
  unitCode: string;
  residentUserId: string;
  residentName: string;
  type: 'maintenance' | 'common_area' | 'complaint';
  category: string;
  title: string;
  description: string;
  photoDataUrl?: string;
  status: 'open' | 'assigned' | 'in_progress' | 'resolved';
  assignedToUserId?: string;
  assignedToName?: string;
  managerReply?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ResidentMessageDoc {
  id: string;
  blockId: string;
  unitCode: string;
  residentUserId: string;
  residentName: string;
  senderUserId: string;
  senderName: string;
  senderRole: UserRoleId;
  recipientName?: string;
  deliveryStatus?: 'sent' | 'delivered' | 'read';
  deliveredAtMs?: number;
  readAtMs?: number;
  body: string;
  createdAtMs: number;
}

export interface GuestPermitDoc {
  id: string;
  blockId: string;
  unitCode: string;
  residentUserId: string;
  residentName: string;
  guestName: string;
  plateText: string;
  visitDateLabel: string;
  validHours: number;
  note?: string;
  status: 'pending_gate' | 'entered' | 'exited' | 'cancelled';
  verifiedByGuardName?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PaymentReceiptDoc {
  id: string;
  blockId: string;
  unitCode: string;
  residentUserId: string;
  residentName: string;
  amountTomans: number;
  traceCode: string;
  channel: 'شبا / پایا' | 'کارت‌به‌کارت' | 'درگاه پرداخت' | 'پوز مدیریت';
  bankAccountCode: '1102' | '1103';
  dateLabel: string;
  note?: string;
  receiptPhotoDataUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  voucherNo?: number;
  reviewedByName?: string;
  reviewNote?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface BlockNoticeDoc {
  id: string;
  blockId: string; // 'ALL' | 'A' | 'B' | 'C'
  targetUnitCode: string; // 'ALL' or e.g. 'B-208'
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'urgent';
  senderUserId: string;
  senderName: string;
  senderRoleTitle: string;
  createdAtMs: number;
}

export interface ExcelBankPatternDoc {
  id: string;
  name: string;
  blockId: string; // 'ALL' | 'A' | 'B' | 'C'
  amountColumn: string;
  dateColumn: string;
  traceColumn?: string;
  descriptionColumn?: string;
  currencyUnit: 'tomans' | 'rials';
  unitMatchMode: 'last_digits' | 'last_digits_and_charge' | 'exact_charge';
  suffixDigitCount: 1 | 2 | 3;
  chargeToleranceTomans?: number;
  customFields: Array<{
    id: string;
    fieldLabel: string;
    sourceType: 'column' | 'unit_from_last_digits' | 'resident_from_unit';
    columnName?: string;
  }>;
  createdByUserId: string;
  createdByName: string;
  createdAtMs: number;
}

export interface ExcelImportBatchDoc {
  id: string;
  blockId: string;
  periodLabel: string;
  patternName: string;
  fileName: string;
  bankAccountCode: '1102' | '1103';
  matchedCount: number;
  totalMatchedTomans: number;
  voucherNo: number;
  importedByUserId: string;
  importedByName: string;
  createdAtMs: number;
  records: Array<{
    unitCode: string;
    residentName: string;
    amountTomans: number;
    depositDate: string;
    traceCode: string;
    statusLabel: string;
    customRecord: Record<string, string>;
  }>;
}

export interface NoSqlCollections {
  users: StoredUserDoc[];
  blocks: BlockDoc[];
  units: UnitDoc[];
  caretaker_tasks: CaretakerTaskDoc[];
  resident_requests: ResidentRequestDoc[];
  resident_messages: ResidentMessageDoc[];
  guest_permits: GuestPermitDoc[];
  payment_receipts: PaymentReceiptDoc[];
  block_notices: BlockNoticeDoc[];
  accounting_entries: JournalEntry[];
  sayadi_checks: SayadiCheck[];
  excel_bank_patterns: ExcelBankPatternDoc[];
  excel_import_batches: ExcelImportBatchDoc[];
  unit_invite_codes: UnitInviteCodeDoc[];
  resident_submissions: ResidentSubmissionDoc[];
  approved_vehicles: ApprovedVehicleDoc[];
}

export type CollectionName = keyof NoSqlCollections;

/* ---- Secure password hashing (scrypt) & HMAC session tokens ---- */
export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 32).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hexHash] = parts;
  const derived = crypto.scryptSync(plain, salt, 32);
  const expected = Buffer.from(hexHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

const SESSION_SECRET =
  (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim()) ||
  crypto.randomBytes(32).toString('hex');

export function signSessionToken(payload: { uid: string; role: UserRoleId; exp: number }): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `nf1.${encoded}.${sig}`;
}

export function verifySessionToken(
  token: string,
): { uid: string; role: UserRoleId; exp: number } | null {
  if (!token || !token.startsWith('nf1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as {
      uid?: string;
      role?: UserRoleId;
      exp?: number;
    };
    if (!parsed.uid || !parsed.role || typeof parsed.exp !== 'number') return null;
    if (Date.now() > parsed.exp) return null;
    return { uid: parsed.uid, role: parsed.role, exp: parsed.exp };
  } catch {
    return null;
  }
}

export function stripUserSecrets(user: StoredUserDoc): RbacUserRecord {
  const { passwordHash: _ignored, ...safe } = user;
  return safe;
}

/* ---- Realistic Persian Seed Data for the Entire Residential Complex ---- */
function buildInitialSeed(): NoSqlCollections {
  const now = Date.now();
  const demoPassHash = hashPassword('1234');

  const users: StoredUserDoc[] = [
    {
      id: 'u_admin',
      username: 'admin',
      passwordHash: demoPassHash,
      displayName: 'مهندس شریفی (مدیر کل شهرک)',
      role: 'complex_manager',
      blockId: null,
      unitCode: null,
      phone: '۰۹۱۲۱۱۱۱۱۰۱',
      createdByUserId: null,
      createdByName: 'سیستم مرکزی',
      isTemporary: false,
      validFromMs: null,
      validUntilMs: null,
      active: true,
      createdAtMs: now - 30 * 86400_000,
    },
    {
      id: 'u_acc_complex',
      username: 'acc_complex',
      passwordHash: demoPassHash,
      displayName: 'خانم طاهری (مدیر حسابداری شهرک)',
      role: 'complex_accountant',
      blockId: null,
      unitCode: null,
      phone: '۰۹۱۲۱۱۱۱۱۰۲',
      createdByUserId: 'u_admin',
      createdByName: 'مهندس شریفی',
      isTemporary: false,
      validFromMs: null,
      validUntilMs: null,
      active: true,
      createdAtMs: now - 25 * 86400_000,
    },
    {
      id: 'u_fac_chief',
      username: 'fac_chief',
      passwordHash: demoPassHash,
      displayName: 'مهندس صابری (سرپرست کل تاسیسات)',
      role: 'facilities_chief',
      blockId: null,
      unitCode: null,
      phone: '۰۹۱۲۱۱۱۱۱۰۳',
      createdByUserId: 'u_admin',
      createdByName: 'مهندس شریفی',
      isTemporary: false,
      validFromMs: null,
      validUntilMs: null,
      active: true,
      createdAtMs: now - 25 * 86400_000,
    },
    {
      id: 'u_block_b_mgr',
      username: 'block_b_mgr',
      passwordHash: demoPassHash,
      displayName: 'دکتر فراهانی (مدیر بلوک B)',
      role: 'block_manager',
      blockId: 'B',
      unitCode: 'B-101',
      phone: '۰۹۱۲۲۲۲۲۲۰۱',
      createdByUserId: 'u_admin',
      createdByName: 'مهندس شریفی',
      isTemporary: false,
      validFromMs: null,
      validUntilMs: null,
      active: true,
      createdAtMs: now - 20 * 86400_000,
    },
    {
      id: 'u_acc_block_b',
      username: 'acc_block_b',
      passwordHash: demoPassHash,
      displayName: 'آقای موسوی (حسابدار مشترک بلوک‌های A و B)',
      role: 'block_accountant',
      blockId: 'B',
      assignedBlocks: [
        {
          blockId: 'B',
          grantedByUserId: 'u_block_b_mgr',
          grantedByName: 'دکتر فراهانی (مدیر بلوک B)',
          grantedAtMs: now - 15 * 86400_000,
          permissions: ['finance', 'excel_import'],
        },
        {
          blockId: 'A',
          grantedByUserId: 'u_admin',
          grantedByName: 'مهندس شریفی (مدیر بلوک A)',
          grantedAtMs: now - 10 * 86400_000,
          permissions: ['finance', 'excel_import'],
        },
      ],
      unitCode: null,
      phone: '۰۹۱۲۲۲۲۲۲۰۲',
      createdByUserId: 'u_block_b_mgr',
      createdByName: 'دکتر فراهانی',
      isTemporary: false,
      validFromMs: null,
      validUntilMs: null,
      active: true,
      createdAtMs: now - 15 * 86400_000,
    },
    {
      id: 'u_fac_block_b',
      username: 'fac_block_b',
      passwordHash: demoPassHash,
      displayName: 'استاد کریمیان (تاسیسات مشترک بلوک‌های B و C)',
      role: 'block_facilities',
      blockId: 'B',
      assignedBlocks: [
        {
          blockId: 'B',
          grantedByUserId: 'u_block_b_mgr',
          grantedByName: 'دکتر فراهانی (مدیر بلوک B)',
          grantedAtMs: now - 15 * 86400_000,
          permissions: ['facilities'],
        },
        {
          blockId: 'C',
          grantedByUserId: 'u_admin',
          grantedByName: 'مهندس شریفی (مدیر بلوک C)',
          grantedAtMs: now - 8 * 86400_000,
          permissions: ['facilities'],
        },
      ],
      unitCode: null,
      phone: '۰۹۱۲۲۲۲۲۲۰۳',
      createdByUserId: 'u_block_b_mgr',
      createdByName: 'دکتر فراهانی',
      isTemporary: false,
      validFromMs: null,
      validUntilMs: null,
      active: true,
      createdAtMs: now - 15 * 86400_000,
    },
    {
      id: 'u_caretaker_b1',
      username: 'caretaker_b1',
      passwordHash: demoPassHash,
      displayName: 'آقای رحمتی (سرایدار دائم بلوک B)',
      role: 'block_caretaker',
      blockId: 'B',
      unitCode: 'سرایداری B',
      phone: '۰۹۱۹۳۳۳۳۳۰۱',
      createdByUserId: 'u_block_b_mgr',
      createdByName: 'دکتر فراهانی',
      isTemporary: false,
      validFromMs: null,
      validUntilMs: null,
      active: true,
      createdAtMs: now - 14 * 86400_000,
    },
    {
      id: 'u_temp_caretaker_b',
      username: 'temp_caretaker_b',
      passwordHash: demoPassHash,
      displayName: 'امیرحسین مرادی (سرایدار کمکی بلوک B)',
      role: 'temp_caretaker',
      blockId: 'B',
      unitCode: 'شیفت کمکی B',
      phone: '۰۹۳۵۴۴۴۴۴۰۲',
      createdByUserId: 'u_block_b_mgr',
      createdByName: 'دکتر فراهانی',
      isTemporary: true,
      accessDurationLabel: '۱ روز کامل (۲۴ ساعت)',
      validFromMs: now - 2 * 3600_000,
      validUntilMs: now + 22 * 3600_000,
      active: true,
      createdAtMs: now - 2 * 3600_000,
    },
    {
      id: 'u_guard_gate1',
      username: 'guard_gate1',
      passwordHash: demoPassHash,
      displayName: 'رحمان حسینی (نگهبان گیت ورودی)',
      role: 'gate_guard',
      blockId: null,
      unitCode: 'گیت شمالی',
      phone: '۰۹۱۹۵۵۵۵۵۰۱',
      createdByUserId: 'u_admin',
      createdByName: 'مهندس شریفی',
      isTemporary: false,
      validFromMs: null,
      validUntilMs: null,
      active: true,
      createdAtMs: now - 20 * 86400_000,
    },
    {
      id: 'u_res_b208',
      username: 'res_b208',
      passwordHash: demoPassHash,
      displayName: 'آقای حسینی (ساکن واحد B-208)',
      role: 'resident',
      blockId: 'B',
      unitCode: 'B-208',
      phone: '۰۹۱۹۴۵۶۷۱۲۳',
      createdByUserId: 'u_block_b_mgr',
      createdByName: 'دکتر فراهانی',
      isTemporary: false,
      validFromMs: null,
      validUntilMs: null,
      active: true,
      createdAtMs: now - 18 * 86400_000,
    },
  ];

  const blocks: BlockDoc[] = [
    {
      id: 'A',
      name: 'بلوک A (شرقی)',
      floors: 6,
      unitsCount: 16,
      managerUserId: 'u_admin',
      managerName: 'مهندس شریفی',
      monthlyChargeBaseTomans: 1_100_000,
    },
    {
      id: 'B',
      name: 'بلوک B (یاسمن / غربی)',
      floors: 6,
      unitsCount: 16,
      managerUserId: 'u_block_b_mgr',
      managerName: 'دکتر فراهانی',
      monthlyChargeBaseTomans: 1_120_000,
    },
    {
      id: 'C',
      name: 'بلوک C (مرکزی)',
      floors: 6,
      unitsCount: 16,
      managerUserId: 'u_admin',
      managerName: 'مهندس شریفی',
      monthlyChargeBaseTomans: 1_150_000,
    },
  ];

  const units: UnitDoc[] = [
    {
      id: 'unit_a101',
      blockId: 'A',
      unitCode: 'A-101',
      unitNumber: 1,
      floor: 1,
      residentUserId: null,
      residentName: 'مهندس رضایی',
      occupancyType: 'مالک ساکن',
      phone: '۰۹۱۲۳۴۵۶۷۸۹',
      plateText: '۱۲ ب ۳۴۵ - ۱۱',
      parkingCode: 'P-12',
      storageCode: 'S-04',
      balanceTomans: 1_850_000,
      debtTomans: 0,
      expectedChargeTomans: 1_100_000,
    },
    {
      id: 'unit_a104',
      blockId: 'A',
      unitCode: 'A-104',
      unitNumber: 4,
      floor: 2,
      residentUserId: null,
      residentName: 'دکتر محمدی',
      occupancyType: 'مالک ساکن',
      phone: '۰۹۱۲۸۸۷۷۶۶۵',
      plateText: '۶۸ د ۷۹۱ - ۲۲',
      parkingCode: 'P-24',
      storageCode: 'S-11',
      balanceTomans: 420_000,
      debtTomans: 1_100_000,
      expectedChargeTomans: 1_100_000,
    },
    {
      id: 'unit_b08',
      blockId: 'B',
      unitCode: 'B-08',
      unitNumber: 8,
      floor: 2,
      residentUserId: null,
      residentName: 'مهندس مرادی',
      occupancyType: 'مالک ساکن',
      phone: '۰۹۱۲۴۴۵۵۶۶۸',
      plateText: '۵۴ ن ۸۱۸ - ۱۱',
      parkingCode: 'P-08',
      storageCode: 'S-08',
      balanceTomans: 0,
      debtTomans: 1_450_000,
      expectedChargeTomans: 1_450_000,
    },
    {
      id: 'unit_b11',
      blockId: 'B',
      unitCode: 'B-11',
      unitNumber: 11,
      floor: 3,
      residentUserId: null,
      residentName: 'دکتر سلیمانی',
      occupancyType: 'مالک ساکن',
      phone: '۰۹۱۲۳۳۴۴۵۱۱',
      plateText: '۳۱ ل ۴۱۱ - ۲۲',
      parkingCode: 'P-11',
      storageCode: 'S-11',
      balanceTomans: 0,
      debtTomans: 1_550_000,
      expectedChargeTomans: 1_550_000,
    },
    {
      id: 'unit_b15',
      blockId: 'B',
      unitCode: 'B-15',
      unitNumber: 15,
      floor: 4,
      residentUserId: null,
      residentName: 'خانم رضوی',
      occupancyType: 'مالک ساکن',
      phone: '۰۹۱۲۶۶۷۷۸۱۵',
      plateText: '۷۷ م ۵۱۵ - ۱۱',
      parkingCode: 'P-15',
      storageCode: 'S-15',
      balanceTomans: 0,
      debtTomans: 1_920_000,
      expectedChargeTomans: 1_920_000,
    },
    {
      id: 'unit_b203',
      blockId: 'B',
      unitCode: 'B-203',
      unitNumber: 203,
      floor: 3,
      residentUserId: null,
      residentName: 'خانم کریمی',
      occupancyType: 'مالک ساکن',
      phone: '۰۹۱۲۶۵۴۳۲۱۰',
      plateText: '۴۴ ج ۸۹۱ - ۶۶',
      parkingCode: 'P-18',
      storageCode: 'S-09',
      balanceTomans: 1_200_000,
      debtTomans: 0,
      expectedChargeTomans: 1_450_000,
    },
    {
      id: 'unit_b208',
      blockId: 'B',
      unitCode: 'B-208',
      unitNumber: 208,
      floor: 4,
      residentUserId: 'u_res_b208',
      residentName: 'آقای حسینی',
      occupancyType: 'مستأجر',
      phone: '۰۹۱۹۴۵۶۷۱۲۳',
      plateText: '۸۸ ط ۵۱۲ - ۱۱',
      parkingCode: 'P-31',
      storageCode: 'S-22',
      balanceTomans: 0,
      debtTomans: 1_120_000,
      expectedChargeTomans: 1_120_000,
    },
    {
      id: 'unit_b302',
      blockId: 'B',
      unitCode: 'B-302',
      unitNumber: 302,
      floor: 3,
      residentUserId: null,
      residentName: 'مهندس احمدی',
      occupancyType: 'مالک ساکن',
      phone: '۰۹۱۲۷۷۸۸۹۹۰',
      plateText: '۲۵ س ۶۱۴ - ۱۱',
      parkingCode: 'P-35',
      storageCode: 'S-26',
      balanceTomans: 650_000,
      debtTomans: 480_000,
      expectedChargeTomans: 1_120_000,
    },
    {
      id: 'unit_c102',
      blockId: 'C',
      unitCode: 'C-102',
      unitNumber: 2,
      floor: 1,
      residentUserId: null,
      residentName: 'خانم شمس',
      occupancyType: 'مالک ساکن',
      phone: '۰۹۱۲۹۰۸۰۷۰۶',
      plateText: '۳۳ م ۹۰۲ - ۴۴',
      parkingCode: 'P-41',
      storageCode: 'S-31',
      balanceTomans: 950_000,
      debtTomans: 1_150_000,
      expectedChargeTomans: 1_150_000,
    },
  ];

  const caretaker_tasks: CaretakerTaskDoc[] = [
    {
      id: 'tsk_101',
      blockId: 'B',
      title: 'شست‌وشوی کامل لابی و رمپ پارکینگ بلوک B',
      description: 'شست‌وشوی سنگ کف لابی، نظافت شیشه درب ورودی و تی‌کشی راهروی آسانسور طبقه همکف تا چهارم.',
      category: 'نظافت',
      priority: 'urgent',
      assignedToUserId: 'u_caretaker_b1',
      assignedToName: 'آقای رحمتی (سرایدار دائم بلوک B)',
      assignedByUserId: 'u_block_b_mgr',
      assignedByName: 'دکتر فراهانی (مدیر بلوک B)',
      dueLabel: 'امروز تا ساعت ۱۶:۰۰',
      status: 'in_progress',
      createdAtMs: now - 4 * 3600_000,
      updatedAtMs: now - 2 * 3600_000,
    },
    {
      id: 'tsk_102',
      blockId: 'B',
      title: 'تعویض لامپ سنسوری پاگرد طبقه ۳ و ۴ بلوک B',
      description: '۲ عدد لامپ LED ۱۲ وات از انبار سرایداری برداشته و در پاگرد غربی نصب شود.',
      category: 'تاسیسات سبک',
      priority: 'normal',
      assignedToUserId: 'u_temp_caretaker_b',
      assignedToName: 'امیرحسین مرادی (سرایدار کمکی بلوک B)',
      assignedByUserId: 'u_block_b_mgr',
      assignedByName: 'دکتر فراهانی (مدیر بلوک B)',
      dueLabel: 'امروز تا ساعت ۱۸:۰۰',
      status: 'todo',
      createdAtMs: now - 2 * 3600_000,
      updatedAtMs: now - 2 * 3600_000,
    },
    {
      id: 'tsk_103',
      blockId: 'B',
      title: 'بازدید مخزن آب و بررسی فشار پمپ جکوزی بلوک B',
      description: 'ثبت عدد فشارسنج موتورخانه و بررسی خشک بودن کف اتاق پمپ پس از حادثه نشتی.',
      category: 'بازرسی ایمنی',
      priority: 'urgent',
      assignedToUserId: 'u_caretaker_b1',
      assignedToName: 'آقای رحمتی (سرایدار دائم بلوک B)',
      assignedByUserId: 'u_block_b_mgr',
      assignedByName: 'دکتر فراهانی (مدیر بلوک B)',
      dueLabel: 'امروز ساعت ۱۱:۰۰',
      status: 'done_pending_review',
      completionNote: 'فشار روی ۴.۲ بار ثابت است؛ کف اتاق پمپ خشک و بدون چکه بود.',
      createdAtMs: now - 6 * 3600_000,
      updatedAtMs: now - 1 * 3600_000,
    },
  ];

  const resident_requests: ResidentRequestDoc[] = [
    {
      id: 'req_301',
      blockId: 'B',
      unitCode: 'B-208',
      residentUserId: 'u_res_b208',
      residentName: 'آقای حسینی',
      type: 'maintenance',
      category: 'آیفون و برق واحد',
      title: 'قطع شدن تصویر آیفون تصویری واحد ۲۰۸',
      description: 'زنگ واحد می‌خورد اما صفحه نمایش تصویر درب ورودی بلوک را نشان نمی‌دهد.',
      status: 'assigned',
      assignedToUserId: 'u_fac_block_b',
      assignedToName: 'استاد کریمیان (مسئول تاسیسات بلوک B)',
      managerReply: 'به استاد کریمیان ارجاع شد؛ امروز ساعت ۱۷ برای بررسی مراجعه می‌کنند.',
      createdAtMs: now - 5 * 3600_000,
      updatedAtMs: now - 2 * 3600_000,
    },
    {
      id: 'req_302',
      blockId: 'B',
      unitCode: 'B-302',
      residentUserId: 'u_res_b208',
      residentName: 'مهندس احمدی',
      type: 'common_area',
      category: 'آسانسور',
      title: 'صدای لرزش درب آسانسور نفر‌بر در طبقه سوم',
      description: 'هنگام باز شدن درب در طبقه سوم صدای سایش ریل شنیده می‌شود.',
      status: 'open',
      createdAtMs: now - 90 * 60_000,
      updatedAtMs: now - 90 * 60_000,
    },
  ];

  const resident_messages: ResidentMessageDoc[] = [
    {
      id: 'msg_401',
      blockId: 'B',
      unitCode: 'B-208',
      residentUserId: 'u_res_b208',
      residentName: 'آقای حسینی',
      senderUserId: 'u_res_b208',
      senderName: 'آقای حسینی (واحد B-208)',
      senderRole: 'resident',
      body: 'سلام جناب دکتر فراهانی، برای اسباب‌کشی یک دست مبل جدید پنجشنبه ساعت ۱۱ نیاز به هماهنگی آسانسور باربر داریم.',
      createdAtMs: now - 8 * 3600_000,
    },
    {
      id: 'msg_402',
      blockId: 'B',
      unitCode: 'B-208',
      residentUserId: 'u_res_b208',
      residentName: 'آقای حسینی',
      senderUserId: 'u_block_b_mgr',
      senderName: 'دکتر فراهانی (مدیر بلوک B)',
      senderRole: 'block_manager',
      body: 'سلام آقای حسینی، با سرایدار بلوک هماهنگ شد؛ پنجشنبه از ساعت ۱۱ تا ۱۳ آسانسور باربر با ضربه‌گیر آماده خواهد بود. لطفاً پلاک وانت را در بخش ثبت مهمان وارد کنید.',
      createdAtMs: now - 6 * 3600_000,
    },
  ];

  const guest_permits: GuestPermitDoc[] = [
    {
      id: 'gp_501',
      blockId: 'B',
      unitCode: 'B-208',
      residentUserId: 'u_res_b208',
      residentName: 'آقای حسینی',
      guestName: 'مهندس کاظمی (مهمان خانوادگی)',
      plateText: '۵۵ ن ۶۲۱ - ۱۱',
      visitDateLabel: 'امروز • ساعت ۱۸:۰۰',
      validHours: 6,
      note: 'ورود به پارکینگ مهمان بلوک B',
      status: 'pending_gate',
      createdAtMs: now - 45 * 60_000,
      updatedAtMs: now - 45 * 60_000,
    },
    {
      id: 'gp_502',
      blockId: 'B',
      unitCode: 'B-203',
      residentUserId: 'u_res_b208',
      residentName: 'خانم کریمی',
      guestName: 'پیک باربری (آقای شمس)',
      plateText: '۳۱ ع ۴۰۸ - ۲۲',
      visitDateLabel: 'امروز • ساعت ۱۴:۳۰',
      validHours: 2,
      note: 'تحویل سفارش لوازم خانگی',
      status: 'entered',
      verifiedByGuardName: 'رحمان حسینی',
      createdAtMs: now - 3 * 3600_000,
      updatedAtMs: now - 2 * 3600_000,
    },
  ];

  const payment_receipts: PaymentReceiptDoc[] = [
    {
      id: 'rcp_601',
      blockId: 'A',
      unitCode: 'A-104',
      residentUserId: 'u_res_b208',
      residentName: 'دکتر محمدی',
      amountTomans: 3_200_000,
      traceCode: 'SHB-8829104',
      channel: 'شبا / پایا',
      bankAccountCode: '1102',
      dateLabel: '۱۴۰۵/۰۸/۲۸',
      note: 'تسویه شارژ آبان و معوقه مهر',
      status: 'pending',
      createdAtMs: now - 5 * 3600_000,
      updatedAtMs: now - 5 * 3600_000,
    },
    {
      id: 'rcp_602',
      blockId: 'B',
      unitCode: 'B-208',
      residentUserId: 'u_res_b208',
      residentName: 'آقای حسینی',
      amountTomans: 1_120_000,
      traceCode: 'CRD-5519082',
      channel: 'کارت‌به‌کارت',
      bankAccountCode: '1102',
      dateLabel: '۱۴۰۵/۰۸/۲۹',
      note: 'شارژ آبان ۱۴۰۵ واحد B-208',
      status: 'pending',
      createdAtMs: now - 2 * 3600_000,
      updatedAtMs: now - 2 * 3600_000,
    },
  ];

  const block_notices: BlockNoticeDoc[] = [
    {
      id: 'ntc_701',
      blockId: 'B',
      targetUnitCode: 'ALL',
      title: 'قطعی کوتاه‌مدت آب برای تست فشار رایزر غربی',
      body: 'فردا ساعت ۱۰ تا ۱۱:۳۰ صبح جهت تست نهایی شیر فلکه رایزر ۲، آب بلوک B قطع خواهد بود.',
      severity: 'warning',
      senderUserId: 'u_block_b_mgr',
      senderName: 'دکتر فراهانی',
      senderRoleTitle: 'مدیر بلوک B',
      createdAtMs: now - 3 * 3600_000,
    },
    {
      id: 'ntc_702',
      blockId: 'B',
      targetUnitCode: 'B-208',
      title: 'تایید رزرو آسانسور باربر برای واحد ۲۰۸',
      body: 'آسانسور باربر برای پنجشنبه ساعت ۱۱ تا ۱۳ با محافظ دیوار رزرو شد.',
      severity: 'info',
      senderUserId: 'u_block_b_mgr',
      senderName: 'دکتر فراهانی',
      senderRoleTitle: 'مدیر بلوک B',
      createdAtMs: now - 6 * 3600_000,
    },
  ];

  const excel_bank_patterns: ExcelBankPatternDoc[] = [
    {
      id: 'pat_pasargad_2digit',
      name: 'الگوی بانک پاسارگاد — ۲ رقم آخر = شماره واحد',
      blockId: 'B',
      amountColumn: 'واریز',
      dateColumn: 'تاریخ واریز',
      traceColumn: 'شماره پیگیری',
      descriptionColumn: 'شرح تراکنش',
      currencyUnit: 'rials',
      unitMatchMode: 'last_digits_and_charge',
      suffixDigitCount: 2,
      chargeToleranceTomans: 2000,
      customFields: [
        { id: 'cf_unit', fieldLabel: 'شماره واحد', sourceType: 'unit_from_last_digits' },
        { id: 'cf_res', fieldLabel: 'واریزکننده (ساکن)', sourceType: 'resident_from_unit' },
        { id: 'cf_date', fieldLabel: 'زمان واریز', sourceType: 'column', columnName: 'تاریخ واریز' },
      ],
      createdByUserId: 'u_block_b_mgr',
      createdByName: 'دکتر فراهانی (مدیر بلوک B)',
      createdAtMs: now - 5 * 86400_000,
    },
  ];

  const excel_import_batches: ExcelImportBatchDoc[] = [];

  const unit_invite_codes: UnitInviteCodeDoc[] = [
    {
      id: 'inv_b302',
      code: 'BLB-302-4821',
      blockId: 'B',
      unitCode: 'B-302',
      status: 'active',
      createdByUserId: 'u_block_b_mgr',
      createdByName: 'دکتر فراهانی (مدیر بلوک B)',
      createdAtMs: now - 3 * 3600_000,
    },
    {
      id: 'inv_b08',
      code: 'BLB-08-5214',
      blockId: 'B',
      unitCode: 'B-08',
      status: 'active',
      createdByUserId: 'u_block_b_mgr',
      createdByName: 'دکتر فراهانی (مدیر بلوک B)',
      createdAtMs: now - 3 * 3600_000,
    },
    {
      id: 'inv_b11',
      code: 'BLB-11-6409',
      blockId: 'B',
      unitCode: 'B-11',
      status: 'active',
      createdByUserId: 'u_block_b_mgr',
      createdByName: 'دکتر فراهانی (مدیر بلوک B)',
      createdAtMs: now - 2 * 3600_000,
    },
    {
      id: 'inv_b15',
      code: 'BLB-15-7390',
      blockId: 'B',
      unitCode: 'B-15',
      status: 'used',
      createdByUserId: 'u_block_b_mgr',
      createdByName: 'دکتر فراهانی (مدیر بلوک B)',
      createdAtMs: now - 6 * 3600_000,
      usedAtMs: now - 1 * 3600_000,
      usedByName: 'خانم زهرا رضوی',
    },
    {
      id: 'inv_a104',
      code: 'BLA-104-6150',
      blockId: 'A',
      unitCode: 'A-104',
      status: 'active',
      createdByUserId: 'u_admin',
      createdByName: 'مهندس شریفی (مدیر کل شهرک)',
      createdAtMs: now - 4 * 3600_000,
    },
    {
      id: 'inv_c102',
      code: 'BLC-102-3940',
      blockId: 'C',
      unitCode: 'C-102',
      status: 'active',
      createdByUserId: 'u_admin',
      createdByName: 'مهندس شریفی (مدیر کل شهرک)',
      createdAtMs: now - 4 * 3600_000,
    },
  ];

  const resident_submissions: ResidentSubmissionDoc[] = [
    {
      id: 'sub_b15_demo',
      trackingCode: 'NF-85142',
      inviteCode: 'BLB-15-7390',
      blockId: 'B',
      unitCode: 'B-15',
      fullName: 'زهرا رضوی',
      nationalId: '۰۰۷۸۴۵۱۲۳۰',
      phone: '۰۹۱۲۶۶۷۷۸۱۵',
      secondaryPhone: '۰۲۱۸۸۷۷۶۶۱۵',
      emergencyContactName: 'مهندس سعید رضوی (همسر)',
      emergencyContactPhone: '۰۹۱۲۵۵۴۴۳۳۲',
      householdCount: 3,
      occupancyType: 'مستأجر',
      landlordName: 'حاج مرتضی اکبری',
      landlordPhone: '۰۹۱۲۱۱۱۲۲۴۴',
      leaseStartJalali: '۱۴۰۵/۰۷/۰۱',
      leaseEndJalali: '۱۴۰۶/۰۷/۰۱',
      storageCode: 'S-15',
      hasPets: false,
      specialNeedsNote: 'کودک خردسال در واحد ساکن است (الویت اطلاع‌رسانی قطعی برق/آسانسور)',
      desiredUsername: 'res_b15',
      vehicles: [
        {
          id: 'veh_sub_1',
          vehicleType: 'سواری',
          modelAndColor: 'پژو ۲۰۷ اتوماتیک سفید',
          plateText: '۷۷ م ۵۱۵ - ۱۱',
          parkingType: 'اختصاصی سنددار',
          parkingNumber: 'P-15',
          parkingFloorOrZone: 'همکف غربی',
        },
        {
          id: 'veh_sub_2',
          vehicleType: 'سواری',
          modelAndColor: 'کوییک R نقره‌ای',
          plateText: '۶۴ د ۲۹۸ - ۲۲',
          parkingType: 'پارکینگ اجاره‌ای',
          parkingNumber: 'P-44',
          parkingFloorOrZone: 'طبقه منفی ۲ - ردیف B',
          parkingProofName: 'قرارداد اجاره پارکینگ P-44 (مالک واحد B-19)',
        },
      ],
      status: 'pending_review',
      createdAtMs: now - 50 * 60_000,
      updatedAtMs: now - 50 * 60_000,
    },
  ];

  const approved_vehicles: ApprovedVehicleDoc[] = [
    {
      id: 'aveh_a101',
      blockId: 'A',
      unitCode: 'A-101',
      residentName: 'مهندس رضایی',
      residentPhone: '۰۹۱۲۳۴۵۶۷۸۹',
      occupancyType: 'مالک ساکن',
      vehicleType: 'سواری',
      modelAndColor: 'هایما S7 مشکی',
      plateText: '۱۲ ب ۳۴۵ - ۱۱',
      normalizedPlate: '12ب34511',
      parkingType: 'اختصاصی سنددار',
      parkingNumber: 'P-12',
      parkingFloorOrZone: 'منفی ۱ - شرقی',
      hasParkingProof: true,
      gateAccessEnabled: true,
      approvedByName: 'مهندس شریفی (مدیر کل شهرک)',
      approvedAtMs: now - 12 * 86400_000,
    },
    {
      id: 'aveh_b208',
      blockId: 'B',
      unitCode: 'B-208',
      residentName: 'آقای حسینی',
      residentPhone: '۰۹۱۹۴۵۶۷۱۲۳',
      occupancyType: 'مستأجر',
      vehicleType: 'سواری',
      modelAndColor: 'دنا پلاس توربو سفید',
      plateText: '۸۸ ط ۵۱۲ - ۱۱',
      normalizedPlate: '88ط51211',
      parkingType: 'اختصاصی سنددار',
      parkingNumber: 'P-31',
      parkingFloorOrZone: 'منفی ۱ - غربی',
      hasParkingProof: true,
      gateAccessEnabled: true,
      approvedByName: 'دکتر فراهانی (مدیر بلوک B)',
      approvedAtMs: now - 8 * 86400_000,
    },
    {
      id: 'aveh_b203',
      blockId: 'B',
      unitCode: 'B-203',
      residentName: 'خانم کریمی',
      residentPhone: '۰۹۱۲۶۵۴۳۲۱۰',
      occupancyType: 'مالک ساکن',
      vehicleType: 'سواری',
      modelAndColor: 'تارا اتوماتیک خاکستری',
      plateText: '۴۴ ج ۸۹۱ - ۶۶',
      normalizedPlate: '44ج89166',
      parkingType: 'پارکینگ طبقاتی',
      parkingNumber: 'P-18',
      parkingFloorOrZone: 'طبقه ۲ - ستون C',
      hasParkingProof: true,
      gateAccessEnabled: true,
      approvedByName: 'دکتر فراهانی (مدیر بلوک B)',
      approvedAtMs: now - 10 * 86400_000,
    },
    {
      id: 'aveh_c102',
      blockId: 'C',
      unitCode: 'C-102',
      residentName: 'خانم شمس',
      residentPhone: '۰۹۱۲۹۰۸۰۷۰۶',
      occupancyType: 'مالک ساکن',
      vehicleType: 'سواری',
      modelAndColor: 'مزدا ۳ نوک‌مدادی',
      plateText: '۳۳ م ۹۰۲ - ۴۴',
      normalizedPlate: '33م90244',
      parkingType: 'اختصاصی سنددار',
      parkingNumber: 'P-41',
      parkingFloorOrZone: 'منفی ۱ - مرکزی',
      hasParkingProof: true,
      gateAccessEnabled: true,
      approvedByName: 'مهندس شریفی (مدیر کل شهرک)',
      approvedAtMs: now - 14 * 86400_000,
    },
  ];

  return {
    users,
    blocks,
    units,
    caretaker_tasks,
    resident_requests,
    resident_messages,
    guest_permits,
    payment_receipts,
    block_notices,
    accounting_entries: INITIAL_JOURNAL_ENTRIES.map((e) => ({ ...e, lines: e.lines.map((l) => ({ ...l })) })),
    sayadi_checks: INITIAL_SAYADI_CHECKS.map((c) => ({ ...c })),
    excel_bank_patterns,
    excel_import_batches,
    unit_invite_codes,
    resident_submissions,
    approved_vehicles,
  };
}

/* ---- Disk-Persisted NoSQL Document Engine ---- */
class EmbeddedNoSqlStore {
  private data: NoSqlCollections;

  constructor() {
    this.data = this.loadOrSeed();
  }

  private loadOrSeed(): NoSqlCollections {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<NoSqlCollections>;
        const seed = buildInitialSeed();

        const existingUsers = Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : seed.users;
        const migratedUsers = existingUsers.map((u) => {
          if (u.id === 'u_acc_block_b' && (!u.assignedBlocks || u.assignedBlocks.length === 0)) {
            const seedAcc = seed.users.find((su) => su.id === 'u_acc_block_b');
            return seedAcc ? { ...u, displayName: seedAcc.displayName, assignedBlocks: seedAcc.assignedBlocks } : u;
          }
          if (u.id === 'u_fac_block_b' && (!u.assignedBlocks || u.assignedBlocks.length === 0)) {
            const seedFac = seed.users.find((su) => su.id === 'u_fac_block_b');
            return seedFac ? { ...u, displayName: seedFac.displayName, assignedBlocks: seedFac.assignedBlocks } : u;
          }
          return u;
        });

        const existingUnits = Array.isArray(parsed.units) && parsed.units.length > 0 ? [...parsed.units] : seed.units;
        for (const su of seed.units) {
          if (!existingUnits.some((eu) => eu.id === su.id)) {
            existingUnits.push(su);
          }
        }

        const merged: NoSqlCollections = {
          users: migratedUsers,
          blocks: Array.isArray(parsed.blocks) && parsed.blocks.length > 0 ? parsed.blocks : seed.blocks,
          units: existingUnits,
          caretaker_tasks: Array.isArray(parsed.caretaker_tasks) ? parsed.caretaker_tasks : seed.caretaker_tasks,
          resident_requests: Array.isArray(parsed.resident_requests) ? parsed.resident_requests : seed.resident_requests,
          resident_messages: Array.isArray(parsed.resident_messages) ? parsed.resident_messages : seed.resident_messages,
          guest_permits: Array.isArray(parsed.guest_permits) ? parsed.guest_permits : seed.guest_permits,
          payment_receipts: Array.isArray(parsed.payment_receipts) ? parsed.payment_receipts : seed.payment_receipts,
          block_notices: Array.isArray(parsed.block_notices) ? parsed.block_notices : seed.block_notices,
          accounting_entries:
            Array.isArray(parsed.accounting_entries) && parsed.accounting_entries.length > 0
              ? parsed.accounting_entries
              : seed.accounting_entries,
          sayadi_checks:
            Array.isArray(parsed.sayadi_checks) && parsed.sayadi_checks.length > 0
              ? parsed.sayadi_checks
              : seed.sayadi_checks,
          excel_bank_patterns:
            Array.isArray(parsed.excel_bank_patterns) && parsed.excel_bank_patterns.length > 0
              ? parsed.excel_bank_patterns
              : seed.excel_bank_patterns,
          excel_import_batches: Array.isArray(parsed.excel_import_batches)
            ? parsed.excel_import_batches
            : seed.excel_import_batches,
          unit_invite_codes:
            Array.isArray(parsed.unit_invite_codes) && parsed.unit_invite_codes.length > 0
              ? parsed.unit_invite_codes
              : seed.unit_invite_codes,
          resident_submissions:
            Array.isArray(parsed.resident_submissions) && parsed.resident_submissions.length > 0
              ? parsed.resident_submissions
              : seed.resident_submissions,
          approved_vehicles:
            Array.isArray(parsed.approved_vehicles) && parsed.approved_vehicles.length > 0
              ? parsed.approved_vehicles
              : seed.approved_vehicles,
        };
        return merged;
      }
    } catch {
      /* corrupt file -> recreate cleanly from seed */
    }
    const seeded = buildInitialSeed();
    this.data = seeded;
    this.persist();
    return seeded;
  }

  private persist(): void {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmp = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tmp, STORE_PATH);
  }

  public list<K extends CollectionName>(col: K): NoSqlCollections[K] {
    return this.data[col];
  }

  public find<K extends CollectionName>(
    col: K,
    predicate: (doc: NoSqlCollections[K][number]) => boolean,
  ): NoSqlCollections[K] {
    return (this.data[col] as Array<NoSqlCollections[K][number]>).filter(predicate) as NoSqlCollections[K];
  }

  public findById<K extends CollectionName>(
    col: K,
    id: string,
  ): NoSqlCollections[K][number] | undefined {
    return (this.data[col] as Array<{ id: string }>).find((d) => d.id === id) as
      | NoSqlCollections[K][number]
      | undefined;
  }

  public insert<K extends CollectionName>(
    col: K,
    doc: NoSqlCollections[K][number],
    prepend = true,
  ): NoSqlCollections[K][number] {
    const arr = this.data[col] as Array<NoSqlCollections[K][number]>;
    if (prepend) {
      arr.unshift(doc);
    } else {
      arr.push(doc);
    }
    this.persist();
    return doc;
  }

  public updateById<K extends CollectionName>(
    col: K,
    id: string,
    updater: (doc: NoSqlCollections[K][number]) => NoSqlCollections[K][number],
  ): NoSqlCollections[K][number] | null {
    const arr = this.data[col] as Array<{ id: string }>;
    const idx = arr.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    const updated = updater(arr[idx] as NoSqlCollections[K][number]);
    (arr as Array<NoSqlCollections[K][number]>)[idx] = updated;
    this.persist();
    return updated;
  }

  public removeById<K extends CollectionName>(col: K, id: string): boolean {
    const arr = this.data[col] as Array<{ id: string }>;
    const idx = arr.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    arr.splice(idx, 1);
    this.persist();
    return true;
  }

  public resetToSeed(): void {
    this.data = buildInitialSeed();
    this.persist();
  }
}

export const nosql = new EmbeddedNoSqlStore();
