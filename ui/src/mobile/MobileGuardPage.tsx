import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CarFront,
  CheckCheck,
  Mail,
  Send,
  Shield,
  ShieldAlert,
} from 'lucide-react';
import { mobileApi, type MobileBootstrap } from './mobileApi';
import { captureNativePhotoBase64, compressImageFileToBase64 } from './nativeBridge';
import {
  MButton,
  MCard,
  MEmptyState,
  MInput,
  MListItem,
  MPill,
  MSectionHeader,
  MSelect,
  MTextarea,
} from './components';

interface Props {
  bootstrap: MobileBootstrap;
  onSyncChanged: () => void;
}

export const MobileGuardPage: React.FC<Props> = ({ bootstrap, onSyncChanged }) => {
  const [tab, setTab] = useState<'gate' | 'directives' | 'incident'>('gate');
  const [summary, setSummary] = useState<{
    directives: Array<Record<string, any>>;
    recent_events: Array<Record<string, any>>;
    guest_permits: Array<Record<string, any>>;
    incidents: Array<Record<string, any>>;
  } | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'info' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Entry/Exit state
  const [direction, setDirection] = useState<'entry' | 'exit'>('entry');
  const [plateText, setPlateText] = useState('');
  const [guestName, setGuestName] = useState('');
  const [unitLabel, setUnitLabel] = useState('');
  const [gateNote, setGateNote] = useState('');
  const [gatePhotoB64, setGatePhotoB64] = useState('');

  // Manager directive compose state
  const [dirSubject, setDirSubject] = useState('');
  const [dirBody, setDirBody] = useState('');
  const [dirPlate, setDirPlate] = useState('');
  const [dirPriority, setDirPriority] = useState<'normal' | 'urgent' | 'immediate'>('urgent');

  // Incident state
  const [incTitle, setIncTitle] = useState('');
  const [incDesc, setIncDesc] = useState('');
  const [incLocation, setIncLocation] = useState('');
  const [incPhotoB64, setIncPhotoB64] = useState('');

  const loadSummary = useCallback(async () => {
    if (!bootstrap.license.guard_enabled) return;
    try {
      const res = await mobileApi.guardSummary();
      if (res.data) setSummary(res.data);
    } catch {
      /* handled in UI if offline */
    }
  }, [bootstrap.license.guard_enabled]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  if (!bootstrap.license.guard_enabled || !bootstrap.license.alpr_addon_enabled) {
    return (
      <MCard dir="rtl">
        <div className="d-flex align-items-center gap-2 mb-2" style={{ color: 'var(--m-warning)' }}>
          <ShieldAlert size={22} />
          <h6 className="fw-bold mb-0">ماژول انتظامات غیرفعال است</h6>
        </div>
        <p className="small text-muted-adaptive mb-0">
          بخش انتظامات، ورود و خروج و نامه‌نگاری مستقیم به نگهبانی فقط در صورتی فعال است که ماژول دوربین و پلاک‌خوان روی لایسنس این شهرک یا ساختمان فعال باشد.
        </p>
      </MCard>
    );
  }

  const pickPhoto = async (setter: (b64: string) => void, file?: File | null) => {
    try {
      if (file) {
        setter(await compressImageFileToBase64(file));
        return;
      }
      const cap = await captureNativePhotoBase64();
      if (cap) setter(cap);
    } catch (err) {
      setNotice({ tone: 'danger', text: err instanceof Error ? err.message : 'آماده‌سازی عکس ناموفق بود.' });
    }
  };

  const submitEntryExit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setBusy(true);
    try {
      const res = await mobileApi.recordGuardEntryExit({
        direction,
        plate_text: plateText,
        guest_name: guestName,
        unit_label: unitLabel,
        note: gateNote,
        photo_base64: gatePhotoB64,
      });
      setPlateText('');
      setGuestName('');
      setGateNote('');
      setGatePhotoB64('');
      onSyncChanged();
      void loadSummary();
      setNotice({
        tone: res.queuedOffline ? 'info' : 'success',
        text: res.queuedOffline ? 'تردد در صف آفلاین / صندوق پیام ثبت شد.' : 'ورود/خروج در دفتر انتظامات ثبت شد.',
      });
    } catch (err) {
      setNotice({ tone: 'danger', text: err instanceof Error ? err.message : 'خطا در ثبت تردد.' });
    } finally {
      setBusy(false);
    }
  };

  const handleAck = async (id: string, status: 'acknowledged' | 'completed') => {
    setBusy(true);
    try {
      await mobileApi.ackGuardDirective(id, status);
      void loadSummary();
      onSyncChanged();
      setNotice({ tone: 'success', text: status === 'completed' ? 'اجرای دستور ثبت شد.' : 'دریافت دستور تأیید شد.' });
    } catch (err) {
      setNotice({ tone: 'danger', text: err instanceof Error ? err.message : 'ثبت وضعیت ناموفق بود.' });
    } finally {
      setBusy(false);
    }
  };

  const submitDirective = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const res = await mobileApi.sendGuardDirective({
        directiveType: 'gate_order',
        subject: dirSubject,
        body: dirBody,
        plateText: dirPlate,
        priority: dirPriority,
      });
      setDirSubject('');
      setDirBody('');
      setDirPlate('');
      void loadSummary();
      onSyncChanged();
      setNotice({
        tone: res.queuedOffline ? 'info' : 'success',
        text: res.queuedOffline ? 'نامه انتظامات در صف رمزشده ارسال شد.' : 'دستور برای انتظامات ارسال شد.',
      });
    } catch (err) {
      setNotice({ tone: 'danger', text: err instanceof Error ? err.message : 'ارسال دستور ناموفق بود.' });
    } finally {
      setBusy(false);
    }
  };

  const submitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const res = await mobileApi.reportGuardIncident({
        title: incTitle,
        description: incDesc,
        location: incLocation,
        severity: 'high',
        photo_base64: incPhotoB64,
      });
      setIncTitle('');
      setIncDesc('');
      setIncLocation('');
      setIncPhotoB64('');
      void loadSummary();
      onSyncChanged();
      setNotice({
        tone: res.queuedOffline ? 'info' : 'success',
        text: res.queuedOffline ? 'گزارش حادثه در صف ارسال قرار گرفت.' : 'گزارش حادثه ثبت و ارسال شد.',
      });
    } catch (err) {
      setNotice({ tone: 'danger', text: err instanceof Error ? err.message : 'ثبت حادثه ناموفق بود.' });
    } finally {
      setBusy(false);
    }
  };

  const sentDirectives = summary?.directives.filter((d) => d.status === 'sent').length ?? 0;

  return (
    <div className="d-flex flex-column gap-3" dir="rtl">
      <MCard>
        <MSectionHeader
          title="کارتابل انتظامات و دروازه"
          sub="ورود/خروج، دستورها و گزارش حادثه"
          action={<MPill tone="success">ماژول دوربین فعال</MPill>}
        />
        <div className="d-flex gap-2">
          <MButton small block variant={tab === 'gate' ? 'primary' : 'secondary'} onClick={() => setTab('gate')}>
            ورود / خروج
          </MButton>
          <MButton small block variant={tab === 'directives' ? 'primary' : 'secondary'} onClick={() => setTab('directives')}>
            نامه‌ها ({sentDirectives.toLocaleString('fa-IR')})
          </MButton>
          <MButton small block variant={tab === 'incident' ? 'primary' : 'secondary'} onClick={() => setTab('incident')}>
            گزارش حادثه
          </MButton>
        </div>
      </MCard>

      {notice && (
        <div className={`m-note m-note--${notice.tone}`} role="alert">
          {notice.tone === 'danger' ? <AlertTriangle size={18} /> : notice.tone === 'info' ? <CarFront size={18} /> : <CheckCheck size={18} />}
          <span>{notice.text}</span>
        </div>
      )}

      {tab === 'gate' && (
        <>
          <MCard>
            <form onSubmit={submitEntryExit} className="d-flex flex-column gap-3">
              <div className="d-flex gap-2">
                <MButton type="button" small block variant={direction === 'entry' ? 'primary' : 'secondary'} onClick={() => setDirection('entry')}>
                  ثبت ورود
                </MButton>
                <MButton type="button" small block variant={direction === 'exit' ? 'primary' : 'secondary'} onClick={() => setDirection('exit')}>
                  ثبت خروج
                </MButton>
              </div>
              <MInput
                label="پلاک خودرو"
                placeholder="مثلاً 12ب345-44"
                value={plateText}
                onChange={(e) => setPlateText(e.target.value)}
              />
              <MInput
                label="نام مهمان / راننده"
                placeholder="نام مهمان یا راننده"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
              <MInput
                label="واحد / بلوک مقصد"
                placeholder="واحد یا بلوک مقصد"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
              />
              <label className="m-btn m-btn--secondary w-100 d-flex align-items-center justify-content-center gap-2 mb-0">
                <Camera size={16} />
                <span>{gatePhotoB64 ? 'عکس پیوست شد (تغییر)' : 'عکس دوربین / کارت (اختیاری)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => void pickPhoto(setGatePhotoB64, e.target.files?.[0])}
                />
              </label>
              <MButton type="submit" block loading={busy}>
                {busy ? 'در حال ثبت...' : direction === 'entry' ? 'ثبت ورود خودرو / مهمان' : 'ثبت خروج'}
              </MButton>
            </form>
          </MCard>

          <div>
            <MSectionHeader title="آخرین ترددها" sub="۸ مورد اخیر" />
            {(summary?.recent_events ?? []).length === 0 ? (
              <MCard flat>
                <MEmptyState icon={<CarFront size={28} />} title="ترددی ثبت نشده است" desc="هنوز ورود یا خروجی در دفتر انتظامات ثبت نشده است." />
              </MCard>
            ) : (
              <MCard flat className="p-0" style={{ overflow: 'hidden' }}>
                {(summary?.recent_events ?? [])
                  .slice(0, 8)
                  .map((ev) => (
                    <MListItem
                      key={ev.id}
                      lead={<CarFront size={18} />}
                      title={ev.plate_text || ev.guest_name || 'بدون نام'}
                      sub={`واحد: ${ev.unit_label || '-'}`}
                      trail={
                        <MPill tone={ev.direction === 'exit' ? 'neutral' : 'success'}>
                          {ev.direction === 'exit' ? 'خروج' : 'ورود'}
                        </MPill>
                      }
                    />
                  ))}
              </MCard>
            )}
          </div>
        </>
      )}

      {tab === 'directives' && (
        <>
          <MCard>
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
              <Mail size={16} />
              <span>ارسال نامه / دستور فوری به انتظامات</span>
            </h6>
            <form onSubmit={submitDirective} className="d-flex flex-column gap-3">
              <MInput
                label="موضوع دستور"
                placeholder="مثلاً ممانعت از خروج بار بدون برگه"
                value={dirSubject}
                onChange={(e) => setDirSubject(e.target.value)}
                required
              />
              <div className="d-flex gap-2 align-items-end">
                <div className="flex-grow-1">
                  <MInput
                    label="پلاک مرتبط"
                    placeholder="اختیاری"
                    value={dirPlate}
                    onChange={(e) => setDirPlate(e.target.value)}
                  />
                </div>
                <MSelect
                  label="فوریت"
                  value={dirPriority}
                  options={[
                    { value: 'normal', label: 'عادی' },
                    { value: 'urgent', label: 'فوری' },
                    { value: 'immediate', label: 'آنی' },
                  ]}
                  onChange={(e) => setDirPriority(e.target.value as 'normal' | 'urgent' | 'immediate')}
                />
              </div>
              <MTextarea
                label="شرح دستور"
                placeholder="شرح دستور برای انتظامات..."
                value={dirBody}
                onChange={(e) => setDirBody(e.target.value)}
                required
              />
              <MButton type="submit" block loading={busy} icon={<Send size={15} />}>
                ارسال به انتظامات
              </MButton>
            </form>
          </MCard>

          <div className="d-flex flex-column gap-2">
            {(summary?.directives ?? []).length === 0 && (
              <MCard flat>
                <MEmptyState icon={<Mail size={28} />} title="دستوری وجود ندارد" desc="هنوز نامه یا دستوری به انتظامات ارسال نشده است." />
              </MCard>
            )}
            {(summary?.directives ?? []).map((dir) => (
              <MCard key={dir.id}>
                <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                  <strong>{dir.subject}</strong>
                  <MPill tone={dir.status === 'completed' ? 'success' : dir.status === 'acknowledged' ? 'info' : 'warning'}>
                    {dir.status === 'completed' ? 'انجام شد' : dir.status === 'acknowledged' ? 'دریافت شد' : 'جدید'}
                  </MPill>
                </div>
                <p className="small mb-2" style={{ margin: 0 }}>{dir.body}</p>
                {dir.plate_text && <div className="small text-muted-adaptive mb-1">پلاک: {dir.plate_text}</div>}
                <div className="d-flex justify-content-between align-items-center small text-muted-adaptive mb-2">
                  <span>فرستنده: {dir.sender_name}</span>
                  {dir.ack_by_name && <span>تأیید: {dir.ack_by_name}</span>}
                </div>
                {dir.status !== 'completed' && (
                  <div className="d-flex gap-2">
                    {dir.status === 'sent' && (
                      <MButton type="button" small block variant="secondary" disabled={busy} onClick={() => void handleAck(dir.id, 'acknowledged')}>
                        دریافت شد
                      </MButton>
                    )}
                    <MButton type="button" small block disabled={busy} onClick={() => void handleAck(dir.id, 'completed')} icon={<CheckCheck size={15} />}>
                      انجام شد
                    </MButton>
                  </div>
                )}
              </MCard>
            ))}
          </div>
        </>
      )}

      {tab === 'incident' && (
        <MCard>
          <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
            <AlertTriangle size={18} />
            <span>ثبت گزارش حادثه / تخلف</span>
          </h6>
          <form onSubmit={submitIncident} className="d-flex flex-column gap-3">
            <MInput label="عنوان حادثه" placeholder="عنوان حادثه" value={incTitle} onChange={(e) => setIncTitle(e.target.value)} required />
            <MInput label="مکان / دروازه / بلوک" placeholder="مکان رخ‌داد" value={incLocation} onChange={(e) => setIncLocation(e.target.value)} />
            <MTextarea label="شرح دقیق حادثه" placeholder="شرح دقیق حادثه..." value={incDesc} onChange={(e) => setIncDesc(e.target.value)} required />
            <label className="m-btn m-btn--secondary w-100 d-flex align-items-center justify-content-center gap-2 mb-0">
              <Camera size={16} />
              <span>{incPhotoB64 ? 'تصویر حادثه پیوست شد' : 'گرفتن عکس از حادثه'}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => void pickPhoto(setIncPhotoB64, e.target.files?.[0])}
              />
            </label>
            <MButton type="submit" block loading={busy}>
              {busy ? 'در حال ارسال...' : 'ارسال گزارش حادثه'}
            </MButton>
          </form>
        </MCard>
      )}
    </div>
  );
};