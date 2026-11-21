import type { UserAppearancePrefs } from '../theme/accessibilityPrefs.ts';

export type UserRoleId =
  | 'complex_manager'
  | 'complex_accountant'
  | 'facilities_chief'
  | 'block_manager'
  | 'block_accountant'
  | 'block_facilities'
  | 'block_caretaker'
  | 'temp_caretaker'
  | 'gate_guard'
  | 'resident';

export type RoleGroup = 'complex' | 'block' | 'security' | 'resident';

export type TempDurationPreset = 'half_day' | 'one_day' | 'two_days' | 'custom';

export interface RoleDockTabSpec {
  id: string;
  label: string;
  icon: 'home' | 'building' | 'wrench' | 'wallet' | 'mail' | 'shield' | 'clipboard' | 'user_home' | 'receipt' | 'car' | 'users' | 'chat';
}

export interface RoleQuickActionSpec {
  title: string;
  sub: string;
  icon: string;
  tone: string;
  route: string;
}

export interface RoleDefinition {
  id: UserRoleId;
  title: string;
  shortTitle: string;
  group: RoleGroup;
  groupLabel: string;
  description: string;
  icon: string;
  defaultRoute: string;
  allowedSections: string[];
  dockTabs: RoleDockTabSpec[];
  quickActions: RoleQuickActionSpec[];
  canCreateRoles: UserRoleId[];
  scopeLevel: 'complex' | 'block' | 'unit';
}

export type BlockSharePermission =
  | 'finance'
  | 'excel_import'
  | 'facilities'
  | 'caretaker'
  | 'notices';

export interface BlockAccessGrant {
  blockId: string;
  grantedByUserId: string;
  grantedByName: string;
  grantedAtMs: number;
  permissions: BlockSharePermission[];
}

export interface RbacUserRecord {
  id: string;
  username: string;
  displayName: string;
  role: UserRoleId;
  blockId: string | null; // primary block: null = entire complex, 'A' | 'B' | 'C' = specific block
  caretakerBlockIds?: string[]; // explicit list of blocks a caretaker account is authorized to access (persisted in NoSQL)
  assignedBlocks?: BlockAccessGrant[]; // additional blocks explicitly shared by their Block Managers!
  unitCode: string | null; // e.g. 'B-208' for resident
  phone?: string;
  avatarDataUrl?: string;
  bio?: string;
  createdByUserId: string | null;
  createdByName?: string;
  isTemporary: boolean;
  accessDurationLabel?: string;
  validFromMs: number | null;
  validUntilMs: number | null;
  active: boolean;
  createdAtMs: number;
  preferences?: UserAppearancePrefs;
}

