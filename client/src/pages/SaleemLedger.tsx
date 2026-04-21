import { useState, useEffect, useMemo, useCallback, CSSProperties } from 'react';
import {
  getAdvances, getExpenses, postAdvance, postCommit,
  getAttendance, postAttendance, postBulkClear, postAttendanceSettings,
  type AttendanceRecord,
} from '../api/client';
import type { Advance, Expense } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';

function formatRs(n: number): string {
  return 'Rs ' + n.toLocaleString('en-PK');
}

function toISO(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  if (parts[0].length === 4) return dateStr;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const iso = toISO(dateStr);
  const parts = iso.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMonthDays(year: number, month: number): { date: string; day: number }[] {
  const days: { date: string; day: number }[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const iso = d.toISOString().slice(0, 10);
    days.push({ date: iso, day: d.getDay() });
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export default function SaleemLedger() {
  const { showToast } = useToast();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [dailyRate, setDailyRate] = useState('2700');
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState('2700');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  // Advance form
  const [formDate, setFormDate] = useState(todayStr());
  const [formAmount, setFormAmount] = useState('');
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modes: null = view only, 'attendance' = mark present/absent, 'clear' = mark cleared/uncleared
  const [mode, setMode] = useState<'attendance' | 'clear' | null>(null);

  // Settle
  const [settling, setSettling] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([getAdvances(), getExpenses(), getAttendance()])
      .then(([a, e, att]) => {
        setAdvances(a);
        setExpenses(e);
        setAttendance(att.records);
        setDailyRate(att.daily_rate || '2700');
        setRateInput(att.daily_rate || '2700');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalGiven = useMemo(() => advances.reduce((s, a) => s + a.amount, 0), [advances]);
  const totalSpent = useMemo(() => expenses.reduce((s, e) => s + e.total, 0), [expenses]);
  const balance = totalGiven - totalSpent;

  // Attendance map: date -> status
  const attMap = useMemo(() => {
    const m = new Map<string, 'present' | 'cleared'>();
    for (const r of attendance) m.set(r.date, r.status);
    return m;
  }, [attendance]);

  // Unsettled present days
  const unsettledDates = useMemo(() => {
    return attendance
      .filter((r) => r.status === 'present')
      .map((r) => r.date)
      .sort();
  }, [attendance]);

  const unsettledTotal = unsettledDates.length * parseFloat(dailyRate || '0');

  const monthDays = useMemo(() => getMonthDays(calYear, calMonth), [calYear, calMonth]);
  const monthLabel = new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handleDayClick = async (date: string) => {
    if (!mode) return; // no mode active — do nothing
    const isFuture = date > todayStr();
    if (isFuture) return;

    const current = attMap.get(date);
    let next: 'present' | 'cleared' | null;

    if (mode === 'attendance') {
      // Toggle: absent → present → absent. Don't touch cleared dates.
      if (current === 'cleared') return;
      next = current === 'present' ? null : 'present';
    } else {
      // Clear mode: toggle present → cleared, or cleared → present. Don't touch absent.
      if (!current) return;
      next = current === 'cleared' ? 'present' : 'cleared';
    }

    // Optimistic update
    setAttendance((prev) => {
      if (next === null) return prev.filter((r) => r.date !== date);
      const existing = prev.find((r) => r.date === date);
      if (existing) return prev.map((r) => r.date === date ? { ...r, status: next! } : r);
      return [...prev, { id: '', date, status: next! }];
    });
    try {
      await postAttendance(date, next);
    } catch (err: any) {
      showToast(err.message, 'error');
      fetchData();
    }
  };

  const handleSettle = async () => {
    if (unsettledDates.length === 0) return;
    setSettling(true);
    try {
      const rate = parseFloat(dailyRate);
      const total = unsettledDates.length * rate;
      const fromDate = formatDate(unsettledDates[0]);
      const toDate = formatDate(unsettledDates[unsettledDates.length - 1]);

      // Create expense entry
      await postCommit([{
        date: todayStr(),
        category: 'سلیم صاحب (Saleem Sahab)',
        description: `Salary ${fromDate} - ${toDate} (${unsettledDates.length} days)`,
        quantity: unsettledDates.length,
        unit: 'days',
        rate,
        total,
        image_urls: '',
      }]);

      // Mark dates as cleared
      await postBulkClear(unsettledDates);

      showToast(`Settlement of ${formatRs(total)} added as expense`);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSettling(false);
    }
  };

  const handleSaveRate = async () => {
    try {
      await postAttendanceSettings(rateInput);
      setDailyRate(rateInput);
      setEditingRate(false);
      showToast('Daily rate updated');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); }
    else setCalMonth(calMonth + 1);
  };

  const sortedAdvances = useMemo(() => {
    return [...advances].sort((a, b) => toISO(b.date).localeCompare(toISO(a.date)));
  }, [advances]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formAmount);
    if (!amount || amount <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await postAdvance({ date: formDate, amount, note: formNote });
      showToast('Advance added successfully');
      setFormAmount('');
      setFormNote('');
      setFormDate(todayStr());
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="card" style={{ color: 'var(--danger)' }}>Error: {error}</div>;

  return (
    <div>
      <h1 className="page-title">Saleem Sahab Ledger</h1>

      {/* Summary */}
      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">Total Given</div>
          <div className="card-value">{formatRs(totalGiven)}</div>
        </div>
        <div className="card">
          <div className="card-header">Total Spent</div>
          <div className="card-value">{formatRs(totalSpent)}</div>
        </div>
        <div className="card">
          <div className="card-header">Net Balance</div>
          <div className="card-value" style={{ color: balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatRs(balance)}
          </div>
        </div>
      </div>

      {/* Attendance Calendar */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={sectionTitle}>Attendance</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Rate:</span>
            {editingRate ? (
              <>
                <input
                  type="number"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  style={{ width: 80, padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                />
                <button className="btn btn-primary btn-sm" onClick={handleSaveRate}>Save</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setEditingRate(false); setRateInput(dailyRate); }}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{formatRs(parseFloat(dailyRate))}/day</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditingRate(true)} style={{ padding: '0.15rem 0.4rem', fontSize: '0.6875rem' }}>Edit</button>
              </>
            )}
          </div>
        </div>

        {/* Mode toggle buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button
            className={`btn btn-sm ${mode === 'attendance' ? 'btn-success' : 'btn-secondary'}`}
            onClick={() => setMode(mode === 'attendance' ? null : 'attendance')}
          >
            {mode === 'attendance' ? 'Done Marking' : 'Mark Attendance'}
          </button>
          <button
            className={`btn btn-sm ${mode === 'clear' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode(mode === 'clear' ? null : 'clear')}
          >
            {mode === 'clear' ? 'Done Clearing' : 'Mark Cleared'}
          </button>
        </div>

        {mode && (
          <div style={{ fontSize: '0.75rem', color: mode === 'attendance' ? 'var(--success)' : 'var(--primary)', marginBottom: '0.5rem', fontWeight: 500 }}>
            {mode === 'attendance'
              ? 'Tap dates to mark present/absent'
              : 'Tap present dates to mark as cleared (or un-clear)'}
          </div>
        )}

        {/* Month nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={prevMonth}>&larr;</button>
          <span style={{ fontWeight: 600 }}>{monthLabel}</span>
          <button className="btn btn-secondary btn-sm" onClick={nextMonth}>&rarr;</button>
        </div>

        {/* Calendar grid */}
        <div style={calGridStyle}>
          {DAYS.map((d) => (
            <div key={d} style={calHeaderCell}>{d}</div>
          ))}
          {/* Empty cells for offset */}
          {Array.from({ length: monthDays[0]?.day || 0 }).map((_, i) => (
            <div key={'empty-' + i} />
          ))}
          {monthDays.map(({ date }) => {
            const status = attMap.get(date);
            const isToday = date === todayStr();
            const isFuture = date > todayStr();
            // Determine if this cell is tappable in current mode
            const tappable = !isFuture && mode !== null && !(mode === 'attendance' && status === 'cleared') && !(mode === 'clear' && !status);
            return (
              <div
                key={date}
                onClick={() => handleDayClick(date)}
                style={{
                  ...calDayCell,
                  ...(isToday ? calTodayStyle : {}),
                  ...(status === 'present' ? calPresentStyle : {}),
                  ...(status === 'cleared' ? calClearedStyle : {}),
                  ...(isFuture ? calFutureStyle : {}),
                  cursor: tappable ? 'pointer' : 'default',
                  opacity: isFuture ? 0.35 : (mode && !tappable && !isFuture ? 0.5 : 1),
                }}
              >
                <span style={{ fontSize: '0.8125rem' }}>{parseInt(date.split('-')[2])}</span>
                {status === 'present' && <span style={dotPresent} />}
                {status === 'cleared' && <span style={checkMark}>&#10003;</span>}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ ...dotPresent, position: 'static' }} /> Present
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.875rem' }}>&#10003;</span> Cleared
          </span>
        </div>
      </div>

      {/* Settlement */}
      {unsettledDates.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--warning)', background: 'var(--warning-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                {unsettledDates.length} unsettled day{unsettledDates.length !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {unsettledDates.length} &times; {formatRs(parseFloat(dailyRate))} = <strong>{formatRs(unsettledTotal)}</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {formatDate(unsettledDates[0])} &mdash; {formatDate(unsettledDates[unsettledDates.length - 1])}
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleSettle}
              disabled={settling}
            >
              {settling ? 'Settling...' : 'Settle & Add to Expenses'}
            </button>
          </div>
        </div>
      )}

      {/* Add advance form */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={sectionTitle}>Add Advance</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '0 0 160px' }}>
            <label>Date</label>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
          </div>
          <div style={{ flex: '0 0 160px' }}>
            <label>Amount (Rs)</label>
            <input
              type="number"
              placeholder="e.g. 50000"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              min="1"
              step="1"
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label>Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. Bank transfer"
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Advance'}
          </button>
        </form>
      </div>

      {/* Advances table */}
      <div className="card">
        <h2 style={sectionTitle}>Advances History</h2>
        {sortedAdvances.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {sortedAdvances.map((a) => (
                  <tr key={a.id}>
                    <td>{formatDate(a.date)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatRs(a.amount)}</td>
                    <td style={{ color: a.note ? 'var(--text)' : 'var(--text-secondary)' }}>
                      {a.note || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
            No advances recorded yet.
          </p>
        )}
      </div>
    </div>
  );
}

const sectionTitle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  marginBottom: '1rem',
};

const calGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '0.25rem',
};

const calHeaderCell: CSSProperties = {
  textAlign: 'center',
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  padding: '0.25rem 0',
  textTransform: 'uppercase',
};

const calDayCell: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.5rem 0.25rem',
  borderRadius: 'var(--radius-sm)',
  minHeight: 44,
  transition: 'all 0.15s ease',
  userSelect: 'none',
};

const calTodayStyle: CSSProperties = {
  boxShadow: 'inset 0 0 0 2px var(--primary)',
};

const calPresentStyle: CSSProperties = {
  background: '#dcfce7',
};

const calClearedStyle: CSSProperties = {
  background: '#dbeafe',
};

const calFutureStyle: CSSProperties = {
  opacity: 0.35,
};

const dotPresent: CSSProperties = {
  position: 'absolute',
  bottom: 4,
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: 'var(--success)',
};

const checkMark: CSSProperties = {
  position: 'absolute',
  bottom: 2,
  fontSize: '0.625rem',
  fontWeight: 700,
  color: 'var(--primary)',
  lineHeight: 1,
};
