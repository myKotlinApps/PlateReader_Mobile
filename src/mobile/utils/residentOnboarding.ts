export type OccupancyKind = 'مالک ساکن' | 'مستأجر';

export type ParkingAllocationType =
  | 'اختصاصی سنددار'
  | 'پارکینگ طبقاتی'
  | 'پارکینگ اجاره‌ای';

export interface ResidentVehicleEntry {
  id: string;
  vehicleType: 'سواری' | 'موتورسیکلت' | 'وانت / شاسی‌بلند';
  modelAndColor: string;
  plateText: string;
  parkingType: ParkingAllocationType;
  parkingNumber: string;
  parkingFloorOrZone?: string;
  parkingProofDataUrl?: string;
  parkingProofName?: string;
}

export interface ResidentOnboardingPayload {
  inviteCode: string;
  fullName: string;
  nationalId?: string;
  phone: string;
  secondaryPhone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  householdCount: number;
  occupancyType: OccupancyKind;
  landlordName?: string;
  landlordPhone?: string;
  leaseStartJalali?: string;
  leaseEndJalali?: string;
  leaseContractDataUrl?: string;
  leaseContractName?: string;
  storageCode?: string;
  hasPets?: boolean;
  specialNeedsNote?: string;
  desiredUsername?: string;
  desiredPassword?: string;
  vehicles: ResidentVehicleEntry[];
}

export interface UnitInviteCodeDoc {
  id: string;
  code: string;
  blockId: string;
  unitCode: string;
  status: 'active' | 'used' | 'revoked';
  createdByUserId: string;
  createdByName: string;
  createdAtMs: number;
  usedAtMs?: number;
  usedByName?: string;
}

