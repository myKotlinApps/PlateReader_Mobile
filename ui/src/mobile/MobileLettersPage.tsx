import React, { useCallback, useEffect, useState } from 'react';
import { Inbox, Mail, MailPlus, Send } from 'lucide-react';
import { mobileApi, type MobileBootstrap } from './mobileApi';
import { MButton, MCard, MEmptyState, MInput, MListItem, MPill, MSectionHeader, MSelect, MTextarea } from './components';

interface Props {
  bootstrap: MobileBootstrap;
  onSyncChanged: () => void;
}

const GUARD_POS_IDS = new Set(['pos_tw_guard_chief', 'pos_off_sec_mgr', 'pos_off_guard_op']);

export const MobileLettersPage: React.FC<Props> = ({ bootstrap, onSyncChanged }) => {
  const [folder, setFolder] = useState<'inbox' | 'sent' | 'compose'>('inbox');
  const [items, setItems] = useState<Array<Record<string, any>>>([]);
  const [positions, setPositions] = useState<Array<{ id: string; title: string }>>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [targetPosId, setTargetPosId] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent' | 'immediate'>('normal');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const loadLetters = useCallback(async () => {
    try {
      const [boot, cart] = await Promise.all([
        mobileApi.correspondenceBootstrap().catch(() => null),
        mobileApi.correspondenceCartable(folder === 'sent' ? 'sent' : 'inbox').catch(() => null),
      ]);
      const allPos = ((boot?.data?.org_positions ?? []) as Array<{ id: string; title: string }>).filter(
        (p) => bootstrap.license.alpr_addon_enabled || !GUARD_POS_IDS.has(p.id),
      );
      setPositions(allPos);
      if (allPos.length > 0 && !targetPosId) {
        setTargetPosId(allPos[0].id);
      }
      setItems((cart?.data?.items ?? []) as Array<Record<string, any>>);
    } catch {
      /* offline */
    }
  }, [folder, bootstrap.license.alpr_addon_enabled, targetPosId]);

  useEffect(() => {
    if (folder !== 'compose') void loadLetters();
  }, [folder, loadLetters]);

  const handleCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback('');
    try {
      const res = await mobileApi.correspondenceSave({
        letter_type: 'internal',
        subject,
        body_plain_text: body,
        priority,
        classification: 'normal',
        recipients: targetPosId
          ? [{ recipient_kind: 'to', target_position_id: targetPosId, action_type: 'for_action' }]
          : [],
        submit_immediately: true,
      });
      setSubject('');
      setBody('');
      onSyncChanged();
      setFeedback(
        res.queuedOffline
          ? 'نامه در صف آفلاین ذخیره شد و به‌محض اتصال ارسال می‌شود.'
          : 'نامه رسمی ثبت و ارسال شد.',
      );
      setFolder('inbox');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'ارسال نامه ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-3" dir="rtl">
      <MCard>
        <MSectionHeader title="کارتابل نامه‌نگاری" sub="وارده، صادره و نگارش نامه" />
        <div className="d-flex gap-2">
          <MButton small block variant={folder === 'inbox' ? 'primary' : 'secondary'} onClick={() => setFolder('inbox')} icon={<Inbox size={15} />}>
            وارده
          </MButton>
          <MButton small block variant={folder === 'sent' ? 'primary' : 'secondary'} onClick={() => setFolder('sent')}>
            صادره
          </MButton>
          <MButton small block variant={folder === 'compose' ? 'primary' : 'secondary'} onClick={() => setFolder('compose')} icon={<MailPlus size={15} />}>
            نامه جدید
          </MButton>
        </div>
      </MCard>

      {feedback && (
        <div className="m-note m-note--info" role="alert">
          <Inbox size={18} />
          <span>{feedback}</span>
        </div>
      )}

      {folder === 'compose' ? (
        <MCard>
          <h6 className="fw-bold mb-3">نگارش نامه جدید</h6>
          <form onSubmit={handleCompose} className="d-flex flex-column gap-3">
            <MSelect
              label="گیرنده"
              value={targetPosId}
              options={positions.map((pos) => ({ value: pos.id, label: pos.title }))}
              onChange={(e) => setTargetPosId(e.target.value)}
              hint={!bootstrap.license.alpr_addon_enabled ? 'نامه‌نگاری به انتظامات نیازمند فعال‌بودن ماژول دوربین در لایسنس است.' : undefined}
            />
            <MSelect
              label="فوریت"
              value={priority}
              options={[
                { value: 'normal', label: 'عادی' },
                { value: 'urgent', label: 'فوری' },
                { value: 'immediate', label: 'آنی' },
              ]}
              onChange={(e) => setPriority(e.target.value as 'normal' | 'urgent' | 'immediate')}
            />
            <MInput label="موضوع" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            <MTextarea label="متن نامه" value={body} onChange={(e) => setBody(e.target.value)} required />
            <MButton type="submit" block loading={busy} icon={<Send size={15} />}>
              {busy ? 'در حال ارسال...' : 'ثبت و ارسال نامه'}
            </MButton>
          </form>
        </MCard>
      ) : items.length === 0 ? (
        <MCard flat>
          <MEmptyState icon={<Inbox size={28} />} title="نامه‌ای وجود ندارد" desc="در این پوشه موردی ثبت نشده است." />
        </MCard>
      ) : (
        <MCard flat className="p-0" style={{ overflow: 'hidden' }}>
          {items.map((item, idx) => (
            <MListItem
              key={item.id ?? idx}
              lead={<Mail size={18} />}
              title={item.subject}
              sub={item.summary || item.sender_title || '—'}
              trail={
                <span className="d-flex flex-column align-items-end gap-1">
                  <MPill tone="info">{item.indicator_number || item.lifecycle_state}</MPill>
                  {item.jalali_date_str && <span className="small text-muted-adaptive">{item.jalali_date_str}</span>}
                </span>
              }
            />
          ))}
        </MCard>
      )}
    </div>
  );
};