export const ROLE_DEFINITIONS: Record<UserRoleId, RoleDefinition> = {
  complex_manager: {
    id: 'complex_manager',
    title: 'مدیر کل شهرک',
    shortTitle: 'مدیر شهرک',
    group: 'complex',
    groupLabel: 'سطح مدیریت شهرک',
    description: 'دسترسی کامل به همه بلوک‌ها، تعریف مدیران بلوک و کادر، مالی، تاسیسات و انتظامات',
    icon: 'corporate_fare',
    defaultRoute: '/m/dashboard',
    allowedSections: ['dashboard', 'block', 'facilities', 'finance', 'letters', 'guard', 'forms', 'chat', 'notifications', 'users'],
    dockTabs: [
      { id: 'dashboard', label: 'خانه', icon: 'home' },
      { id: 'block', label: 'بلوک‌ها و کادر', icon: 'building' },
      { id: 'finance', label: 'مالی و حسابداری', icon: 'wallet' },
      { id: 'facilities', label: 'تاسیسات', icon: 'wrench' },
      { id: 'chat', label: 'گفتگوها', icon: 'chat' },
    ],
    quickActions: [
      { title: 'پیام‌رسان شهرک', sub: 'چت مدیران، ساکنین و گروه‌های بلوک', icon: 'forum', tone: 'bg-primary-container/60 text-on-primary-container', route: 'chat' },
      { title: 'مدیریت اکسل بانکی', sub: 'پترن واریزی، نگاشت ستون‌ها و تطبیق شارژ', icon: 'table_view', tone: 'bg-secondary-container/60 text-on-secondary-container', route: 'finance?tab=excel' },
      { title: 'مدیریت اکانت سرایداران', sub: 'تعریف نام کاربری، رمز عبور و دسترسی بلوک‌ها', icon: 'cleaning_services', tone: 'bg-primary-container/60 text-on-primary-container', route: 'block?tab=caretakers' },
      { title: 'تعریف مدیر / پرسنل', sub: 'ساخت مدیر بلوک، حسابدار یا سرایدار', icon: 'person_add', tone: 'bg-primary-container/60 text-on-primary-container', route: 'block?tab=staff' },
      { title: 'ثبت سند حسابداری', sub: 'دفتر روزنامه دوطرفه شهرک', icon: 'account_balance', tone: 'bg-secondary-container/60 text-on-secondary-container', route: 'finance?tab=accountant' },
      { title: 'ارسال اعلان به بلوک', sub: 'اطلاع‌رسانی مستقیم به ساکنین', icon: 'campaign', tone: 'bg-primary-container/50 text-on-primary-container', route: 'block?tab=overview' },
      { title: 'ثبت تردد و پلاک', sub: 'گیت ورودی و پلاک‌خوان ایران', icon: 'directions_car', tone: 'bg-surface-container-high text-on-surface', route: 'guard?tab=gate' },
      { title: 'گزارش فوری نشتی', sub: 'ثبت پرونده بحران تاسیسات', icon: 'water_damage', tone: 'bg-error-container/75 text-on-error-container', route: 'facilities?tab=leaks' },
      { title: 'دبیرخانه و نامه‌ها', sub: 'کارتابل مکاتبات رسمی شهرک', icon: 'mail', tone: 'bg-secondary-container/50 text-on-secondary-container', route: 'letters?view=cartable' },
    ],
    canCreateRoles: [
      'block_manager',
      'complex_accountant',
      'facilities_chief',
      'block_accountant',
      'block_facilities',
      'block_caretaker',
      'temp_caretaker',
      'gate_guard',
      'resident',
    ],
    scopeLevel: 'complex',
  },

  complex_accountant: {
    id: 'complex_accountant',
    title: 'مدیر حسابداری شهرک',
    shortTitle: 'حسابدار شهرک',
    group: 'complex',
    groupLabel: 'سطح مدیریت شهرک',
    description: 'حسابداری دوطرفه تجمیعی، تراز آزمایشی، صورت‌های مالی، تنخواه، اسناد پایا و تایید فیش‌ها',
    icon: 'account_balance',
    defaultRoute: '/m/finance?tab=accountant',
    allowedSections: ['finance', 'dashboard', 'letters', 'chat', 'notifications'],
    dockTabs: [
      { id: 'finance?tab=accountant', label: 'میز حسابدار', icon: 'wallet' },
      { id: 'finance?tab=units', label: 'واحدها و شارژ', icon: 'building' },
      { id: 'finance?tab=petty', label: 'تنخواه و بودجه', icon: 'receipt' },
      { id: 'finance?tab=reconcile', label: 'تطبیق بانکی', icon: 'clipboard' },
      { id: 'chat', label: 'گفتگوها', icon: 'chat' },
    ],
    quickActions: [
      { title: 'گفتگو با مدیران', sub: 'چت با مدیر کل، مدیران بلوک و گروه‌ها', icon: 'forum', tone: 'bg-primary-container/60 text-on-primary-container', route: 'chat' },
      { title: 'مدیریت اکسل بانکی', sub: 'پترن واریزی و تطبیق خودکار با شارژ', icon: 'table_view', tone: 'bg-secondary-container/60 text-on-secondary-container', route: 'finance?tab=excel' },
      { title: 'ثبت سند دوطرفه', sub: 'صدور سند جدید در دفتر روزنامه', icon: 'menu_book', tone: 'bg-primary-container/60 text-on-primary-container', route: 'finance?tab=accountant' },
      { title: 'تایید فیش‌های ساکنین', sub: 'صف فیش‌های واریزی در انتظار سند', icon: 'payments', tone: 'bg-secondary-container/60 text-on-secondary-container', route: 'finance?tab=accountant' },
      { title: 'تنخواه و بودجه', sub: 'بررسی انحراف بودجه و شارژ تنخواه', icon: 'analytics', tone: 'bg-primary-container/50 text-on-primary-container', route: 'finance?tab=petty' },
      { title: 'اسناد پایا و چک‌ها', sub: 'مدیریت اسناد پرداختی پیمانکاران', icon: 'receipt_long', tone: 'bg-surface-container-high text-on-surface', route: 'finance?tab=voucher' },
    ],
    canCreateRoles: [],
    scopeLevel: 'complex',
  },

  facilities_chief: {
    id: 'facilities_chief',
    title: 'سرپرست کل تاسیسات',
    shortTitle: 'سرپرست تاسیسات',
    group: 'complex',
    groupLabel: 'سطح مدیریت شهرک',
    description: 'مدیریت بحران نشتی‌ها، نقشه‌های شیرآلات کل شهرک، نظارت بر مسئولین تاسیسات بلوک‌ها',
    icon: 'engineering',
    defaultRoute: '/m/facilities?tab=leaks',
    allowedSections: ['facilities', 'block', 'guard', 'letters', 'chat', 'notifications'],
    dockTabs: [
      { id: 'facilities?tab=leaks', label: 'نشتی و حوادث', icon: 'wrench' },
      { id: 'facilities?tab=blueprints', label: 'نقشه‌ها و شیرآلات', icon: 'building' },
      { id: 'block?tab=requests', label: 'خرابی واحدها', icon: 'clipboard' },
      { id: 'guard?tab=directives', label: 'هماهنگی گیت', icon: 'shield' },
      { id: 'chat', label: 'گفتگوها', icon: 'chat' },
    ],
    quickActions: [
      { title: 'چت تیم تاسیسات و مدیران', sub: 'گفتگوی سریع با مدیران بلوک و انتظامات', icon: 'forum', tone: 'bg-primary-container/60 text-on-primary-container', route: 'chat' },
      { title: 'ثبت گزارش نشتی', sub: 'اعلام حادثه جدید و قطع شیر فلکه', icon: 'water_damage', tone: 'bg-error-container/75 text-on-error-container', route: 'facilities?tab=leaks' },
      { title: 'تعریف مسئول تاسیسات بلوک', sub: 'اختصاص تکنسین به هر بلوک', icon: 'person_add', tone: 'bg-primary-container/60 text-on-primary-container', route: 'block?tab=staff' },
      { title: 'خرابی‌های ثبت‌شده ساکنین', sub: 'بررسی تصاویر و ارجاع تعمیرکار', icon: 'build', tone: 'bg-secondary-container/60 text-on-secondary-container', route: 'block?tab=requests' },
      { title: 'نقشه‌های فنی و رایزرها', sub: 'دسترسی سریع به کد شیرآلات', icon: 'architecture', tone: 'bg-surface-container-high text-on-surface', route: 'facilities?tab=blueprints' },
    ],
    canCreateRoles: ['block_facilities'],
    scopeLevel: 'complex',
  },

  block_manager: {
    id: 'block_manager',
    title: 'مدیر بلوک',
    shortTitle: 'مدیر بلوک',
    group: 'block',
    groupLabel: 'سطح مدیریت و کادر بلوک',
    description: 'پنل اختصاصی مدیریت بلوک، تعریف سرایدار دائم و موقت، حسابدار و تاسیسات بلوک، ابلاغ تسک و پاسخ به ساکنین',
    icon: 'apartment',
    defaultRoute: '/m/block?tab=overview',
    allowedSections: ['block', 'finance', 'facilities', 'letters', 'guard', 'chat', 'notifications'],
    dockTabs: [
      { id: 'block?tab=overview', label: 'پنل بلوک', icon: 'building' },
      { id: 'block?tab=staff', label: 'کادر و موقت', icon: 'users' },
      { id: 'block?tab=tasks', label: 'وظایف سرایدار', icon: 'clipboard' },
      { id: 'block?tab=requests', label: 'خرابی واحدها', icon: 'wrench' },
      { id: 'chat', label: 'گفتگوها', icon: 'chat' },
    ],
    quickActions: [
      { title: 'صفحه چت و پیام‌رسان', sub: 'گفتگو با ساکنین، سایر مدیران و کادر بلوک', icon: 'forum', tone: 'bg-primary-container/60 text-on-primary-container', route: 'chat' },
      { title: 'مدیریت اکسل بانکی', sub: 'پترن واریزی، نگاشت ستون‌ها و تسویه شارژ', icon: 'table_view', tone: 'bg-secondary-container/60 text-on-secondary-container', route: 'block?tab=excel' },
      { title: 'مدیریت اکانت سرایداران', sub: 'نام کاربری، رمز عبور و دسترسی بلوک', icon: 'cleaning_services', tone: 'bg-primary-container/60 text-on-primary-container', route: 'block?tab=caretakers' },
      { title: 'تعریف سرایدار موقت', sub: 'دسترسی ۱۲ ساعته، ۱ روزه، ۲ روزه یا دلخواه', icon: 'schedule_send', tone: 'bg-primary-container/60 text-on-primary-container', route: 'block?tab=staff' },
      { title: 'ابلاغ تسک به سرایدار', sub: 'تعریف کار جدید و بررسی انجام کار', icon: 'assignment_add', tone: 'bg-secondary-container/60 text-on-secondary-container', route: 'block?tab=tasks' },
      { title: 'اعلان به ساکنین بلوک', sub: 'ارسال اطلاعیه به همه یا یک واحد', icon: 'campaign', tone: 'bg-primary-container/50 text-on-primary-container', route: 'block?tab=overview' },
      { title: 'گزارش خرابی ساکنین', sub: 'مشاهده عکس خرابی و ارجاع به تاسیسات', icon: 'build', tone: 'bg-error-container/75 text-on-error-container', route: 'block?tab=requests' },
    ],
    canCreateRoles: [
      'block_accountant',
      'block_facilities',
      'block_caretaker',
      'temp_caretaker',
      'gate_guard',
      'resident',
    ],
    scopeLevel: 'block',
  },

  block_accountant: {
    id: 'block_accountant',
    title: 'حسابدار بلوک',
    shortTitle: 'حسابدار بلوک',
    group: 'block',
    groupLabel: 'سطح مدیریت و کادر بلوک',
    description: 'مدیریت شارژ و بدهی واحدهای بلوک، تایید فیش‌های واریزی ساکنین و ثبت سند در دفتر روزنامه',
    icon: 'calculate',
    defaultRoute: '/m/finance?tab=accountant',
    allowedSections: ['finance', 'block', 'chat', 'notifications'],
    dockTabs: [
      { id: 'finance?tab=accountant', label: 'دفاتر بلوک', icon: 'wallet' },
      { id: 'finance?tab=units', label: 'واحدهای بلوک', icon: 'building' },
      { id: 'finance?tab=charge', label: 'شارژ و قبض', icon: 'receipt' },
      { id: 'chat', label: 'گفتگوها', icon: 'chat' },
    ],
    quickActions: [
      { title: 'چت با مدیر و ساکنین', sub: 'هماهنگی مالی و فیش‌های واریزی', icon: 'forum', tone: 'bg-primary-container/60 text-on-primary-container', route: 'chat' },
      { title: 'مدیریت اکسل بانکی', sub: 'تطبیق اکسل بانک با شارژ واحدهای بلوک', icon: 'table_view', tone: 'bg-secondary-container/60 text-on-secondary-container', route: 'finance?tab=excel' },
      { title: 'تایید فیش‌های ساکنین', sub: 'ثبت خودکار سند در دفاتر بلوک', icon: 'payments', tone: 'bg-secondary-container/60 text-on-secondary-container', route: 'finance?tab=accountant' },
      { title: 'ثبت سند جدید', sub: 'ثبت سند دوطرفه هزینه‌های بلوک', icon: 'menu_book', tone: 'bg-primary-container/60 text-on-primary-container', route: 'finance?tab=accountant' },
      { title: 'معوقات واحدهای بلوک', sub: 'بررسی بدهکاران و ارسال یادآوری', icon: 'domain', tone: 'bg-error-container/75 text-on-error-container', route: 'finance?tab=units' },
      { title: 'پوستر مالی لابی', sub: 'چاپ گزارش شفافیت شارژ بلوک', icon: 'print', tone: 'bg-surface-container-high text-on-surface', route: 'finance?tab=poster' },
    ],
    canCreateRoles: [],
    scopeLevel: 'block',
  },

  block_facilities: {
    id: 'block_facilities',
    title: 'مسئول تاسیسات بلوک',
    shortTitle: 'تاسیسات بلوک',
    group: 'block',
    groupLabel: 'سطح مدیریت و کادر بلوک',
    description: 'رسیدگی به خرابی‌های ثبت‌شده ساکنین بلوک، پرونده‌های نشتی آب و نقشه‌های شیرآلات بلوک',
    icon: 'handyman',
    defaultRoute: '/m/facilities?tab=leaks',
    allowedSections: ['facilities', 'block', 'chat', 'notifications'],
    dockTabs: [
      { id: 'facilities?tab=leaks', label: 'نشتی بلوک', icon: 'wrench' },
      { id: 'block?tab=requests', label: 'خرابی واحدها', icon: 'clipboard' },
      { id: 'facilities?tab=blueprints', label: 'نقشه بلوک', icon: 'building' },
      { id: 'chat', label: 'گفتگوها', icon: 'chat' },
    ],
    quickActions: [
      { title: 'چت با مدیر و تاسیسات', sub: 'هماهنگی تعمیرات و اعزام به واحدها', icon: 'forum', tone: 'bg-primary-container/60 text-on-primary-container', route: 'chat' },
      { title: 'خرابی‌های واحدها', sub: 'بررسی عکس‌های ارسالی ساکنین بلوک', icon: 'build', tone: 'bg-primary-container/60 text-on-primary-container', route: 'block?tab=requests' },
      { title: 'ثبت گزارش نشتی', sub: 'اعلام فوری نشتی و درخواست بستن شیر', icon: 'water_damage', tone: 'bg-error-container/75 text-on-error-container', route: 'facilities?tab=leaks' },
      { title: 'نقشه شیرآلات بلوک', sub: 'یافتن سریع رایزر و شیر فلکه واحد', icon: 'architecture', tone: 'bg-secondary-container/60 text-on-secondary-container', route: 'facilities?tab=blueprints' },
    ],
    canCreateRoles: [],
    scopeLevel: 'block',
  },

  block_caretaker: {
    id: 'block_caretaker',
    title: 'سرایدار دائم بلوک',
    shortTitle: 'سرایدار بلوک',
    group: 'block',
    groupLabel: 'سطح مدیریت و کادر بلوک',
    description: 'دریافت وظایف و چک‌لیست از مدیر بلوک، ثبت گزارش و عکس انجام کار، اعلام اشکالات مشاعات',
    icon: 'cleaning_services',
    defaultRoute: '/m/caretaker?tab=tasks',
    allowedSections: ['caretaker', 'chat', 'notifications'],
    dockTabs: [
      { id: 'caretaker?tab=tasks', label: 'وظایف من', icon: 'clipboard' },
      { id: 'caretaker?tab=done', label: 'تاییدشده‌ها', icon: 'building' },
      { id: 'caretaker?tab=report', label: 'گزارش مشاعات', icon: 'wrench' },
      { id: 'chat', label: 'گفتگوها', icon: 'chat' },
    ],
    quickActions: [
      { title: 'چت با مدیر بلوک و گیت', sub: 'پیام‌رسان هماهنگی شیفت و مشاعات', icon: 'forum', tone: 'bg-primary-container/60 text-on-primary-container', route: 'chat' },
      { title: 'وظایف در انتظار انجام', sub: 'مشاهده تسک‌های ابلاغی مدیر بلوک', icon: 'checklist', tone: 'bg-primary-container/60 text-on-primary-container', route: 'caretaker?tab=tasks' },
      { title: 'گزارش مشکل مشاعات', sub: 'اعلام خرابی لامپ، آسانسور یا نظافت', icon: 'report_problem', tone: 'bg-error-container/75 text-on-error-container', route: 'caretaker?tab=report' },
    ],
    canCreateRoles: [],
    scopeLevel: 'block',
  },

  temp_caretaker: {
    id: 'temp_caretaker',
    title: 'سرایدار موقت / کمکی',
    shortTitle: 'سرایدار موقت',
    group: 'block',
    groupLabel: 'سطح مدیریت و کادر بلوک',
    description: 'دسترسی زمان‌دار (نصف روز / ۱ روز / ۲ روز / بازه دلخواه) برای انجام وظایف ابلاغی مدیر بلوک',
    icon: 'schedule',
    defaultRoute: '/m/caretaker?tab=tasks',
    allowedSections: ['caretaker', 'chat', 'notifications'],
    dockTabs: [
      { id: 'caretaker?tab=tasks', label: 'وظایف شیفت', icon: 'clipboard' },
      { id: 'caretaker?tab=done', label: 'انجام‌شده', icon: 'building' },
      { id: 'caretaker?tab=report', label: 'اعلام مشکل', icon: 'wrench' },
      { id: 'chat', label: 'گفتگوها', icon: 'chat' },
    ],
    quickActions: [
      { title: 'چت با مدیر بلوک', sub: 'هماهنگی سریع وظایف شیفت موقت', icon: 'forum', tone: 'bg-primary-container/60 text-on-primary-container', route: 'chat' },
      { title: 'تسک‌های شیفت موقت', sub: 'انجام وظایف ابلاغ‌شده قبل از پایان مهلت', icon: 'checklist', tone: 'bg-primary-container/60 text-on-primary-container', route: 'caretaker?tab=tasks' },
      { title: 'گزارش فوری به مدیر بلوک', sub: 'ثبت مورد اضطراری در مشاعات', icon: 'report_problem', tone: 'bg-error-container/75 text-on-error-container', route: 'caretaker?tab=report' },
    ],
    canCreateRoles: [],
    scopeLevel: 'block',
  },

  gate_guard: {
    id: 'gate_guard',
    title: 'نگهبان ورودی و گیت',
    shortTitle: 'نگهبان گیت',
    group: 'security',
    groupLabel: 'انتظامات و پلاک‌خوان',
    description: 'ثبت تردد با پلاک واقعی ایران، کنترل مجوزهای مهمان ثبت‌شده توسط ساکنین، اجرای دستورات مدیریت',
    icon: 'shield',
    defaultRoute: '/m/guard?tab=gate',
    allowedSections: ['guard', 'chat', 'notifications'],
    dockTabs: [
      { id: 'guard?tab=gate', label: 'تردد و پلاک', icon: 'car' },
      { id: 'guard?tab=permits', label: 'مجوز مهمان', icon: 'clipboard' },
      { id: 'guard?tab=directives', label: 'دستورات', icon: 'shield' },
      { id: 'chat', label: 'گفتگوها', icon: 'chat' },
    ],
    quickActions: [
      { title: 'چت انتظامات و مدیران', sub: 'ارتباط مستقیم با مدیران بلوک و ساکنین', icon: 'forum', tone: 'bg-primary-container/60 text-on-primary-container', route: 'chat' },
      { title: 'ثبت ورود/خروج خودرو', sub: 'ورودی پلاک واقعی ۱۴گانه ایران', icon: 'directions_car', tone: 'bg-primary-container/60 text-on-primary-container', route: 'guard?tab=gate' },
      { title: 'مجوزهای مهمان ساکنین', sub: 'تایید ورود مهمان‌های ثبت‌شده', icon: 'badge', tone: 'bg-secondary-container/60 text-on-secondary-container', route: 'guard?tab=permits' },
      { title: 'دستورات فوری مدیران', sub: 'بستن شیر فلکه و کنترل باربری', icon: 'assignment_late', tone: 'bg-error-container/75 text-on-error-container', route: 'guard?tab=directives' },
    ],
    canCreateRoles: [],
    scopeLevel: 'complex',
  },

  resident: {
    id: 'resident',
    title: 'ساکن واحد (مالک / مستأجر)',
    shortTitle: 'پنل ساکن',
    group: 'resident',
    groupLabel: 'پنل اختصاصی ساکنین',
    description: 'مکاتبه با مدیر بلوک، ثبت مهمان در انتظامات، اعلام خرابی واحد با عکس، ارسال فیش شارژ و اعلان‌ها',
    icon: 'home',
    defaultRoute: '/m/resident?tab=home',
    allowedSections: ['resident', 'chat', 'notifications'],
    dockTabs: [
      { id: 'resident?tab=home', label: 'واحد من', icon: 'user_home' },
      { id: 'resident?tab=charge', label: 'شارژ و فیش', icon: 'receipt' },
      { id: 'resident?tab=guest', label: 'مهمان گیت', icon: 'car' },
      { id: 'resident?tab=repair', label: 'خرابی واحد', icon: 'wrench' },
      { id: 'chat', label: 'گفتگوها', icon: 'chat' },
    ],
    quickActions: [
      { title: 'ارسال فیش شارژ', sub: 'آپلود تصویر فیش و تایید خودکار حسابدار', icon: 'receipt_long', tone: 'bg-secondary-container/60 text-on-secondary-container', route: 'resident?tab=charge' },
      { title: 'ثبت مهمان در انتظامات', sub: 'ثبت پلاک مهمان برای ورود سریع از گیت', icon: 'directions_car', tone: 'bg-primary-container/60 text-on-primary-container', route: 'resident?tab=guest' },
      { title: 'اعلام خرابی با تصویر', sub: 'ارسال عکس خرابی واحد به مدیر و تاسیسات', icon: 'add_a_photo', tone: 'bg-error-container/75 text-on-error-container', route: 'resident?tab=repair' },
      { title: 'صفحه چت و پیام‌رسان', sub: 'گفتگو با مدیر بلوک، گیت و گروه بلوک', icon: 'forum', tone: 'bg-primary-container/50 text-on-primary-container', route: 'chat' },
    ],
    canCreateRoles: [],
    scopeLevel: 'unit',
  },
};

