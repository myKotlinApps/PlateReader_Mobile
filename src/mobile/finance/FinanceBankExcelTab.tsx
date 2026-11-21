import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  matchBankStatementRows,
  SAMPLE_BANK_STATEMENT_ROWS,
  type ExcelBankPatternConfig,
  type ExcelCustomFieldMapping,
  type ExcelUnitMatchMode,
} from '../accounting/excelMatcher';
import { rbacApi } from '../rbac/rbacApi';
import type {
  BlockDoc,
  ExcelBankPatternDoc,
  ExcelImportBatchDoc,
  UnitDoc,
} from '../../server/nosqlStore';
import { formatAmountFa, toPersianDigits } from '../utils/persianMoney';
import { JalaliDateTimePicker } from '../components/JalaliDateTimePicker';
import {
  EmptyState,
  NoticeBanner,
  SectionHeader,
  StatusPill,
  StitchButton,
  SurfaceCard,
} from '../ui/StitchKit';

interface Props {
  selectedBlockId: string;
  accessibleBlocks: BlockDoc[];
  units: UnitDoc[];
  onCommitted: () => Promise<void> | void;
  onFeedback: (msg: string) => void;
}

const DEFAULT_CUSTOM_FIELDS: ExcelCustomFieldMapping[] = [
  { id: 'cf_unit', fieldLabel: 'شماره واحد', sourceType: 'unit_from_last_digits' },
  { id: 'cf_resident', fieldLabel: 'واریزکننده (ساکن)', sourceType: 'resident_from_unit' },
  { id: 'cf_time', fieldLabel: 'زمان واریز', sourceType: 'column', columnName: 'تاریخ واریز' },
];

