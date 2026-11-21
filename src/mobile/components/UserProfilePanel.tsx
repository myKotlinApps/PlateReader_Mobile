import React, { useEffect, useState } from 'react';
import { Camera, Moon, Sun, Trash2, User } from 'lucide-react';
import { rbacApi } from '../rbac/rbacApi';
import { ROLE_DEFINITIONS, type RbacUserRecord } from '../rbac/roles';
import { compressImageFileToBase64 } from '../nativeBridge';
import {
  DEFAULT_APPEARANCE_PREFS,
  type UserAppearancePrefs,
} from '../theme/palettes';
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel';
import { NoticeBanner, SectionHeader, StatusPill, StitchButton, SurfaceCard } from '../ui/StitchKit';

interface Props {
  user: RbacUserRecord;
  onUserUpdated: (user: RbacUserRecord) => void;
  appearancePrefs: UserAppearancePrefs;
  onChangeAppearancePrefs: (next: UserAppearancePrefs) => void;
  dark: boolean;
  onToggleTheme: () => void;
  compact?: boolean;
}

export const UserProfilePanel: React.FC<Props> = ({
  user,
  onUserUpdated,
  appearancePrefs,
  onChangeAppearancePrefs,
  dark,
  onToggleTheme,
  compact = false,
}) => {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [phone, setPhone] = useState(user.phone || '');
  const [bio, setBio] = useState(user.bio || '');
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(user.avatarDataUrl || null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);

  useEffect(() => {
    setDisplayName(user.displayName);
    setPhone(user.phone || '');
    setBio(user.bio || '');
    setAvatarDataUrl(user.avatarDataUrl || null);
  }, [user.id, user.displayName, user.phone, user.bio, user.avatarDataUrl]);

  const roleDef = ROLE_DEFINITIONS[user.role];

  const handleAvatarFile = async (file?: File | null) => {
    if (!file) return;
    setUploadingPhoto(true);
    setFeedback(null);
    try {
      const compressed = await compressImageFileToBase64(file);
      setAvatarDataUrl(compressed);
      const res = await rbacApi.updateMyProfile({ avatarDataUrl: compressed });
      onUserUpdated(res.user);
      setFeedback({
        tone: 'success',
        text: 'تصویر پروفایل شما ذخیره شد و در دیتابیس NoSQL به‌روزرسانی گردید.',
      });
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'بارگذاری تصویر پروفایل ناموفق بود.',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingPhoto(true);
    setFeedback(null);
    try {
      const res = await rbacApi.updateMyProfile({ avatarDataUrl: null });
      setAvatarDataUrl(null);
      onUserUpdated(res.user);
      setFeedback({
        tone: 'info',
        text: 'تصویر پروفایل حذف شد.',
      });
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'حذف تصویر ناموفق بود.',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await rbacApi.updateMyProfile({
        displayName: displayName.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
      });
      onUserUpdated(res.user);
      setFeedback({
        tone: 'success',
        text: 'اطلاعات پروفایل کاربری شما در دیتابیس ذخیره شد.',
      });
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ذخیره اطلاعات پروفایل ناموفق بود.',
      });
    } finally {
      setSaving(false);
    }
  };

  const profileBody = (
    <div className="space-y-4" dir="rtl">
      {feedback && (
        <NoticeBanner
          message={feedback.text}
          tone={feedback.tone}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Avatar & Identity Header */}
      <div className="p-3.5 rounded-[var(--ui-card-radius)] bg-surface-container-low/80 border border-outline-variant/55 flex items-center gap-3.5 flex-wrap">
        <div className="relative shrink-0">
          {avatarDataUrl ? (
            <img
              src={avatarDataUrl}
              alt={user.displayName}
              className="w-16 h-16 rounded-full object-cover border-2 border-primary/70 shadow-sm"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary-container text-on-primary-container border-2 border-primary/40 flex items-center justify-center">
              <User size={28} strokeWidth={1.9} />
            </div>
          )}
          <label
            className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center cursor-pointer shadow-md hover:opacity-95 transition-opacity"
            title="آپلود تصویر پروفایل"
          >
            <Camera size={14} strokeWidth={2.2} />
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={uploadingPhoto}
              onChange={(e) => void handleAvatarFile(e.target.files?.[0])}
            />
          </label>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <strong className="text-[14.5px] font-bold text-on-surface truncate">
              {user.displayName}
            </strong>
            <StatusPill label={roleDef.title} tone="primary" />
          </div>
          <div className="text-[12px] text-on-surface-variant flex items-center gap-2 flex-wrap">
            <span className="font-mono" dir="ltr">@{user.username}</span>
            <span>•</span>
            <span>
              {user.unitCode
                ? `واحد ${user.unitCode}`
                : user.blockId
                  ? `بلوک ${user.blockId}`
                  : 'سطح کل شهرک'}
            </span>
          </div>
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <label className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-[var(--ui-btn-radius)] bg-primary-container/60 text-on-primary-container text-[11.5px] font-semibold cursor-pointer hover:bg-primary-container transition-colors">
              <Camera size={14} />
              <span>{uploadingPhoto ? 'در حال آپلود...' : 'تغییر تصویر پروفایل'}</span>
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={uploadingPhoto}
                onChange={(e) => void handleAvatarFile(e.target.files?.[0])}
              />
            </label>
            {avatarDataUrl && (
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => void handleRemoveAvatar()}
                className="inline-flex items-center gap-1 px-2.5 h-8 rounded-[var(--ui-btn-radius)] bg-error-container/75 text-on-error-container text-[11.5px] font-semibold hover:opacity-90"
              >
                <Trash2 size={13} />
                <span>حذف عکس</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Editable Profile Info Form */}
      <form onSubmit={handleSaveProfile} className="space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label
              htmlFor="prof-name"
              className="block text-[12px] font-semibold text-on-surface-variant mb-1"
            >
              نام نمایشی در سامانه
            </label>
            <input
              id="prof-name"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
            />
          </div>
          <div>
            <label
              htmlFor="prof-phone"
              className="block text-[12px] font-semibold text-on-surface-variant mb-1"
            >
              شماره تماس
            </label>
            <input
              id="prof-phone"
              type="text"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912..."
              className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="prof-bio"
            className="block text-[12px] font-semibold text-on-surface-variant mb-1"
          >
            سمت یا یادداشت کوتاه پروفایل (اختیاری)
          </label>
          <input
            id="prof-bio"
            type="text"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="مثلاً: پاسخگویی روزانه ۹ تا ۲۰ • بلوک B"
            className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
          <button
            type="button"
            onClick={onToggleTheme}
            className="h-9 px-3 rounded-[var(--ui-btn-radius)] border border-outline-variant/60 bg-surface-container-low hover:bg-surface-container text-on-surface text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            {dark ? <Sun size={15} className="text-primary" /> : <Moon size={15} className="text-primary" />}
            <span>{dark ? 'حالت تیره فعال است (تغییر به روشن)' : 'حالت روشن فعال است (تغییر به تیره)'}</span>
          </button>

          <StitchButton type="submit" size="sm" disabled={saving} icon="save">
            {saving ? 'در حال ذخیره...' : 'ذخیره اطلاعات پروفایل'}
          </StitchButton>
        </div>
      </form>

      {/* Personalization: Sharp/Curved + 6 Modern Trend Palettes */}
      <div className="pt-3 border-t border-outline-variant/40">
        <AppearanceSettingsPanel
          compact
          prefs={appearancePrefs ?? DEFAULT_APPEARANCE_PREFS}
          onChangePrefs={onChangeAppearancePrefs}
          userDisplayName={user.displayName}
        />
      </div>
    </div>
  );

  if (compact) return profileBody;

  return (
    <SurfaceCard className="space-y-3">
      <SectionHeader
        title="پروفایل کاربری و شخصی‌سازی ظاهر"
        icon="account_circle"
        action={<StatusPill label="ذخیره در NoSQL" tone="positive" />}
      />
      {profileBody}
    </SurfaceCard>
  );
};