export const ROLE_ORDER: UserRoleId[] = [
  'complex_manager',
  'complex_accountant',
  'facilities_chief',
  'block_manager',
  'block_accountant',
  'block_facilities',
  'block_caretaker',
  'temp_caretaker',
  'gate_guard',
  'resident',
];

/**
 * Pure hierarchical authorization check: determines whether `creator` is permitted
 * to provision a user with `targetRole` inside `targetBlockId`.
 */
export function canCreateRole(
  creatorRole: UserRoleId,
  targetRole: UserRoleId,
  creatorBlockId: string | null,
  targetBlockId: string | null,
): { ok: boolean; reason?: string } {
  const def = ROLE_DEFINITIONS[creatorRole];
  if (!def || !def.canCreateRoles.includes(targetRole)) {
    return {
      ok: false,
      reason: `نقش «${def?.title ?? creatorRole}» مجاز به تعریف نقش «${ROLE_DEFINITIONS[targetRole]?.title ?? targetRole}» نیست.`,
    };
  }
  // Block-scoped creators can ONLY create users within their own block
  if (def.scopeLevel === 'block') {
    if (!creatorBlockId) {
      return { ok: false, reason: 'بلوک تحت مدیریت شما مشخص نیست.' };
    }
    if (targetBlockId && targetBlockId !== creatorBlockId) {
      return {
        ok: false,
        reason: `مدیر بلوک ${creatorBlockId} فقط مجاز به تعریف پرسنل و ساکنین برای بلوک ${creatorBlockId} است.`,
      };
    }
  }
  return { ok: true };
}

