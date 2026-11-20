import React from 'react';
import { Building2, FileText, Inbox, Mail, RefreshCw, Shield, Wallet } from 'lucide-react';
import type { MobileBootstrap } from './mobileApi';
import { MCard, MPill, MSectionHeader, MStatTile } from './components';

interface Props {
  bootstrap: MobileBootstrap;
  outboxCount: number;
  onNavigate: (tab: string) => void;
}

const TIER_LABEL: Record<string, string> = {
  building_tower: 'ساختمان / برج (زیر ۳ بلوک)',
  small_township: 'شهرک کوچک (۳ تا ۱۴ بلوک)',
  super_township: 'سوپر شهرک چندفازی',
};

interface ModuleCard {
  id: string;
  label: string;
  desc: string;
  Icon: typeof FileText;
  show: boolean;
}

export const MobileDashboardPage: React.FC<Props> = ({ bootstrap, outboxCount, onNavigate }) => {
  const fa = (n: number) => n.toLocaleString('fa-IR');
  const hasCamera = bootstrap.license.alpr_addon_enabled;
  const blocks = bootstrap.user.allowed_block_ids;

  const modules: ModuleCard[] = [
    {
      id: 'forms',
      label: 'فرم‌ها',
      desc: `${fa(bootstrap.counters.open_work_orders)} مورد باز`,
      Icon: FileText,
      show: true,
    },
    {
      id: 'letters',
      label: 'نامه‌نگاری',
      desc: 'کارتابل و ارسال نامه',
      Icon: Mail,
      show: bootstrap.mobile_modules.includes('letters'),
    },
    {
      id: 'finance',
      label: 'مالی بلوک',
      desc: 'شارژ و بدهی واحدها',
      Icon: Wallet,
      show: bootstrap.mobile_modules.includes('finance'),
    },
    {
      id: 'guard',
      label: 'انتظامات',
      desc: `${fa(bootstrap.counters.unread_guard_directives)} دستور خوانده‌نشده`,
      Icon: Shield,
      show: Boolean(bootstrap.license.guard_enabled && bootstrap.mobile_modules.includes('guard')),
    },
  ];

  return (
    <div className="d-flex flex-column gap-3" dir="rtl">
      {/* Org hero */}
      <MCard>
        <div className="d-flex align-items-start justify-content-between gap-2">
          <div className="d-flex align-items-center gap-2">
            <span className="m-list-item__lead">
              <Building2 size={20} />
            </span>
            <div>
              <div className="fw-bold">{bootstrap.organization_name || 'سامانه مدیریت شهرک'}</div>
              <div className="small text-muted-adaptive">خوش آمدید، {bootstrap.user.display_name}</div>
            </div>
          </div>
          <MPill tone="accent">v{bootstrap.server_version}</MPill>
        </div>

        <div className="d-flex flex-wrap gap-2 mt-3">
          <MPill>{TIER_LABEL[bootstrap.license.scale_tier] || bootstrap.license.scale_tier}</MPill>
          <MPill tone={hasCamera ? 'success' : 'neutral'}>
            {hasCamera ? 'ماژول دوربین: فعال' : 'فقط شهرک (بدون دوربین)'}
          </MPill>
          {blocks.length > 0 && <MPill>بلوک: {blocks.join('، ')}</MPill>}
        </div>
      </MCard>

      {/* Counters */}
      <div>
        <MSectionHeader title="شمارنده‌ها" sub="آخرین وضعیت همگام‌سازی" />
        <div className="row g-2">
          <div className="col-6">
            <MStatTile
              value={fa(bootstrap.counters.open_work_orders)}
              label="فرم باز"
              icon={<Inbox size={18} />}
              onClick={() => onNavigate('forms')}
            />
          </div>
          <div className="col-6">
            <MStatTile
              value={fa(bootstrap.counters.unread_guard_directives)}
              label="دستور خوانده‌نشده"
              icon={<Shield size={18} />}
              onClick={() => onNavigate('guard')}
            />
          </div>
        </div>
      </div>

      {/* Modules */}
      <div>
        <MSectionHeader title="ماژول‌ها" sub="دسترسی بر اساس مجوز شما" />
        <div className="row g-2">
          {modules
            .filter((m) => m.show)
            .map(({ id, label, desc, Icon }) => (
              <div className="col-6" key={id}>
                <MCard interactive className="h-100" onClick={() => onNavigate(id)}>
                  <span className="m-list-item__lead mb-2">
                    <Icon size={18} />
                  </span>
                  <div className="fw-bold">{label}</div>
                  <div className="small text-muted-adaptive">{desc}</div>
                </MCard>
              </div>
            ))}
        </div>
      </div>

      {/* Offline queue */}
      {outboxCount > 0 && (
        <MCard flat className="d-flex align-items-center gap-2 p-3">
          <span className="m-stat-tile__icon flex-shrink-0">
            <RefreshCw size={18} />
          </span>
          <div className="small">
            {fa(outboxCount)} مورد در صف ارسال آفلاین ذخیره شده است و با دکمهٔ «همگام‌سازی» در بالا ارسال می‌شود.
          </div>
        </MCard>
      )}
    </div>
  );
};