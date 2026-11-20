import React, { useEffect, useState } from 'react';
import { CheckCircle2, CloudOff, FileText, Send, ShieldAlert } from 'lucide-react';
import { mobileApi, type MobileBootstrap, type MobileFormTemplate } from './mobileApi';
import { MButton, MCard, MInput, MSectionHeader, MSelect, MTextarea } from './components';

const DRAFTS_KEY = 'alpr_mobile_form_drafts_v1';

interface Props {
  bootstrap: MobileBootstrap;
  onSyncChanged: () => void;
}

export const MobileFormsPage: React.FC<Props> = ({ bootstrap, onSyncChanged }) => {
  const [forms, setForms] = useState<MobileFormTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() => {
    try {
      const raw = window.localStorage.getItem(DRAFTS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, Record<string, string>>) : {};
    } catch {
      return {};
    }
  });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'info' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    void mobileApi
      .listForms()
      .then((res) => {
        const list = res.data?.forms ?? [];
        setForms(list);
        if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
      })
      .catch(() => undefined);
  }, []);

  const currentForm = forms.find((f) => f.id === selectedId) ?? forms[0] ?? null;
  const currentData = (currentForm ? values[currentForm.id] : undefined) ?? {};

  const updateField = (formId: string, name: string, val: string) => {
    setValues((prev) => {
      const next = { ...prev, [formId]: { ...(prev[formId] ?? {}), [name]: val } };
      try {
        window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const canWriteSection = (sectionId: string) =>
    bootstrap.permissions[sectionId] === 'write' || bootstrap.user.role === 'admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentForm) return;
    setFeedback(null);
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { ...currentData };
      if (!payload.blockId && bootstrap.user.allowed_block_ids.length === 1) {
        payload.blockId = bootstrap.user.allowed_block_ids[0];
      }
      if (currentForm.id === 'meter_reading' && payload.currReading != null) {
        payload.currReading = Number(payload.currReading);
      }
      const res = await mobileApi.submitForm(currentForm.id, payload);
      setValues((prev) => {
        const next = { ...prev, [currentForm.id]: {} };
        try {
          window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      onSyncChanged();
      if (res.queuedOffline) {
        setFeedback({
          tone: 'info',
          text:
            res.via === 'relay'
              ? 'سرور شهرک موقتاً آفلاین بود؛ فرم به‌صورت رمزشده در صندوق پیام کلادفلر قرار گرفت.'
              : 'اتصال اینترنت برقرار نبود؛ فرم در صف آفلاین گوشی ذخیره شد و با اولین اتصال ارسال می‌شود.',
        });
      } else {
        setFeedback({ tone: 'success', text: 'فرم با موفقیت ثبت و در سامانه ذخیره شد.' });
      }
    } catch (err) {
      setFeedback({ tone: 'danger', text: err instanceof Error ? err.message : 'ثبت فرم ناموفق بود.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-3" dir="rtl">
      <MCard>
        <MSectionHeader title="فرم‌های عملیاتی" sub="پیش‌نویس خودکار روی گوشی شما ذخیره می‌شود" />
        <div className="d-flex flex-wrap gap-2">
          {forms.map((form) => (
            <MButton
              key={form.id}
              small
              variant={currentForm?.id === form.id ? 'primary' : 'secondary'}
              onClick={() => {
                setSelectedId(form.id);
                setFeedback(null);
              }}
            >
              {form.title}
            </MButton>
          ))}
        </div>
      </MCard>

      {feedback && (
        <div className={`m-note m-note--${feedback.tone}`} role="alert">
          {feedback.tone === 'info' ? <CloudOff size={18} /> : <CheckCircle2 size={18} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {currentForm && (
        <MCard>
          <h6 className="fw-bold mb-3">{currentForm.title}</h6>
          {!canWriteSection(currentForm.section) && (
            <div className="m-note m-note--warning mb-3">
              <ShieldAlert size={18} />
              <span>دسترسی شما به بخش «{currentForm.title}» فقط خواندنی است و امکان ثبت نهایی وجود ندارد.</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            {currentForm.fields.map((field) => {
              const val = currentData[field.name] ?? '';
              if (field.type === 'textarea') {
                return (
                  <MTextarea
                    key={field.name}
                    label={field.label}
                    required={field.required}
                    value={val}
                    onChange={(e) => updateField(currentForm.id, field.name, e.target.value)}
                  />
                );
              }
              if (field.type === 'select') {
                return (
                  <MSelect
                    key={field.name}
                    label={field.label}
                    required={field.required}
                    value={val || field.options?.[0] || ''}
                    options={(field.options ?? []).map((opt) => ({ value: opt, label: opt }))}
                    onChange={(e) => updateField(currentForm.id, field.name, e.target.value)}
                  />
                );
              }
              return (
                <MInput
                  key={field.name}
                  label={field.label}
                  required={field.required}
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={val}
                  onChange={(e) => updateField(currentForm.id, field.name, e.target.value)}
                />
              );
            })}

            <MButton
              type="submit"
              block
              loading={busy}
              disabled={!canWriteSection(currentForm.section)}
              icon={<Send size={16} />}
            >
              {busy ? 'در حال ثبت...' : 'ثبت فرم'}
            </MButton>
          </form>
        </MCard>
      )}

      {forms.length === 0 && (
        <MCard flat className="text-center text-muted-adaptive">
          <FileText size={22} className="mb-2" />
          <div>در حال بارگذاری فرم‌ها...</div>
        </MCard>
      )}
    </div>
  );
};