/**
 * Pure time-bounded access verification for permanent and temporary/relief staff.
 */
export function isUserAccessActive(
  user: Pick<RbacUserRecord, 'active' | 'isTemporary' | 'validFromMs' | 'validUntilMs'>,
  nowMs: number = Date.now(),
): { active: boolean; remainingMs?: number; reason?: string } {
  if (!user.active) {
    return { active: false, reason: 'دسترسی این حساب کاربری توسط مدیر غیرفعال شده است.' };
  }
  if (user.isTemporary) {
    if (user.validFromMs && nowMs < user.validFromMs) {
      return {
        active: false,
        reason: 'بازه زمانی دسترسی موقت این حساب هنوز شروع نشده است.',
      };
    }
    if (user.validUntilMs && nowMs > user.validUntilMs) {
      return {
        active: false,
        remainingMs: 0,
        reason: 'مهلت دسترسی موقت این حساب به پایان رسیده است؛ لطفاً از مدیر بلوک درخواست تمدید کنید.',
      };
    }
    if (user.validUntilMs) {
      return {
        active: true,
        remainingMs: Math.max(0, user.validUntilMs - nowMs),
      };
    }
  }
  return { active: true };
}

/**
 * Computes exact start/end epoch window for temporary caretaker/helper presets
 * (half day = 12h, 1 day = 24h, 2 days = 48h, or custom date-time interval).
 */
