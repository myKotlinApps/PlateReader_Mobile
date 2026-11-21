import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  matchBankStatementRows,
  SAMPLE_BANK_STATEMENT_ROWS,
  SAMPLE_UNIT_COLUMN_BANK_ROWS,
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

const MAX_EXCEL_FILE_BYTES = 5 * 1024 * 1024; // 5 MB safety cap
const MAX_EXCEL_ROWS = 2000;

const DEFAULT_CUSTOM_FIELDS: ExcelCustomFieldMapping[] = [
  { id: 'cf_unit', fieldLabel: 'شماره واحد', sourceType: 'unit_from_column' },
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
  const [localBlockId, setLocalBlockId] = useState<string>(
    selectedBlockId && selectedBlockId !== 'ALL'
      ? selectedBlockId
      : accessibleBlocks[0]?.id || 'B',
  );

  useEffect(() => {
    if (selectedBlockId && selectedBlockId !== 'ALL') {
      setLocalBlockId(selectedBlockId);
    } else if (accessibleBlocks.length > 0 && !accessibleBlocks.some((b) => b.id === localBlockId)) {
      setLocalBlockId(accessibleBlocks[0].id);
    }
  }, [selectedBlockId, accessibleBlocks, localBlockId]);

  const effectiveBlockId = localBlockId || accessibleBlocks[0]?.id || 'B';

  const [patterns, setPatterns] = useState<ExcelBankPatternDoc[]>([]);
  const [batches, setBatches] = useState<ExcelImportBatchDoc[]>([]);
  const [activePatternId, setActivePatternId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [localMsg, setLocalMsg] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(
    null,
  );

  // Period & Bank Settings (Jalali Dates)
  const [periodStart, setPeriodStart] = useState('۱۴۰۵/۰۸/۰۱');
  const [periodEnd, setPeriodEnd] = useState('۱۴۰۵/۰۸/۳۰');
  const [bankAccountCode, setBankAccountCode] = useState<'1102' | '1103'>('1102');

  // Pattern Config Form
  const [patternName, setPatternName] = useState('الگوی استاندارد — نگاشت ستون شماره واحد و مبلغ');
  const [unitMatchMode, setUnitMatchMode] = useState<ExcelUnitMatchMode>('unit_column');
  const [unitColumn, setUnitColumn] = useState('شماره واحد');
  const [amountColumn, setAmountColumn] = useState('مبلغ واریزی');
  const [dateColumn, setDateColumn] = useState('تاریخ واریز');
  const [traceColumn, setTraceColumn] = useState('شماره پیگیری');
  const [descriptionColumn, setDescriptionColumn] = useState('شرح تراکنش');
  const [currencyUnit, setCurrencyUnit] = useState<'rials' | 'tomans'>('tomans');
  const [suffixDigitCount, setSuffixDigitCount] = useState<1 | 2 | 3>(2);
  const [chargeToleranceTomans, setChargeToleranceTomans] = useState<number>(2500);
  const [customFields, setCustomFields] = useState<ExcelCustomFieldMapping[]>(DEFAULT_CUSTOM_FIELDS);

  // Parsed Excel rows, detected headers, row overrides & selections
  const [fileName, setFileName] = useState('');
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Array<Record<string, unknown>>>([]);
  const [excludedRowIndices, setExcludedRowIndices] = useState<Record<number, boolean>>({});
  const [manualUnitOverrides, setManualUnitOverrides] = useState<Record<number, string>>({});

  const blockUnits = useMemo(
    () => units.filter((u) => !effectiveBlockId || effectiveBlockId === 'ALL' || u.blockId === effectiveBlockId),
    [units, effectiveBlockId],
  );

  const loadServerData = useCallback(async () => {
    try {
      const [patRes, impRes] = await Promise.all([
        rbacApi.listExcelPatterns(),
        rbacApi.listExcelImports(effectiveBlockId === 'ALL' ? undefined : effectiveBlockId),
      ]);
      setPatterns(patRes.items);
      setBatches(impRes.items);
      if (patRes.items.length > 0 && !activePatternId) {
        const first = patRes.items[0];
        setActivePatternId(first.id);
        setPatternName(first.name);
        setUnitColumn(first.unitColumn || '');
        setAmountColumn(first.amountColumn);
        setDateColumn(first.dateColumn);
        setTraceColumn(first.traceColumn || '');
        setDescriptionColumn(first.descriptionColumn || '');
        setCurrencyUnit(first.currencyUnit);
        setUnitMatchMode(first.unitMatchMode);
        setSuffixDigitCount(first.suffixDigitCount);
        setChargeToleranceTomans(first.chargeToleranceTomans ?? 2500);
        if (first.customFields?.length) setCustomFields(first.customFields);
      }
    } catch {
      /* ignore */
    }
  }, [effectiveBlockId, activePatternId]);

  useEffect(() => {
    void loadServerData();
  }, [loadServerData]);

  const applySavedPattern = (pat: ExcelBankPatternDoc) => {
    setActivePatternId(pat.id);
    setPatternName(pat.name);
    setUnitColumn(pat.unitColumn || '');
    setAmountColumn(pat.amountColumn);
    setDateColumn(pat.dateColumn);
    setTraceColumn(pat.traceColumn || '');
    setDescriptionColumn(pat.descriptionColumn || '');
    setCurrencyUnit(pat.currencyUnit);
    setUnitMatchMode(pat.unitMatchMode);
    setSuffixDigitCount(pat.suffixDigitCount);
    setChargeToleranceTomans(pat.chargeToleranceTomans ?? 2500);
    setCustomFields(pat.customFields?.length ? pat.customFields : DEFAULT_CUSTOM_FIELDS);
    setLocalMsg({ tone: 'info', text: `الگوی «${pat.name}» بارگذاری شد.` });
  };

  const resetForNewPattern = () => {
    setActivePatternId('');
    setPatternName('');
    setUnitMatchMode('unit_column');
    setUnitColumn(detectedHeaders[0] || 'شماره واحد');
    setAmountColumn(detectedHeaders[1] || 'مبلغ واریزی');
    setDateColumn(detectedHeaders[2] || 'تاریخ واریز');
    setTraceColumn(detectedHeaders[3] || 'شماره پیگیری');
    setDescriptionColumn(detectedHeaders[4] || 'شرح تراکنش');
    setCurrencyUnit('tomans');
    setChargeToleranceTomans(2500);
    setLocalMsg({ tone: 'info', text: 'فرم آماده تعریف پترن واریزی جدید است.' });
  };

  const handleSavePattern = async () => {
    if (!patternName.trim() || !amountColumn.trim() || !dateColumn.trim()) {
      setLocalMsg({
        tone: 'danger',
        text: 'نام الگو، نام دقیق ستون «مبلغ / واریز» و ستون «تاریخ» الزامی است.',
      });
      return;
    }
    if (unitMatchMode === 'unit_column' && !unitColumn.trim()) {
      setLocalMsg({
        tone: 'danger',
        text: 'در حالت نگاشت مستقیم ستون، وارد کردن نام ستون «شماره واحد» الزامی است.',
      });
      return;
    }
    setBusy(true);
    try {
      const res = await rbacApi.createExcelPattern({
        name: patternName.trim(),
        blockId: effectiveBlockId,
        unitColumn: unitColumn.trim() || undefined,
        amountColumn: amountColumn.trim(),
        dateColumn: dateColumn.trim(),
        traceColumn: traceColumn.trim() || undefined,
        descriptionColumn: descriptionColumn.trim() || undefined,
        currencyUnit,
        unitMatchMode,
        suffixDigitCount,
        chargeToleranceTomans: Math.max(0, Number(chargeToleranceTomans) || 0),
        customFields,
      });
      setActivePatternId(res.pattern.id);
      await loadServerData();
      setLocalMsg({
        tone: 'success',
        text: `پترن واریزی «${res.pattern.name}» در دیتابیس NoSQL ذخیره شد.`,
      });
    } catch (err) {
      setLocalMsg({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ذخیره پترن انجام نشد.',
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
      setLocalMsg({ tone: 'info', text: 'پترن انتخابی از دیتابیس حذف شد.' });
    } catch (err) {
      setLocalMsg({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'حذف پترن انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_EXCEL_FILE_BYTES) {
        throw new Error('حجم فایل اکسل نباید بیشتر از ۵ مگابایت باشد.');
      }
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const firstSheet = wb.SheetNames[0];
      if (!firstSheet) throw new Error('فایل اکسل بدون برگه (Sheet) است.');
      const sheet = wb.Sheets[firstSheet];
      const allRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (allRows.length === 0) throw new Error('هیچ سطر داده‌ای در فایل اکسل یافت نشد.');
      const rows = allRows.slice(0, MAX_EXCEL_ROWS);
      const headers = Object.keys(rows[0]);

      // Smart header auto-detection for common Persian/English bank column names
      const findHeader = (keywords: string[]) =>
        headers.find((h) => keywords.some((kw) => h.toLowerCase().includes(kw)));
      const autoUnit = findHeader(['واحد', 'unit', 'کد واحد']);
      const autoAmt = findHeader(['مبلغ', 'واریز', 'بستانکار', 'amount', 'credit']);
      const autoDate = findHeader(['تاریخ', 'زمان', 'date']);
      const autoTrace = findHeader(['پیگیری', 'ارجاع', 'شماره سند', 'trace', 'ref']);
      const autoDesc = findHeader(['شرح', 'توضیح', 'بابت', 'desc']);

      if (autoUnit) {
        setUnitColumn(autoUnit);
        setUnitMatchMode('unit_column');
      }
      if (autoAmt) setAmountColumn(autoAmt);
      if (autoDate) setDateColumn(autoDate);
      if (autoTrace) setTraceColumn(autoTrace);
      if (autoDesc) setDescriptionColumn(autoDesc);

      setFileName(file.name);
      setDetectedHeaders(headers);
      setRawRows(rows);
      setExcludedRowIndices({});
      setManualUnitOverrides({});
      setLocalMsg({
        tone: 'success',
        text: `فایل «${file.name}» با ${toPersianDigits(rows.length)} ردیف خوانده شد و ستون‌های بانک شناسایی شدند.`,
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

  const handleLoadUnitColumnSample = () => {
    setFileName(`bank-deposits-units-block-${effectiveBlockId}.xlsx`);
    setDetectedHeaders(Object.keys(SAMPLE_UNIT_COLUMN_BANK_ROWS[0]));
    setRawRows(SAMPLE_UNIT_COLUMN_BANK_ROWS);
    setExcludedRowIndices({});
    setManualUnitOverrides({});
    setUnitMatchMode('unit_column');
    setUnitColumn('شماره واحد');
    setAmountColumn('مبلغ واریزی');
    setDateColumn('تاریخ واریز');
    setTraceColumn('شماره پیگیری');
    setDescriptionColumn('شرح تراکنش');
    setCurrencyUnit('tomans');
    setChargeToleranceTomans(2500);
    setLocalMsg({
      tone: 'info',
      text: 'فایل نمونه بانک (دارای ستون‌های شماره واحد و مبلغ واریزی) بارگذاری و با شارژ واحدها تطبیق داده شد.',
    });
  };

  const handleLoadSuffixSampleRows = () => {
    setFileName(`gardesh-pasargad-block-${effectiveBlockId}.xlsx`);
    setDetectedHeaders(Object.keys(SAMPLE_BANK_STATEMENT_ROWS[0]));
    setRawRows(SAMPLE_BANK_STATEMENT_ROWS);
    setExcludedRowIndices({});
    setManualUnitOverrides({});
    setUnitColumn('');
    setAmountColumn('واریز');
    setDateColumn('تاریخ واریز');
    setTraceColumn('شماره پیگیری');
    setDescriptionColumn('شرح تراکنش');
    setCurrencyUnit('rials');
    setSuffixDigitCount(2);
    setUnitMatchMode('last_digits_and_charge');
    setLocalMsg({
      tone: 'info',
      text: 'نمونه گردش بانکی با کدگذاری ۲ رقم آخر (مانند 14500008 برای واحد ۸) بارگذاری شد.',
    });
  };

  const handleDownloadSampleXlsx = () => {
    const sampleRows =
      unitMatchMode === 'unit_column' ? SAMPLE_UNIT_COLUMN_BANK_ROWS : SAMPLE_BANK_STATEMENT_ROWS;
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'گردش_حساب');
    XLSX.writeFile(wb, `sample-bank-block-${effectiveBlockId}.xlsx`);
    onFeedback('فایل نمونه اکسل بانکی (.xlsx) دانلود شد.');
  };

  const activePatternConfig: ExcelBankPatternConfig = useMemo(
    () => ({
      name: patternName,
      blockId: effectiveBlockId,
      unitColumn,
      amountColumn,
      dateColumn,
      traceColumn,
      descriptionColumn,
      currencyUnit,
      unitMatchMode,
      suffixDigitCount,
      chargeToleranceTomans: Math.max(0, Number(chargeToleranceTomans) || 0),
      customFields,
    }),
    [
      patternName,
      effectiveBlockId,
      unitColumn,
      amountColumn,
      dateColumn,
      traceColumn,
      descriptionColumn,
      currencyUnit,
      unitMatchMode,
      suffixDigitCount,
      chargeToleranceTomans,
      customFields,
    ],
  );

  const rawMatchSummary = useMemo(
    () => (rawRows.length > 0 ? matchBankStatementRows(rawRows, activePatternConfig, units) : null),
    [rawRows, activePatternConfig, units],
  );

  // Merge any manual unit overrides made by the manager in the preview table
  const resolvedRows = useMemo(() => {
    if (!rawMatchSummary) return [];
    const unitMap = new Map(units.map((u) => [u.id, u]));
    return rawMatchSummary.rows.map((r) => {
      const overrideId = manualUnitOverrides[r.rowIndex];
      if (!overrideId) return r;
      const u = unitMap.get(overrideId);
      if (!u) return r;
      const expected =
        u.expectedChargeTomans && u.expectedChargeTomans > 0
          ? u.expectedChargeTomans
          : u.debtTomans > 0
            ? u.debtTomans
            : r.amountTomans;
      const diff = r.amountTomans - expected;
      const tol = Math.max(0, Number(chargeToleranceTomans) || 0);
      const status =
        Math.abs(diff) <= tol
          ? ('matched_exact' as const)
          : diff < 0
            ? ('matched_partial' as const)
            : ('matched_overpaid' as const);
      const statusLabel =
        status === 'matched_exact'
          ? 'تطابق کامل شارژ (دستی) ✓'
          : status === 'matched_partial'
            ? 'واریز کمتر از شارژ (دستی)'
            : 'واریز بیشتر / معوقه (دستی)';
      return {
        ...r,
        matchedUnitId: u.id,
        matchedUnitCode: u.unitCode,
        matchedBlockId: u.blockId,
        residentName: u.residentName,
        expectedChargeTomans: expected,
        diffTomans: diff,
        status,
        statusLabel,
      };
    });
  }, [rawMatchSummary, manualUnitOverrides, units, chargeToleranceTomans]);

  const selectedCommitRows = useMemo(
    () =>
      resolvedRows.filter(
        (r) => !excludedRowIndices[r.rowIndex] && r.matchedUnitId && r.matchedUnitCode && r.amountTomans > 0,
      ),
    [resolvedRows, excludedRowIndices],
  );

  const effectiveExactCount = useMemo(
    () => resolvedRows.filter((r) => r.status === 'matched_exact').length,
    [resolvedRows],
  );

  const selectedTotalTomans = useMemo(
    () => selectedCommitRows.reduce((s, r) => s + r.amountTomans, 0),
    [selectedCommitRows],
  );

  const handleCommitMatched = async () => {
    if (selectedCommitRows.length === 0) {
      setLocalMsg({ tone: 'danger', text: 'هیچ ردیف تطبیق‌یافته و انتخاب‌شده‌ای برای ثبت وجود ندارد.' });
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
        matchedRows: selectedCommitRows.map((r) => ({
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
      onFeedback(
        `${toPersianDigits(selectedCommitRows.length)} واریزی (مجموع ${formatAmountFa(res.batch.totalMatchedTomans)} تومان) در دیتابیس بلوک ${effectiveBlockId} ثبت و سند #${toPersianDigits(res.voucher.voucherNo)} صادر شد.`,
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
    <div className="space-y-3.5 m-panel-in min-w-0 max-w-full" dir="rtl">
      {localMsg && (
        <NoticeBanner
          message={localMsg.text}
          tone={localMsg.tone}
          onClose={() => setLocalMsg(null)}
        />
      )}

      {/* Step 1: Upload Bank Statement Excel + Period & Block Settings */}
      <SurfaceCard className="space-y-3">
        <SectionHeader
          title={`مدیریت فایل اکسل بانکی و تطبیق شارژ — بلوک ${effectiveBlockId}`}
          icon="upload_file"
          action={<StatusPill label={`بلوک ${effectiveBlockId}`} tone="primary" />}
        />

        {accessibleBlocks.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-[11.5px] font-semibold text-on-surface-variant ml-1">
              بلوک هدف:
            </span>
            {accessibleBlocks.map((blk) => (
              <button
                key={blk.id}
                type="button"
                onClick={() => setLocalBlockId(blk.id)}
                className={`h-8 px-3 rounded-[var(--ui-btn-radius)] text-[12px] font-semibold border transition-colors ${
                  effectiveBlockId === blk.id
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low text-on-surface border-outline-variant/55 hover:border-primary/60'
                }`}
              >
                {blk.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 min-w-0">
          <div className="min-w-0">
            <JalaliDateTimePicker
              label="شروع بازه گردش (شمسی)"
              mode="date"
              value={periodStart}
              onChange={(j) => setPeriodStart(j)}
            />
          </div>
          <div className="min-w-0">
            <JalaliDateTimePicker
              label="پایان بازه گردش (شمسی)"
              mode="date"
              value={periodEnd}
              onChange={(j) => setPeriodEnd(j)}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="xls-bank" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
              حساب بانکی مقصد
            </label>
            <select
              id="xls-bank"
              value={bankAccountCode}
              onChange={(e) => setBankAccountCode(e.target.value as '1102' | '1103')}
              className="w-full min-w-0 h-10 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
            >
              <option value="1102">۱۱۰۲ — بانک پاسارگاد (شارژ جاری)</option>
              <option value="1103">۱۱۰۳ — بانک سامان (عمرانی)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-1 min-w-0">
          <label className="min-h-10 py-1.5 px-3.5 rounded-[var(--ui-btn-radius)] bg-primary text-on-primary text-[12.5px] font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95 max-w-full min-w-0">
            <span className="material-symbols-outlined text-[18px] shrink-0">table_view</span>
            <span className="truncate">انتخاب فایل اکسل بانکی (.xlsx / .csv)</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => void handleFileUpload(e)}
            />
          </label>
          <StitchButton variant="secondary" icon="fact_check" onClick={handleLoadUnitColumnSample}>
            نمونه (شماره واحد + مبلغ)
          </StitchButton>
          <StitchButton variant="secondary" icon="science" onClick={handleLoadSuffixSampleRows}>
            نمونه (۲ رقم آخر مبلغ)
          </StitchButton>
          <StitchButton variant="ghost" icon="download" onClick={handleDownloadSampleXlsx}>
            دانلود نمونه (.xlsx)
          </StitchButton>
        </div>

        {detectedHeaders.length > 0 && (
          <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-low border border-outline-variant/45 space-y-1.5 min-w-0">
            <span className="text-[11.5px] font-semibold text-on-surface-variant block break-words">
              فایل فعال: <strong className="text-on-surface">{fileName}</strong> • ستون‌های شناسایی‌شده در فایل:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {detectedHeaders.map((h) => {
                const isUnit = unitColumn === h;
                const isAmt = amountColumn === h;
                const isDate = dateColumn === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setAmountColumn(h)}
                    title="کلیک برای تنظیم به‌عنوان ستون مبلغ واریزی"
                    className={`px-2 py-0.5 rounded-[var(--ui-btn-radius)] text-[11px] font-semibold border transition-colors max-w-full truncate ${
                      isUnit
                        ? 'bg-secondary-container text-on-secondary-container border-secondary/60'
                        : isAmt
                          ? 'bg-primary text-on-primary border-primary'
                          : isDate
                            ? 'bg-primary-container text-on-primary-container border-primary/40'
                            : 'bg-surface-container-lowest text-on-surface border-outline-variant/50 hover:border-primary'
                    }`}
                  >
                    {h}
                    {isUnit ? ' (واحد)' : isAmt ? ' (مبلغ)' : isDate ? ' (تاریخ)' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </SurfaceCard>

      {/* Step 2: Deposit Pattern Builder & Bank Column Mapping */}
      <SurfaceCard className="space-y-3">
        <SectionHeader
          title="تعریف پترن‌های واریزی و نگاشت ستون‌های بانک"
          icon="tune"
          action={
            <div className="flex items-center gap-1.5 flex-wrap">
              <StitchButton variant="ghost" size="sm" icon="add" disabled={busy} onClick={resetForNewPattern}>
                الگوی جدید
              </StitchButton>
              <StitchButton size="sm" icon="save" disabled={busy} onClick={() => void handleSavePattern()}>
                ذخیره پترن در NoSQL
              </StitchButton>
            </div>
          }
        />

        {patterns.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {patterns.map((p) => (
              <div
                key={p.id}
                className={`inline-flex items-center rounded-[var(--ui-btn-radius)] border overflow-hidden max-w-full min-w-0 ${
                  activePatternId === p.id
                    ? 'bg-primary-container border-primary'
                    : 'bg-surface-container-low border-outline-variant/55'
                }`}
              >
                <button
                  type="button"
                  onClick={() => applySavedPattern(p)}
                  className="px-2.5 py-1 text-[11.5px] font-bold text-on-surface truncate min-w-0"
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  aria-label={`حذف الگوی ${p.name}`}
                  onClick={() => void handleDeletePattern(p.id)}
                  className="px-2 py-1 text-error hover:bg-error-container/50 text-[13px] shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <datalist id="excel-detected-headers-list">
          {detectedHeaders.map((h) => (
            <option key={h} value={h} />
          ))}
        </datalist>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 min-w-0">
          <div className="min-w-0">
            <label htmlFor="pat-name" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
              نام پترن واریزی
            </label>
            <input
              id="pat-name"
              type="text"
              value={patternName}
              onChange={(e) => setPatternName(e.target.value)}
              placeholder="مثلاً: پترن بانک ملت بلوک B"
              className="w-full min-w-0 h-9 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="pat-mode" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
              روش تطبیق واحد و شارژ
            </label>
            <select
              id="pat-mode"
              value={unitMatchMode}
              onChange={(e) => setUnitMatchMode(e.target.value as ExcelUnitMatchMode)}
              className="w-full min-w-0 h-9 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12px] border border-outline-variant/55"
            >
              <option value="unit_column">نگاشت مستقیم ستون شماره واحد + مقایسه شارژ</option>
              <option value="last_digits_and_charge">استخراج واحد از رقم آخر مبلغ + تطبیق شارژ</option>
              <option value="exact_charge">تطبیق خودکار بر اساس مبلغ دقیق شارژ واحد</option>
            </select>
          </div>

          <div className="min-w-0">
            <label htmlFor="pat-unit-col" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
              نگاشت ستون «شماره واحد» {unitMatchMode === 'unit_column' ? '(الزامی)' : '(اختیاری)'}
            </label>
            <input
              id="pat-unit-col"
              type="text"
              list="excel-detected-headers-list"
              value={unitColumn}
              onChange={(e) => setUnitColumn(e.target.value)}
              placeholder="مثلاً: شماره واحد"
              className="w-full min-w-0 h-9 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="pat-amt-col" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
              نگاشت ستون «مبلغ / واریز»
            </label>
            <input
              id="pat-amt-col"
              type="text"
              list="excel-detected-headers-list"
              value={amountColumn}
              onChange={(e) => setAmountColumn(e.target.value)}
              placeholder="مثلاً: مبلغ واریزی یا واریز"
              className="w-full min-w-0 h-9 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="pat-date-col" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
              نگاشت ستون «تاریخ واریز»
            </label>
            <input
              id="pat-date-col"
              type="text"
              list="excel-detected-headers-list"
              value={dateColumn}
              onChange={(e) => setDateColumn(e.target.value)}
              placeholder="مثلاً: تاریخ واریز"
              className="w-full min-w-0 h-9 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="pat-trace-col" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
              نگاشت ستون «شماره پیگیری»
            </label>
            <input
              id="pat-trace-col"
              type="text"
              list="excel-detected-headers-list"
              value={traceColumn}
              onChange={(e) => setTraceColumn(e.target.value)}
              placeholder="مثلاً: شماره پیگیری"
              className="w-full min-w-0 h-9 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="pat-desc-col" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
              نگاشت ستون «شرح تراکنش»
            </label>
            <input
              id="pat-desc-col"
              type="text"
              list="excel-detected-headers-list"
              value={descriptionColumn}
              onChange={(e) => setDescriptionColumn(e.target.value)}
              placeholder="مثلاً: شرح تراکنش"
              className="w-full min-w-0 h-9 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="pat-curr" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
              واحد مبلغ فایل بانک
            </label>
            <select
              id="pat-curr"
              value={currencyUnit}
              onChange={(e) => setCurrencyUnit(e.target.value as 'rials' | 'tomans')}
              className="w-full min-w-0 h-9 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12px] border border-outline-variant/55"
            >
              <option value="tomans">تومان</option>
              <option value="rials">ریال (تبدیل خودکار ÷ ۱۰)</option>
            </select>
          </div>

          {unitMatchMode === 'last_digits' || unitMatchMode === 'last_digits_and_charge' ? (
            <div className="min-w-0">
              <label htmlFor="pat-suffix" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                تعداد رقم آخر مبلغ برای شماره واحد
              </label>
              <select
                id="pat-suffix"
                value={suffixDigitCount}
                onChange={(e) => setSuffixDigitCount(Number(e.target.value) as 1 | 2 | 3)}
                className="w-full min-w-0 h-9 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12px] border border-outline-variant/55"
              >
                <option value={1}>۱ رقم آخر (واحد ۱ تا ۹)</option>
                <option value={2}>۲ رقم آخر (۰۰۸ ← واحد ۸)</option>
                <option value={3}>۳ رقم آخر (۲۰۸ ← واحد ۲۰۸)</option>
              </select>
            </div>
          ) : (
            <div className="min-w-0">
              <label htmlFor="pat-tol" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                تلورانس مجاز تطبیق شارژ (تومان)
              </label>
              <input
                id="pat-tol"
                type="number"
                min={0}
                step={500}
                dir="ltr"
                value={chargeToleranceTomans}
                onChange={(e) => setChargeToleranceTomans(Math.max(0, Number(e.target.value) || 0))}
                className="w-full min-w-0 h-9 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55 font-numeric-stat"
              />
            </div>
          )}
        </div>

        {/* Custom Extracted Fields Builder */}
        <div className="pt-2 border-t border-outline-variant/40 space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[12px] font-bold text-on-surface">
              فیلدهای رکورد سفارشی ذخیره‌شده در دیتابیس ({toPersianDigits(customFields.length)} فیلد):
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

          <div className="space-y-2 min-w-0">
            {customFields.map((cf, idx) => (
              <div
                key={cf.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-surface-container-low/70 p-2 rounded-[var(--ui-btn-radius)] border border-outline-variant/40 min-w-0"
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
                  className="sm:col-span-4 w-full min-w-0 h-8 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[12px] border border-outline-variant/50"
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
                  className="sm:col-span-4 w-full min-w-0 h-8 px-1.5 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[11.5px] border border-outline-variant/50"
                >
                  <option value="unit_from_column">از ستون شماره واحد</option>
                  <option value="unit_from_last_digits">از رقم آخر مبلغ</option>
                  <option value="resident_from_unit">تکمیل خودکار از ساکن واحد</option>
                  <option value="column">خواندن از ستون اکسل</option>
                </select>
                <div className="sm:col-span-3 min-w-0">
                  {cf.sourceType === 'column' ? (
                    <input
                      type="text"
                      list="excel-detected-headers-list"
                      value={cf.columnName || ''}
                      onChange={(e) =>
                        setCustomFields((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, columnName: e.target.value } : x)),
                        )
                      }
                      placeholder="نام ستون اکسل"
                      className="w-full min-w-0 h-8 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[11.5px] border border-outline-variant/50"
                    />
                  ) : (
                    <span className="block text-[11px] text-primary font-semibold truncate px-1">
                      {cf.sourceType === 'unit_from_column'
                        ? unitColumn || 'ستون شماره واحد'
                        : cf.sourceType === 'unit_from_last_digits'
                          ? `${toPersianDigits(suffixDigitCount)} رقم آخر`
                          : 'دیتابیس ساکنین'}
                    </span>
                  )}
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    aria-label="حذف فیلد"
                    onClick={() => setCustomFields((prev) => prev.filter((_, i) => i !== idx))}
                    className="w-8 h-8 text-error font-bold hover:bg-error-container/50 rounded-[var(--ui-btn-radius)] shrink-0"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SurfaceCard>

      {/* Step 3: Live Reconciliation Preview & Auto-Commit to NoSQL */}
      {rawMatchSummary ? (
        <SurfaceCard className="space-y-3">
          <SectionHeader
            title="پیش‌نمایش تطبیق مبالغ با شارژ واحدها و به‌روزرسانی دیتابیس"
            icon="fact_check"
            action={
              <StitchButton
                icon="cloud_upload"
                disabled={busy || selectedCommitRows.length === 0}
                onClick={() => void handleCommitMatched()}
              >
                {busy
                  ? 'در حال ثبت...'
                  : `ثبت ${toPersianDigits(selectedCommitRows.length)} پرداخت و صدور سند`}
              </StitchButton>
            }
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-numeric-stat min-w-0">
            <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-low border border-outline-variant/45 min-w-0">
              <span className="text-[11px] text-on-surface-variant block truncate">آماده ثبت</span>
              <strong className="text-[15.5px] text-secondary font-extrabold block truncate">
                {toPersianDigits(selectedCommitRows.length)} ردیف
              </strong>
            </div>
            <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-low border border-outline-variant/45 min-w-0">
              <span className="text-[11px] text-on-surface-variant block truncate">تطابق کامل شارژ</span>
              <strong className="text-[15.5px] text-primary font-extrabold block truncate">
                {toPersianDigits(effectiveExactCount)} واحد
              </strong>
            </div>
            <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-low border border-outline-variant/45 min-w-0">
              <span className="text-[11px] text-on-surface-variant block truncate">جمع واریزی (تومان)</span>
              <strong className="text-[14.5px] text-on-surface font-extrabold block truncate">
                {formatAmountFa(selectedTotalTomans)}
              </strong>
            </div>
            <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-low border border-outline-variant/45 min-w-0">
              <span className="text-[11px] text-on-surface-variant block truncate">تطبیق‌نیافته / صفر</span>
              <strong className="text-[15.5px] text-error font-extrabold block truncate">
                {toPersianDigits(resolvedRows.length - selectedCommitRows.length)}
              </strong>
            </div>
          </div>

          <div className="w-full overflow-x-auto rounded-[var(--ui-card-radius)] border border-outline-variant/50">
            <table className="w-full min-w-[600px] text-right border-collapse text-[12px]">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant/50">
                  <th className="py-2 px-2 font-semibold w-9 text-center">ثبت</th>
                  <th className="py-2 px-2 font-semibold">تاریخ و پیگیری</th>
                  <th className="py-2 px-2 font-semibold">مبلغ ({currencyUnit === 'rials' ? 'ریال' : 'تومان'})</th>
                  <th className="py-2 px-2 font-semibold">واحد و ساکن</th>
                  <th className="py-2 px-2 font-semibold">شارژ واحد</th>
                  <th className="py-2 px-2 font-semibold">وضعیت تطبیق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/35 font-numeric-stat">
                {resolvedRows.map((r) => {
                  const canSelect = Boolean(r.matchedUnitId && r.amountTomans > 0);
                  const isChecked = canSelect && !excludedRowIndices[r.rowIndex];
                  return (
                    <tr key={r.rowIndex} className="hover:bg-surface-container-low/40">
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`انتخاب ردیف ${r.rowIndex}`}
                          disabled={!canSelect}
                          checked={isChecked}
                          onChange={(e) =>
                            setExcludedRowIndices((prev) => ({
                              ...prev,
                              [r.rowIndex]: !e.target.checked,
                            }))
                          }
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span className="text-on-surface font-medium block">{r.depositDate}</span>
                        <span className="text-[10.5px] text-on-surface-variant">{r.traceCode}</span>
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <strong className="text-on-surface block">
                          {r.rawNumericAmount > 0 ? formatAmountFa(r.rawNumericAmount) : '۰'}
                        </strong>
                        {r.amountTomans > 0 && currencyUnit === 'rials' && (
                          <span className="text-[10.5px] text-primary">
                            معادل {formatAmountFa(r.amountTomans)} تومان
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {r.matchedUnitCode ? (
                          <div>
                            <strong className="text-primary block">واحد {r.matchedUnitCode}</strong>
                            <span className="text-[11px] text-on-surface">{r.residentName}</span>
                          </div>
                        ) : r.amountTomans > 0 ? (
                          <select
                            aria-label={`انتخاب دستی واحد برای ردیف ${r.rowIndex}`}
                            value={manualUnitOverrides[r.rowIndex] || ''}
                            onChange={(e) =>
                              setManualUnitOverrides((prev) => ({
                                ...prev,
                                [r.rowIndex]: e.target.value,
                              }))
                            }
                            className="h-8 px-1.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low border border-outline-variant/55 text-[11px] max-w-[140px]"
                          >
                            <option value="">
                              {r.rawUnitRef ? `تخصیص دستی (${r.rawUnitRef})` : 'انتخاب واحد...'}
                            </option>
                            {blockUnits.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.unitCode} — {u.residentName}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-on-surface-variant text-[11.5px]">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        {r.expectedChargeTomans ? (
                          <span className="text-[11.5px] text-on-surface-variant">
                            {formatAmountFa(r.expectedChargeTomans)} ت
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      ) : (
        <EmptyState
          icon="table_chart"
          title="هنوز فایل اکسل بانکی بارگذاری نشده است"
          description="فایل اکسل بانک (.xlsx / .csv) را انتخاب کنید یا با دکمه «نمونه (شماره واحد + مبلغ)» تطبیق خودکار ستون شماره واحد و مبلغ با شارژ واحدها را آزمایش کنید."
          actionLabel="بارگذاری نمونه (شماره واحد + مبلغ)"
          onAction={handleLoadUnitColumnSample}
        />
      )}

      {/* Historical Imported Excel Batches from Server NoSQL */}
      {batches.length > 0 && (
        <SurfaceCard className="space-y-2.5">
          <SectionHeader title="سوابق اکسل‌های بانکی ثبت‌شده در دیتابیس NoSQL" icon="history" />
          <div className="space-y-2 min-w-0">
            {batches.map((b) => (
              <div
                key={b.id}
                className="p-3 rounded-[var(--ui-card-radius)] bg-surface-container-low/80 border border-outline-variant/45 flex items-center justify-between gap-2 flex-wrap min-w-0"
              >
                <div className="min-w-0 flex-1">
                  <strong className="text-[13px] font-bold text-on-surface block break-words">
                    بلوک {b.blockId} • {b.periodLabel} ({b.fileName})
                  </strong>
                  <span className="text-[11.5px] text-on-surface-variant font-numeric-stat block break-words">
                    {toPersianDigits(b.matchedCount)} واحد • مجموع {formatAmountFa(b.totalMatchedTomans)} تومان • پترن: {b.patternName} • توسط {b.importedByName}
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

/**
 * Self-loading wrapper so the Excel File Management Module can also be mounted directly
 * inside MobileFinancePage or BlockManagementPage without parent accounting state boilerplate.
 */
export const StandaloneExcelManagerTab: React.FC<{
  initialBlockId?: string;
  onSyncChanged?: () => void;
  onFeedback: (msg: string) => void;
}> = ({ initialBlockId = 'B', onSyncChanged, onFeedback }) => {
  const [blocks, setBlocks] = useState<BlockDoc[]>([]);
  const [units, setUnits] = useState<UnitDoc[]>([]);

  const reload = useCallback(async () => {
    try {
      const res = await rbacApi.getAccounting();
      setBlocks(res.accessibleBlocks || []);
      setUnits(res.units || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <FinanceBankExcelTab
      selectedBlockId={initialBlockId}
      accessibleBlocks={blocks}
      units={units}
      onCommitted={async () => {
        await reload();
        onSyncChanged?.();
      }}
      onFeedback={onFeedback}
    />
  );
};
