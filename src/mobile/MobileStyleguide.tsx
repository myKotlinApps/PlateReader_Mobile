import React, { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Home,
  CheckCircle2,
  FileText,
  Inbox,
  Mail,
  Plus,
  Shield,
  Wallet,
} from 'lucide-react';
import {
  MAppBar,
  MBottomNav,
  MButton,
  MCard,
  MEmptyState,
  MErrorState,
  MFab,
  MInput,
  MListItem,
  MPill,
  MSectionHeader,
  MSelect,
  MSheet,
  MSkeleton,
  MSnackbar,
  MStatTile,
  MTextarea,
} from './components';

/**
 * Dev-only visual review surface for the Shahrak Mobile Design System.
 * Reachable at /m/_styleguide in `vite dev` only; never rendered in prod.
 */
const MobileStyleguide: React.FC = () => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [snack, setSnack] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('app-skin-dark', next);
  };

  const fa = (n: number) => n.toLocaleString('fa-IR');

  return (
    <div className="alpr-mobile-shell" dir="rtl">
      <MAppBar
        title="راهنمای طراحی موبایل"
        subtitle="Shahrak Mobile Design System"
        leading={
          <span className="alpr-mobile-pill">
            <span>v1.8.0</span>
          </span>
        }
        trailing={
          <MButton variant="secondary" small onClick={toggleTheme}>
            {dark ? 'تم روشن' : 'تم تیره'}
          </MButton>
        }
      />

      <main className="container-fluid py-3 px-3 flex-grow-1" style={{ maxWidth: 680 }}>
        <MSectionHeader title="دکمه‌ها" sub="MButton — برند سرمه‌ای، hover کم‌رنگ‌تر" />
        <div className="d-flex flex-wrap gap-2 mb-4">
          <MButton variant="primary">ثبت</MButton>
          <MButton variant="tonal">پیش‌نویس</MButton>
          <MButton variant="secondary">انصراف</MButton>
          <MButton variant="text">بیشتر</MButton>
          <MButton variant="danger">حذف</MButton>
          <MButton variant="primary" loading>در حال ارسال</MButton>
        </div>

        <MSectionHeader title="برچسب‌ها" sub="MPill — وضعیت‌ها با کنتراست رعایت‌شده" />
        <div className="d-flex flex-wrap gap-2 mb-4">
          <MPill>خنثی</MPill>
          <MPill tone="success" icon={<CheckCircle2 size={13} />}>فعال</MPill>
          <MPill tone="warning">در انتظار</MPill>
          <MPill tone="danger">رد شده</MPill>
          <MPill tone="info">اطلاع</MPill>
          <MPill tone="accent">ماژول دوربین</MPill>
        </div>

        <MSectionHeader title="کارت‌های آماری" sub="MStatTile — اعداد فارسی tabular" />
        <div className="row g-2 mb-4">
          <div className="col-6">
            <MStatTile value={fa(128)} label="فرم باز" icon={<FileText size={18} />} />
          </div>
          <div className="col-6">
            <MStatTile value={fa(7)} label="دستور خوانده‌نشده" icon={<Shield size={18} />} />
          </div>
        </div>

        <MSectionHeader title="لیست" sub="MListItem" />
        <MCard flat className="p-0 mb-4" style={{ overflow: 'hidden' }}>
          <MListItem lead={<Mail size={18} />} title="نامهٔ شمارهٔ ۱۴۰۵/۲۳۱" sub="از: مدیریت بلوک الف" trail={<MPill tone="info">جدید</MPill>} />
          <MListItem lead={<Wallet size={18} />} title="شارژ واحد ۱۲" sub="بدهی: ۲٬۵۰۰٬۰۰۰ ریال" trail={<MPill tone="warning">معوق</MPill>} />
          <MListItem lead={<Bell size={18} />} title="اعلان سامانه" sub="سامانه به‌روزرسانی شد" />
        </MCard>

        <MSectionHeader title="فرم" sub="MInput / MSelect / MTextarea" />
        <MCard className="mb-4">
          <div className="d-flex flex-column gap-3">
            <MInput label="عنوان" placeholder="مثلاً گزارش خرابی آسانسور" required />
            <MSelect label="بخش" options={[{ value: 'a', label: 'بلوک الف' }, { value: 'b', label: 'بلوک ب' }]} />
            <MTextarea label="توضیحات" placeholder="شرح کامل…" hint="حداکثر ۵۰۰ نویسه" />
            <MInput label="کد ملی" error="کد ملی باید ۱۰ رقم باشد." defaultValue="123" />
          </div>
        </MCard>

        <MSectionHeader title="بارگذاری" sub="MSkeleton" />
        <MCard className="mb-4">
          <div className="d-flex flex-column gap-2">
            <MSkeleton height={18} width="60%" />
            <MSkeleton height={14} />
            <MSkeleton height={14} width="80%" />
          </div>
        </MCard>

        <MSectionHeader title="حالت تهی / خطا" sub="MEmptyState / MErrorState" />
        <MCard className="mb-4">
          <MEmptyState icon={<Inbox size={28} />} title="صندوق خالی است" desc="هنوز نامه‌ای دریافت نکرده‌اید." />
        </MCard>
        <MCard className="mb-4">
          <MErrorState
            icon={<AlertTriangle size={28} />}
            title="اتصال برقرار نشد"
            desc="شبکه را بررسی کنید و دوباره تلاش کنید."
            action={<MButton variant="tonal" small>تلاش دوباره</MButton>}
          />
        </MCard>

        <MSectionHeader title="لایه‌ها" sub="MSheet / MSnackbar / MFab" />
        <div className="d-flex flex-wrap gap-2 mb-5">
          <MButton variant="primary" onClick={() => setSheetOpen(true)}>بازکردن شیت</MButton>
          <MButton variant="tonal" onClick={() => setSnack(true)}>نمایش اسنک‌بار</MButton>
        </div>
      </main>

      <MFab icon={<Plus size={20} />} onClick={() => setSheetOpen(true)}>جدید</MFab>

      <MSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="ثبت مورد جدید"
        footer={<MButton block onClick={() => setSheetOpen(false)}>ثبت</MButton>}
      >
        <div className="d-flex flex-column gap-3">
          <MInput label="عنوان" placeholder="عنوان مورد" required />
          <MTextarea label="توضیحات" placeholder="شرح…" />
        </div>
      </MSheet>

      {snack && <MSnackbar message="با موفقیت ذخیره شد" tone="success" icon={<CheckCircle2 size={16} />} onDismiss={() => setSnack(false)} />}

      <MBottomNav
        active="dashboard"
        onChange={() => {}}
        items={[
          { id: 'dashboard', label: 'داشبورد', icon: <Home size={19} /> },
          { id: 'forms', label: 'فرم‌ها', icon: <FileText size={19} /> },
          { id: 'letters', label: 'نامه‌ها', icon: <Mail size={19} /> },
          { id: 'finance', label: 'مالی', icon: <Wallet size={19} />, badge: 3 },
        ]}
      />
    </div>
  );
};

export default MobileStyleguide;