export function computeTempWindow(
  preset: TempDurationPreset,
  nowMs: number = Date.now(),
  customFromMs?: number | null,
  customUntilMs?: number | null,
): { validFromMs: number; validUntilMs: number; label: string } {
  if (preset === 'half_day') {
    return {
      validFromMs: nowMs,
      validUntilMs: nowMs + 12 * 3600_000,
      label: 'نصف روز (۱۲ ساعت)',
    };
  }
  if (preset === 'one_day') {
    return {
      validFromMs: nowMs,
      validUntilMs: nowMs + 24 * 3600_000,
      label: '۱ روز کامل (۲۴ ساعت)',
    };
  }
  if (preset === 'two_days') {
    return {
      validFromMs: nowMs,
      validUntilMs: nowMs + 48 * 3600_000,
      label: '۲ روز (۴۸ ساعت)',
    };
  }
  const from = typeof customFromMs === 'number' && Number.isFinite(customFromMs) ? customFromMs : nowMs;
  const until =
    typeof customUntilMs === 'number' && Number.isFinite(customUntilMs) && customUntilMs > from
      ? customUntilMs
      : from + 24 * 3600_000;
  const hours = Math.max(1, Math.round((until - from) / 3600_000));
  return {
    validFromMs: from,
    validUntilMs: until,
    label: `بازه اختصاصی (${hours.toLocaleString('fa-IR')} ساعت)`,
  };
}

