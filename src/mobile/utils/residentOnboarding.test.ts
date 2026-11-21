import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUnitInviteCode,
  findApprovedVehicleByPlate,
  normalizeInviteCode,
  normalizePlateForMatch,
  validateResidentOnboarding,
  type ApprovedVehicleDoc,
  type ResidentOnboardingPayload,
} from './residentOnboarding';

test('buildUnitInviteCode formats block + unit + 4-digit suffix cleanly', () => {
  assert.equal(buildUnitInviteCode('B', 'B-302', '4821'), 'BLB-302-4821');
  assert.equal(buildUnitInviteCode('a', 'A-104', '9012'), 'BLA-104-9012');
  assert.equal(normalizeInviteCode('  blb-۳۰۲-۴۸۲۱ '), 'BLB-302-4821');
});

test('normalizePlateForMatch matches Persian and ASCII plates reliably', () => {
  assert.equal(normalizePlateForMatch('۱۲ ب ۳۴۵ - ۱۱'), '12ب34511');
  assert.equal(normalizePlateForMatch('12ب345 ایران 11'), '12ب34511');
});

test('findApprovedVehicleByPlate locates enabled resident vehicle and ignores disabled ones', () => {
  const list: ApprovedVehicleDoc[] = [
    {
      id: 'veh_1',
      blockId: 'B',
      unitCode: 'B-302',
      residentName: 'مهندس احمدی',
      residentPhone: '09127788990',
      occupancyType: 'مالک ساکن',
      vehicleType: 'سواری',
      modelAndColor: 'پژو ۲۰۷ سفید',
      plateText: '۲۵ س ۶۱۴ - ۱۱',
      normalizedPlate: '25س61411',
      parkingType: 'اختصاصی سنددار',
      parkingNumber: 'P-35',
      hasParkingProof: true,
      gateAccessEnabled: true,
      approvedByName: 'دکتر فراهانی',
      approvedAtMs: Date.now(),
    },
    {
      id: 'veh_disabled',
      blockId: 'B',
      unitCode: 'B-15',
      residentName: 'خانم رضوی',
      residentPhone: '09126677815',
      occupancyType: 'مالک ساکن',
      vehicleType: 'سواری',
      modelAndColor: 'دنا پلاس مشکی',
      plateText: '۷۷ م ۵۱۵ - ۱۱',
      normalizedPlate: '77م51511',
      parkingType: 'اختصاصی سنددار',
      parkingNumber: 'P-15',
      hasParkingProof: true,
      gateAccessEnabled: false,
      approvedByName: 'دکتر فراهانی',
      approvedAtMs: Date.now(),
    },
  ];

  const hit = findApprovedVehicleByPlate('25 س 614 - 11', list);
  assert.equal(hit?.unitCode, 'B-302');
  assert.equal(findApprovedVehicleByPlate('77 م 515 - 11', list), null);
});

test('validateResidentOnboarding enforces landlord + Jalali lease dates for tenants and proof for rented parking', () => {
  const invalidTenant: ResidentOnboardingPayload = {
    inviteCode: 'BLB-302-4821',
    fullName: 'علیرضا رضایی',
    phone: '۰۹۱۲۳۴۵۶۷۸۹',
    householdCount: 3,
    occupancyType: 'مستأجر',
    vehicles: [
      {
        id: 'v1',
        vehicleType: 'سواری',
        modelAndColor: 'تارا خاکستری',
        plateText: '۴۴ ج ۷۱۲ - ۱۱',
        parkingType: 'پارکینگ اجاره‌ای',
        parkingNumber: 'P-40',
      },
    ],
  };

  const r1 = validateResidentOnboarding(invalidTenant);
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some((e) => e.includes('صاحبخانه')));
  assert.ok(r1.errors.some((e) => e.includes('قرارداد اجاره')));
  assert.ok(r1.errors.some((e) => e.includes('عدم غصب')));

  const validTenant: ResidentOnboardingPayload = {
    ...invalidTenant,
    landlordName: 'حاج محمد کریمی',
    landlordPhone: '۰۹۱۲۱۱۱۲۲۳۳',
    leaseStartJalali: '۱۴۰۵/۰۷/۰۱',
    leaseEndJalali: '۱۴۰۶/۰۷/۰۱',
    vehicles: [
      {
        ...invalidTenant.vehicles[0],
        parkingProofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        parkingProofName: 'parking-lease.png',
      },
    ],
  };

  const r2 = validateResidentOnboarding(validTenant);
  assert.equal(r2.ok, true);
  assert.equal(r2.errors.length, 0);
});