export interface ResidentSubmissionDoc {
  id: string;
  trackingCode: string;
  inviteCode: string;
  blockId: string;
  unitCode: string;
  fullName: string;
  nationalId?: string;
  phone: string;
  secondaryPhone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  householdCount: number;
  occupancyType: OccupancyKind;
  landlordName?: string;
  landlordPhone?: string;
  leaseStartJalali?: string;
  leaseEndJalali?: string;
  leaseContractDataUrl?: string;
  leaseContractName?: string;
  storageCode?: string;
  hasPets?: boolean;
  specialNeedsNote?: string;
  desiredUsername?: string;
  vehicles: ResidentVehicleEntry[];
  status: 'pending_review' | 'approved' | 'rejected';
  reviewNote?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ApprovedVehicleDoc {
  id: string;
  blockId: string;
  unitCode: string;
  residentName: string;
  residentPhone: string;
  occupancyType: OccupancyKind;
  vehicleType: ResidentVehicleEntry['vehicleType'];
  modelAndColor: string;
  plateText: string;
  normalizedPlate: string;
  parkingType: ParkingAllocationType;
  parkingNumber: string;
  parkingFloorOrZone?: string;
  hasParkingProof: boolean;
  parkingProofDataUrl?: string;
  gateAccessEnabled: boolean;
  sourceSubmissionId?: string;
  approvedByName: string;
  approvedAtMs: number;
}

const FA_AR_DIGITS: Record<string, string> = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

export function toAsciiDigits(input: string): string {
  return String(input || '').replace(/[۰-۹٠-٩]/g, (ch) => FA_AR_DIGITS[ch] ?? ch);
}

/**
 * Normalizes Iranian vehicle plates for reliable ALPR / Gate Guard lookup.
 * Example: "۱۲ ب ۳۴۵ - ۱۱" and "12ب345-11" both normalize to "12ب34511".
 */
export function normalizePlateForMatch(plate: string): string {
  return toAsciiDigits(plate)
    .replace(/[\s\-–—_.,/\\|]+/g, '')
    .replace(/ایران/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .trim()
    .toUpperCase();
}

export function findApprovedVehicleByPlate(
  queryPlate: string,
  approvedList: ApprovedVehicleDoc[],
): ApprovedVehicleDoc | null {
  const norm = normalizePlateForMatch(queryPlate);
  if (norm.length < 4) return null;
  const exact = approvedList.find(
    (v) => v.gateAccessEnabled && normalizePlateForMatch(v.plateText) === norm,
  );
  if (exact) return exact;
  return (
    approvedList.find(
      (v) =>
        v.gateAccessEnabled &&
        (normalizePlateForMatch(v.plateText).includes(norm) ||
          norm.includes(normalizePlateForMatch(v.plateText))),
    ) || null
  );
}

export function buildUnitInviteCode(
  blockId: string,
  unitCode: string,
  random4?: string,
): string {
  const cleanBlock = toAsciiDigits(blockId).replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'B';
  const cleanUnit = toAsciiDigits(unitCode)
    .replace(new RegExp(`^${cleanBlock}[-_]?`, 'i'), '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase() || '101';
  const suffix =
    random4 && /^[0-9]{4}$/.test(random4)
      ? random4
      : String(Math.floor(1000 + Math.random() * 9000));
  return `BL${cleanBlock}-${cleanUnit}-${suffix}`;
}

export function normalizeInviteCode(raw: string): string {
  return toAsciiDigits(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export interface OnboardingValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateResidentOnboarding(
  payload: ResidentOnboardingPayload,
): OnboardingValidationResult {
  const errors: string[] = [];

  if (!normalizeInviteCode(payload.inviteCode)) {
    errors.push('کد اختصاصی واحد الزامی است.');
  }
  if (!payload.fullName || payload.fullName.trim().length < 3) {
    errors.push('نام و نام خانوادگی ساکن (حداقل ۳ حرف) الزامی است.');
  }
  const phoneAscii = toAsciiDigits(payload.phone || '').replace(/\D/g, '');
  if (phoneAscii.length < 10) {
    errors.push('شماره موبایل معتبر ساکن الزامی است.');
  }
  const count = Number(payload.householdCount);
  if (!Number.isFinite(count) || count < 1 || count > 20) {
    errors.push('تعداد نفرات خانوار باید بین ۱ تا ۲۰ نفر باشد.');
  }

  if (payload.occupancyType === 'مستأجر') {
    if (!payload.landlordName || payload.landlordName.trim().length < 2) {
      errors.push('برای مستأجرین، ثبت نام و نام خانوادگی صاحبخانه الزامی است.');
    }
    const llPhone = toAsciiDigits(payload.landlordPhone || '').replace(/\D/g, '');
    if (llPhone.length < 10) {
      errors.push('شماره تماس معتبر صاحبخانه الزامی است.');
    }
    if (!payload.leaseStartJalali?.trim() || !payload.leaseEndJalali?.trim()) {
      errors.push('تاریخ دقیق شروع و پایان قرارداد اجاره (شمسی) الزامی است.');
    }
  }

  if (payload.desiredUsername && payload.desiredUsername.trim()) {
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(payload.desiredUsername.trim())) {
      errors.push('نام کاربری انتخابی باید ۳ تا ۳۲ کاراکتر لاتین یا عدد باشد.');
    }
    if (payload.desiredPassword && payload.desiredPassword.trim().length < 4) {
      errors.push('رمز عبور انتخابی باید حداقل ۴ کاراکتر باشد.');
    }
  }

  const seenPlates = new Set<string>();
  const vehicles = Array.isArray(payload.vehicles) ? payload.vehicles : [];
  vehicles.forEach((v, idx) => {
    const num = (idx + 1).toLocaleString('fa-IR');
    const normPlate = normalizePlateForMatch(v.plateText || '');
    if (normPlate.length < 5) {
      errors.push(`پلاک وسیله نقلیه شماره ${num} ناقص یا نامعتبر است.`);
    } else if (seenPlates.has(normPlate)) {
      errors.push(`پلاک وسیله نقلیه شماره ${num} تکراری است.`);
    } else {
      seenPlates.add(normPlate);
    }

    if (!v.parkingNumber || !v.parkingNumber.trim()) {
      errors.push(`شماره پارکینگ برای وسیله نقلیه شماره ${num} الزامی است.`);
    }

    if (v.parkingType === 'پارکینگ اجاره‌ای' && !v.parkingProofDataUrl?.trim()) {
      errors.push(
        `برای پارکینگ اجاره‌ای خودروی شماره ${num}، پیوست تصویر قرارداد اجاره پارکینگ جهت احراز عدم غصب الزامی است.`,
      );
    }
  });

  return { ok: errors.length === 0, errors };
}