export function formatRemainingDurationFa(remainingMs: number): string {
  if (remainingMs <= 0) return 'منقضی شده';
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days.toLocaleString('fa-IR')} روز`);
  if (hours > 0) parts.push(`${hours.toLocaleString('fa-IR')} ساعت`);
  if (days === 0 && mins > 0) parts.push(`${mins.toLocaleString('fa-IR')} دقیقه`);
  return parts.join(' و ') || 'کمتر از ۱ دقیقه';
}

export function canAccessBlock(
  user: Pick<RbacUserRecord, 'role' | 'blockId' | 'assignedBlocks' | 'caretakerBlockIds'>,
  targetBlockId: string | null,
): boolean {
  const def = ROLE_DEFINITIONS[user.role];
  if (!def) return false;
  if (def.scopeLevel === 'complex') return true;
  if (!targetBlockId) return false;
  if (user.blockId === targetBlockId) return true;
  if (user.caretakerBlockIds?.includes(targetBlockId)) return true;
  return Boolean(user.assignedBlocks?.some((g) => g.blockId === targetBlockId));
}

export function getUserAccessibleBlockIds(
  user: Pick<RbacUserRecord, 'role' | 'blockId' | 'assignedBlocks' | 'caretakerBlockIds'>,
  allBlockIds: string[],
): string[] {
  const def = ROLE_DEFINITIONS[user.role];
  if (!def) return [];
  if (def.scopeLevel === 'complex') return [...allBlockIds];
  const allowed = new Set<string>();
  if (user.blockId) allowed.add(user.blockId);
  for (const id of user.caretakerBlockIds ?? []) {
    if (id) allowed.add(id);
  }
  for (const grant of user.assignedBlocks ?? []) {
    if (grant.blockId) allowed.add(grant.blockId);
  }
  return allBlockIds.filter((id) => allowed.has(id));
}