export const FinanceBankExcelTab: React.FC<Props> = ({
  selectedBlockId,
  accessibleBlocks,
  units,
  onCommitted,
  onFeedback,
}) => {
  const effectiveBlockId =
    selectedBlockId && selectedBlockId !== 'ALL'
      ? selectedBlockId
      : accessibleBlocks[0]?.id || 'B';

  const [patterns, setPatterns] = useState<ExcelBankPatternDoc[]>([]);
  const [batches, setBatches] = useState<ExcelImportBatchDoc[]>([]);
  const [activePatternId, setActivePatternId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [localMsg, setLocalMsg] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(
    null,
  );

  // Period & Bank Settings (Jalali Dates!)
  const [periodStart, setPeriodStart] = useState('۱۴۰۵/۰۸/۰۱');
  const [periodEnd, setPeriodEnd] = useState('۱۴۰۵/۰۸/۳۰');
  const [bankAccountCode, setBankAccountCode] = useState<'1102' | '1103'>('1102');

  // Pattern Config Form
  const [patternName, setPatternName] = useState('الگوی بانک پاسارگاد (۲ رقم آخر = واحد)');
  const [amountColumn, setAmountColumn] = useState('واریز');
  const [dateColumn, setDateColumn] = useState('تاریخ واریز');
  const [traceColumn, setTraceColumn] = useState('شماره پیگیری');
  const [descriptionColumn, setDescriptionColumn] = useState('شرح تراکنش');
  const [currencyUnit, setCurrencyUnit] = useState<'rials' | 'tomans'>('rials');
  const [unitMatchMode, setUnitMatchMode] = useState<ExcelUnitMatchMode>('last_digits_and_charge');
  const [suffixDigitCount, setSuffixDigitCount] = useState<1 | 2 | 3>(2);
  const [customFields, setCustomFields] = useState<ExcelCustomFieldMapping[]>(DEFAULT_CUSTOM_FIELDS);

  // Parsed Excel rows & detected headers
  const [fileName, setFileName] = useState('');
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Array<Record<string, unknown>>>([]);

  const loadServerData = useCallback(async () => {
    try {
      const [patRes, impRes] = await Promise.all([
        rbacApi.listExcelPatterns(),
        rbacApi.listExcelImports(selectedBlockId === 'ALL' ? undefined : selectedBlockId),
      ]);
      setPatterns(patRes.items);
      setBatches(impRes.items);
      if (patRes.items.length > 0 && !activePatternId) {
        const first = patRes.items[0];
        setActivePatternId(first.id);
        setPatternName(first.name);
        setAmountColumn(first.amountColumn);
        setDateColumn(first.dateColumn);
        setTraceColumn(first.traceColumn || '');
        setDescriptionColumn(first.descriptionColumn || '');
        setCurrencyUnit(first.currencyUnit);
        setUnitMatchMode(first.unitMatchMode);
        setSuffixDigitCount(first.suffixDigitCount);
        if (first.customFields?.length) setCustomFields(first.customFields);
      }
    } catch {
      /* ignore */
    }
  }, [selectedBlockId, activePatternId]);

  useEffect(() => {
    void loadServerData();
  }, [loadServerData]);

  const applySavedPattern = (pat: ExcelBankPatternDoc) => {
    setActivePatternId(pat.id);
    setPatternName(pat.name);
    setAmountColumn(pat.amountColumn);
    setDateColumn(pat.dateColumn);
    setTraceColumn(pat.traceColumn || '');
    setDescriptionColumn(pat.descriptionColumn || '');
    setCurrencyUnit(pat.currencyUnit);
    setUnitMatchMode(pat.unitMatchMode);
    setSuffixDigitCount(pat.suffixDigitCount);
    setCustomFields(pat.customFields?.length ? pat.customFields : DEFAULT_CUSTOM_FIELDS);
    setLocalMsg({ tone: 'info', text: `الگوی «${pat.name}» بارگذاری شد.` });
  };

  const handleSavePattern = async () => {
    if (!patternName.trim() || !amountColumn.trim() || !dateColumn.trim()) {
      setLocalMsg({
        tone: 'danger',
        text: 'نام الگو، نام دقیق ستون «واریز» و ستون «تاریخ» الزامی است.',
      });
      return;
    }
    setBusy(true);
    try {
      const res = await rbacApi.createExcelPattern({
        name: patternName.trim(),
        blockId: effectiveBlockId,
        amountColumn: amountColumn.trim(),
        dateColumn: dateColumn.trim(),
        traceColumn: traceColumn.trim() || undefined,
        descriptionColumn: descriptionColumn.trim() || undefined,
        currencyUnit,
        unitMatchMode,
        suffixDigitCount,
        chargeToleranceTomans: 2500,
        customFields,
      });
      setActivePatternId(res.pattern.id);
      await loadServerData();
      setLocalMsg({
        tone: 'success',
        text: `الگوی بانکی «${res.pattern.name}» در دیتابیس سرور ذخیره شد.`,
      });
    } catch (err) {
      setLocalMsg({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ذخیره الگو انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePattern = async (id: string) => {
    setBusy(true);
    try {
      await rbacApi.deleteExcelPattern(id);
      if (activePatternId === id) setActivePatternId('');
      await loadServerData();
      setLocalMsg({ tone: 'info', text: 'الگو حذف شد.' });
    } catch (err) {
      setLocalMsg({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'حذف الگو انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const firstSheet = wb.SheetNames[0];
      if (!firstSheet) throw new Error('فایل اکسل بدون برگه (Sheet) است.');
      const sheet = wb.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (rows.length === 0) throw new Error('هیچ سطر داده‌ای در فایل اکسل یافت نشد.');
      const headers = Object.keys(rows[0]);
      setFileName(file.name);
      setDetectedHeaders(headers);
      setRawRows(rows);
      setLocalMsg({
        tone: 'success',
        text: `فایل «${file.name}» با ${toPersianDigits(rows.length)} ردیف خوانده شد. ستون‌ها به شکل خودکار شناسایی شدند.`,
      });
    } catch (err) {
      setLocalMsg({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'خواندن فایل اکسل ناموفق بود.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleLoadSampleRows = () => {
    setFileName(`gardesh-pasargad-block-${effectiveBlockId}.xlsx`);
    setDetectedHeaders(Object.keys(SAMPLE_BANK_STATEMENT_ROWS[0]));
    setRawRows(SAMPLE_BANK_STATEMENT_ROWS);
    setAmountColumn('واریز');
    setDateColumn('تاریخ واریز');
    setTraceColumn('شماره پیگیری');
    setDescriptionColumn('شرح تراکنش');
    setCurrencyUnit('rials');
    setSuffixDigitCount(2);
    setUnitMatchMode('last_digits_and_charge');
    setLocalMsg({
      tone: 'info',
      text: 'داده نمونه گردش بانکی (شامل 12356008 واحد ۸ و 54430011 واحد ۱۱) بارگذاری و تطبیق داده شد.',
    });
  };

  const handleDownloadSampleXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(SAMPLE_BANK_STATEMENT_ROWS);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'گردش_حساب');
    XLSX.writeFile(wb, `sample-bank-block-${effectiveBlockId}.xlsx`);
    onFeedback('فایل نمونه اکسل گردش حساب بانکی (.xlsx) دانلود شد.');
  };

  const activePatternConfig: ExcelBankPatternConfig = useMemo(
    () => ({
      name: patternName,
      blockId: effectiveBlockId,
      amountColumn,
      dateColumn,
      traceColumn,
      descriptionColumn,
      currencyUnit,
      unitMatchMode,
      suffixDigitCount,
      chargeToleranceTomans: 2500,
      customFields,
    }),
    [
      patternName,
      effectiveBlockId,
      amountColumn,
      dateColumn,
      traceColumn,
      descriptionColumn,
      currencyUnit,
      unitMatchMode,
      suffixDigitCount,
      customFields,
    ],
  );

  const matchSummary = useMemo(
    () => (rawRows.length > 0 ? matchBankStatementRows(rawRows, activePatternConfig, units) : null),
    [rawRows, activePatternConfig, units],
  );

  const handleCommitMatched = async () => {
    if (!matchSummary) return;
    const valid = matchSummary.rows.filter((r) => r.matchedUnitId && r.matchedUnitCode && r.amountTomans > 0);
    if (valid.length === 0) {
      setLocalMsg({ tone: 'danger', text: 'هیچ ردیف تطبیق‌یافته‌ای برای ثبت وجود ندارد.' });
      return;
    }
    setBusy(true);
    try {
      const periodLabel = `${periodStart} تا ${periodEnd}`;
      const res = await rbacApi.commitExcelImport({
        blockId: effectiveBlockId,
        periodLabel,
        patternName: patternName.trim() || 'الگوی بانکی',
        fileName: fileName || 'bank-statement.xlsx',
        bankAccountCode,
        matchedRows: valid.map((r) => ({
          unitId: r.matchedUnitId!,
          unitCode: r.matchedUnitCode!,
          residentName: r.residentName || `ساکن واحد ${r.matchedUnitCode}`,
          amountTomans: r.amountTomans,
          depositDate: r.depositDate,
          traceCode: r.traceCode,
          statusLabel: r.statusLabel,
          customRecord: r.customRecord,
        })),
      });
      await loadServerData();
      await onCommitted();
      setLocalMsg({
        tone: 'success',
        text: `${toPersianDigits(valid.length)} واریزی (مجموع ${formatAmountFa(res.batch.totalMatchedTomans)} تومان) در دیتابیس پرداخت شارژ بلوک ${effectiveBlockId} ثبت و سند روزنامه #${toPersianDigits(res.voucher.voucherNo)} خودکار صادر شد.`,
      });
      onFeedback(
        `گردش بانکی بلوک ${effectiveBlockId} ثبت شد • سند #${toPersianDigits(res.voucher.voucherNo)} صادر گردید.`,
      );
    } catch (err) {
      setLocalMsg({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ثبت پرداخت‌های اکسل ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3.5 m-panel-in" dir="rtl">
      {localMsg && (
        <NoticeBanner
          message={localMsg.text}
          tone={localMsg.tone}
          onClose={() => setLocalMsg(null)}
        />
      )}

      {/* Step 1: Upload Bank Statement Excel + Period Range (Jalali) */}
      <SurfaceCard className="space-y-3">
        <SectionHeader
          title={`ورود فایل اکسل گردش حساب ماهانه — بلوک ${effectiveBlockId}`}
          icon="upload_file"
          action={<StatusPill label={`بلوک ${effectiveBlockId}`} tone="primary" />}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <JalaliDateTimePicker
            label="شروع بازه گردش (شمسی)"
            mode="date"
            value={periodStart}
            onChange={(j) => setPeriodStart(j)}
          />
          <JalaliDateTimePicker
            label="پایان بازه گردش (شمسی)"
            mode="date"
            value={periodEnd}
            onChange={(j) => setPeriodEnd(j)}
          />
          <div>
            <label htmlFor="xls-bank" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
              حساب بانکی مقصد
            </label>
            <select
              id="xls-bank"
              value={bankAccountCode}
              onChange={(e) => setBankAccountCode(e.target.value as '1102' | '1103')}
              className="w-full h-10 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
            >
              <option value="1102">۱۱۰۲ — بانک پاسارگاد (شارژ جاری)</option>
              <option value="1103">۱۱۰۳ — بانک سامان (عمرانی)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-1">
          <label className="h-10 px-3.5 rounded-[var(--ui-btn-radius)] bg-primary text-on-primary text-[12.5px] font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95">
            <span className="material-symbols-outlined text-[18px]">table_view</span>
            <span>انتخاب فایل اکسل بانکی (.xlsx / .csv)</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => void handleFileUpload(e)}
            />
          </label>
          <StitchButton variant="secondary" icon="science" onClick={handleLoadSampleRows}>
            بارگذاری نمونه گردش بانکی
          </StitchButton>
          <StitchButton variant="ghost" icon="download" onClick={handleDownloadSampleXlsx}>
            دانلود نمونه اکسل (.xlsx)
          </StitchButton>
        </div>

        {detectedHeaders.length > 0 && (
          <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-low border border-outline-variant/45 space-y-1.5">
            <span className="text-[11.5px] font-semibold text-on-surface-variant block">
              فایل فعال: <strong className="text-on-surface">{fileName}</strong> • ستون‌های شناسایی‌شده (برای انتخاب ستون واریز کلیک کنید):
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {detectedHeaders.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setAmountColumn(h)}
                  className={`px-2 py-0.5 rounded-[var(--ui-btn-radius)] text-[11px] font-semibold border transition-colors ${
                    amountColumn === h
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface-container-lowest text-on-surface border-outline-variant/50 hover:border-primary'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}
      </SurfaceCard>

      {/* Step 2: Saved Pattern Selector & Custom Bank Excel Pattern Builder */}
      <SurfaceCard className="space-y-3">
        <SectionHeader
          title="الگوی تطبیق خودکار اکسل (Pattern Builder)"
          icon="tune"
          action={
            <StitchButton size="sm" icon="save" disabled={busy} onClick={() => void handleSavePattern()}>
              ذخیره الگو در دیتابیس
            </StitchButton>
          }
        />

        {patterns.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {patterns.map((p) => (
              <div
                key={p.id}
                className={`inline-flex items-center rounded-[var(--ui-btn-radius)] border overflow-hidden ${
                  activePatternId === p.id
                    ? 'bg-primary-container border-primary'
                    : 'bg-surface-container-low border-outline-variant/55'
                }`}
              >
                <button
                  type="button"
                  onClick={() => applySavedPattern(p)}
                  className="px-2.5 py-1 text-[11.5px] font-bold text-on-surface"
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  aria-label={`حذف الگوی ${p.name}`}
                  onClick={() => void handleDeletePattern(p.id)}
                  className="px-1.5 py-1 text-error hover:bg-error-container/50 text-[13px]"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <div>
            <label htmlFor="pat-name" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
              نام الگو
            </label>
            <input
              id="pat-name"
              type="text"
              value={patternName}
              onChange={(e) => setPatternName(e.target.value)}
              className="w-full h-9 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
            />
          </div>
          <div>
            <label htmlFor="pat-amt-col" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
              نام دقیق ستون «واریز» در اکسل
            </label>
            <input
              id="pat-amt-col"
              type="text"
              value={amountColumn}
              onChange={(e) => setAmountColumn(e.target.value)}
              placeholder="مثلاً: واریز"
              className="w-full h-9 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
            />
          </div>
          <div>
            <label htmlFor="pat-date-col" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
              نام دقیق ستون «تاریخ / زمان واریز»
            </label>
            <input
              id="pat-date-col"
              type="text"
              value={dateColumn}
              onChange={(e) => setDateColumn(e.target.value)}
              placeholder="مثلاً: تاریخ واریز"
              className="w-full h-9 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
            />
          </div>
          <div>
            <label htmlFor="pat-trace-col" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
              ستون شماره پیگیری
            </label>
            <input
              id="pat-trace-col"
              type="text"
              value={traceColumn}
              onChange={(e) => setTraceColumn(e.target.value)}
              className="w-full h-9 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
            />
          </div>
          <div>
            <label htmlFor="pat-curr" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
              واحد مبلغ فایل بانک
            </label>
            <select
              id="pat-curr"
              value={currencyUnit}
              onChange={(e) => setCurrencyUnit(e.target.value as 'rials' | 'tomans')}
              className="w-full h-9 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
            >
              <option value="rials">ریال (تبدیل خودکار به تومان ÷ ۱۰)</option>
              <option value="tomans">تومان</option>
            </select>
          </div>
          <div>
            <label htmlFor="pat-suffix" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
              الگوی تشخیص شماره واحد از رقم آخر مبلغ
            </label>
            <div className="flex items-center gap-1.5">
              <select
                id="pat-suffix"
                value={suffixDigitCount}
                onChange={(e) => setSuffixDigitCount(Number(e.target.value) as 1 | 2 | 3)}
                className="flex-1 h-9 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12px] border border-outline-variant/55"
              >
                <option value={1}>۱ رقم آخر (واحد ۱ تا ۹)</option>
                <option value={2}>۲ رقم آخر (مثلاً ۰۰۸ ← واحد ۸، ۰۱۱ ← ۱۱)</option>
                <option value={3}>۳ رقم آخر (مثلاً ۲۰۸ ← واحد ۲۰۸)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Custom Extracted Fields Builder */}
        <div className="pt-2 border-t border-outline-variant/40 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-on-surface">
              فیلدهای رکورد سفارشی واکشی‌شده برای دیتابیس ({toPersianDigits(customFields.length)} فیلد):
            </span>
            <StitchButton
              variant="ghost"
              size="sm"
              icon="add"
              onClick={() =>
                setCustomFields((prev) => [
                  ...prev,
                  {
                    id: `cf_${Date.now()}`,
                    fieldLabel: 'فیلد جدید',
                    sourceType: 'column',
                    columnName: descriptionColumn || 'شرح تراکنش',
                  },
                ])
              }
            >
              افزودن فیلد دلخواه
            </StitchButton>
          </div>

          <div className="space-y-1.5">
            {customFields.map((cf, idx) => (
              <div
                key={cf.id}
                className="grid grid-cols-12 gap-1.5 items-center bg-surface-container-low/70 p-2 rounded-[var(--ui-btn-radius)] border border-outline-variant/40"
              >
                <input
                  type="text"
                  aria-label={`عنوان فیلد ${idx + 1}`}
                  value={cf.fieldLabel}
                  onChange={(e) =>
                    setCustomFields((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, fieldLabel: e.target.value } : x)),
                    )
                  }
                  placeholder="نام فیلد رکورد"
                  className="col-span-4 h-8 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[12px] border border-outline-variant/50"
                />
                <select
                  aria-label={`منبع فیلد ${idx + 1}`}
                  value={cf.sourceType}
                  onChange={(e) =>
                    setCustomFields((prev) =>
                      prev.map((x, i) =>
                        i === idx
                          ? { ...x, sourceType: e.target.value as ExcelCustomFieldMapping['sourceType'] }
                          : x,
                      ),
                    )
                  }
                  className="col-span-4 h-8 px-1.5 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[11.5px] border border-outline-variant/50"
                >
                  <option value="unit_from_last_digits">استخراج از رقم آخر مبلغ</option>
                  <option value="resident_from_unit">تکمیل خودکار از ساکن واحد</option>
                  <option value="column">خواندن از ستون اکسل</option>
                </select>
                {cf.sourceType === 'column' ? (
                  <input
                    type="text"
                    value={cf.columnName || ''}
                    onChange={(e) =>
                      setCustomFields((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, columnName: e.target.value } : x)),
                      )
                    }
                    placeholder="نام ستون اکسل"
                    className="col-span-3 h-8 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[11.5px] border border-outline-variant/50"
                  />
                ) : (
                  <span className="col-span-3 text-[11px] text-primary font-semibold truncate px-1">
                    {cf.sourceType === 'unit_from_last_digits'
                      ? `${toPersianDigits(suffixDigitCount)} رقم آخر`
                      : 'دیتابیس ساکنین'}
                  </span>
                )}
                <button
                  type="button"
                  aria-label="حذف فیلد"
                  onClick={() => setCustomFields((prev) => prev.filter((_, i) => i !== idx))}
                  className="col-span-1 h-8 text-error font-bold hover:bg-error-container/50 rounded-[var(--ui-btn-radius)]"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </SurfaceCard>

      {/* Step 3: Live Reconciliation Preview & Commit to Server NoSQL */}
      {matchSummary ? (
        <SurfaceCard className="space-y-3">
          <SectionHeader
            title="پیش‌نمایش تطبیق واریزی‌ها با شارژ واحدهای بلوک"
            icon="fact_check"
            action={
              <StitchButton
                icon="cloud_upload"
                disabled={busy || matchSummary.matchedCount === 0}
                onClick={() => void handleCommitMatched()}
              >
                {busy
                  ? 'در حال ثبت...'
                  : `ثبت ${toPersianDigits(matchSummary.matchedCount)} پرداخت در دیتابیس و صدور سند`}
              </StitchButton>
            }
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-numeric-stat">
            <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-low border border-outline-variant/45">
              <span className="text-[11px] text-on-surface-variant block">تطبیق‌یافته</span>
              <strong className="text-[16px] text-secondary font-extrabold">
                {toPersianDigits(matchSummary.matchedCount)} ردیف
              </strong>
            </div>
            <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-low border border-outline-variant/45">
              <span className="text-[11px] text-on-surface-variant block">تطابق کامل شارژ</span>
              <strong className="text-[16px] text-primary font-extrabold">
                {toPersianDigits(matchSummary.exactCount)} واحد
              </strong>
            </div>
            <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-low border border-outline-variant/45">
              <span className="text-[11px] text-on-surface-variant block">جمع واریزی (تومان)</span>
              <strong className="text-[15px] text-on-surface font-extrabold">
                {formatAmountFa(matchSummary.totalMatchedTomans)}
              </strong>
            </div>
            <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-low border border-outline-variant/45">
              <span className="text-[11px] text-on-surface-variant block">تطبیق‌نیافته / برداشت</span>
              <strong className="text-[16px] text-error font-extrabold">
                {toPersianDigits(matchSummary.totalRows - matchSummary.matchedCount)}
              </strong>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[var(--ui-card-radius)] border border-outline-variant/50">
            <table className="w-full text-right border-collapse text-[12px]">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant/50">
                  <th className="py-2 px-2 font-semibold">تاریخ واریز</th>
                  <th className="py-2 px-2 font-semibold">مبلغ فایل ({currencyUnit === 'rials' ? 'ریال' : 'تومان'})</th>
                  <th className="py-2 px-2 font-semibold">واحد و ساکن (خودکار)</th>
                  <th className="py-2 px-2 font-semibold">مقایسه با شارژ</th>
                  <th className="py-2 px-2 font-semibold">وضعیت تطبیق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/35 font-numeric-stat">
                {matchSummary.rows.map((r) => (
                  <tr key={r.rowIndex} className="hover:bg-surface-container-low/40">
                    <td className="py-2 px-2 whitespace-nowrap">
                      <span className="text-on-surface font-medium block">{r.depositDate}</span>
                      <span className="text-[10.5px] text-on-surface-variant">{r.traceCode}</span>
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <strong className="text-on-surface block">
                        {r.rawNumericAmount > 0 ? formatAmountFa(r.rawNumericAmount) : '۰'}
                      </strong>
                      {r.amountTomans > 0 && (
                        <span className="text-[10.5px] text-primary">
                          معادل {formatAmountFa(r.amountTomans)} تومان
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {r.matchedUnitCode ? (
                        <>
                          <strong className="text-primary block">واحد {r.matchedUnitCode}</strong>
                          <span className="text-[11px] text-on-surface">{r.residentName}</span>
                        </>
                      ) : (
                        <span className="text-on-surface-variant text-[11.5px]">
                          {r.extractedUnitNum
                            ? `کد ${toPersianDigits(r.extractedUnitNum)} (یافت نشد)`
                            : '—'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      {r.expectedChargeTomans ? (
                        <span className="text-[11.5px] text-on-surface-variant">
                          شارژ: {formatAmountFa(r.expectedChargeTomans)} ت
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <StatusPill
                        label={r.statusLabel}
                        tone={
                          r.status === 'matched_exact'
                            ? 'positive'
                            : r.status === 'matched_partial' || r.status === 'matched_overpaid'
                              ? 'primary'
                              : r.status === 'ignored_zero'
                                ? 'neutral'
                                : 'danger'
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      ) : (
        <EmptyState
          icon="table_chart"
          title="هنوز فایل گردش بانکی بارگذاری نشده است"
          description="فایل اکسل بانک (.xlsx / .csv) را انتخاب کنید یا با دکمه «بارگذاری نمونه گردش بانکی» تطبیق خودکار رقم آخر (مثل 12356008 برای واحد ۸) را آزمایش کنید."
          actionLabel="بارگذاری نمونه گردش بانکی"
          onAction={handleLoadSampleRows}
        />
      )}

      {/* Historical Imported Excel Batches from Server NoSQL */}
      {batches.length > 0 && (
        <SurfaceCard className="space-y-2.5">
          <SectionHeader title="سوابق اکسل‌های بانکی ثبت‌شده در دیتابیس" icon="history" />
          <div className="space-y-2">
            {batches.map((b) => (
              <div
                key={b.id}
                className="p-3 rounded-[var(--ui-card-radius)] bg-surface-container-low/80 border border-outline-variant/45 flex items-center justify-between gap-2 flex-wrap"
              >
                <div className="min-w-0">
                  <strong className="text-[13px] font-bold text-on-surface block">
                    بلوک {b.blockId} • {b.periodLabel} ({b.fileName})
                  </strong>
                  <span className="text-[11.5px] text-on-surface-variant font-numeric-stat">
                    {toPersianDigits(b.matchedCount)} واحد • مجموع {formatAmountFa(b.totalMatchedTomans)} تومان • توسط {b.importedByName}
                  </span>
                </div>
                <StatusPill label={`سند #${toPersianDigits(b.voucherNo)}`} tone="positive" />
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}
    </div>
  );
};
