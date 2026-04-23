import { useState, useEffect, useMemo, CSSProperties } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import { getExpenses, getAdvances, fileUrl } from '../api/client';
import type { Expense, Advance } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a',
  '#0891b2', '#4f46e5', '#c026d3', '#d97706', '#059669',
  '#6366f1', '#e11d48',
];

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

function shortDate(dateStr: string): string {
  const iso = toISO(dateStr);
  const parts = iso.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const d = new Date(toISO(dateStr));
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function getWeekKey(dateStr: string): string {
  const d = new Date(toISO(dateStr));
  const day = d.getDay();
  const diff = d.getDate() - day;
  const weekStart = new Date(d);
  weekStart.setDate(diff);
  return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
}

export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    Promise.all([getExpenses(), getAdvances()])
      .then(([e, a]) => { setExpenses(e); setAdvances(a); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return true;
    });
  }, [expenses, dateFrom, dateTo]);

  const totalSpent = useMemo(() => filtered.reduce((s, e) => s + e.total, 0), [filtered]);
  const totalAdvances = useMemo(() => advances.reduce((s, a) => s + a.amount, 0), [advances]);
  const saleemSpent = useMemo(() => filtered.filter((e) => !e.paid_by || e.paid_by === 'سلیم صاحب' || e.paid_by === 'saleem').reduce((s, e) => s + e.total, 0), [filtered]);
  const balance = totalAdvances - saleemSpent;

  const thisMonth = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return filtered.filter((e) => e.date.startsWith(ym)).reduce((s, e) => s + e.total, 0);
  }, [filtered]);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) {
      map.set(e.category, (map.get(e.category) || 0) + e.total);
    }
    const arr = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return arr;
  }, [filtered]);

  const pieData = useMemo(() => {
    if (categoryData.length <= 8) return categoryData;
    const top = categoryData.slice(0, 7);
    const rest = categoryData.slice(7).reduce((s, c) => s + c.value, 0);
    return [...top, { name: 'Other', value: rest }];
  }, [categoryData]);

  const weeklyData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) {
      const wk = getWeekKey(e.date);
      map.set(wk, (map.get(wk) || 0) + e.total);
    }
    return Array.from(map.entries())
      .map(([week, total]) => ({ week, total }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [filtered]);

  const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) {
      const d = toISO(e.date);
      map.set(d, (map.get(d) || 0) + e.total);
    }
    return Array.from(map.entries())
      .map(([day, total]) => ({ day, total }))
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-30); // last 30 days with data
  }, [filtered]);

  const recentExpenses = useMemo(() => {
    return [...filtered]
      .sort((a, b) => toISO(b.date).localeCompare(toISO(a.date)))
      .slice(0, 8);
  }, [filtered]);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="card" style={{ color: 'var(--danger)' }}>Error: {error}</div>;

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      {/* Date filter */}
      <div className="filter-bar">
        <div>
          <label>From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-placeholder="Select date" />
        </div>
        <div>
          <label>To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-placeholder="Select date" />
        </div>
        {(dateFrom || dateTo) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
            Clear
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-4 summary-cards">
        <div className="card">
          <div className="card-header">Total Spent</div>
          <div className="card-value">{formatRs(totalSpent)}</div>
        </div>
        <div className="card">
          <div className="card-header">Saleem Sahab Balance</div>
          <div className="card-value" style={{ color: balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatRs(balance)}
          </div>
        </div>
        <div className="card">
          <div className="card-header">This Month</div>
          <div className="card-value">{formatRs(thisMonth)}</div>
        </div>
        <div className="card">
          <div className="card-header">Total Entries</div>
          <div className="card-value">{filtered.length}</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-header" style={{ marginBottom: '1rem' }}>Spend by Category</div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={false}
                  labelLine={false}
                  fontSize={11}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => formatRs(val)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p style={emptyStyle}>No data</p>
          )}
        </div>

        <div className="card">
          <div className="card-header" style={{ marginBottom: '1rem' }}>Weekly Spend</div>
          {weeklyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="week" fontSize={11} tick={{ fill: 'var(--text-secondary)' }} tickFormatter={formatDate} />
                <YAxis fontSize={11} tick={{ fill: 'var(--text-secondary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(val: number) => formatRs(val)} />
                <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p style={emptyStyle}>No data</p>
          )}
        </div>
      </div>

      {/* Daily spend chart */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ marginBottom: '1rem' }}>Daily Spend (Last 30 Days)</div>
        {dailyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" fontSize={10} tick={{ fill: 'var(--text-secondary)' }} tickFormatter={shortDate} interval="preserveStartEnd" />
              <YAxis fontSize={10} tick={{ fill: 'var(--text-secondary)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(val: number) => formatRs(val)} labelFormatter={formatDate} />
              <Bar dataKey="total" fill="var(--primary)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={emptyStyle}>No data</p>
        )}
      </div>

      {/* Recent activity feed */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ marginBottom: '1rem' }}>Recent Activity</div>
        {recentExpenses.length > 0 ? (
          <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
            {/* Timeline line */}
            <div style={timelineLineStyle} />
            {recentExpenses.map((e, i) => {
              const catColor = COLORS[Math.abs(hashCode(e.category)) % COLORS.length];
              const images = e.image_urls ? e.image_urls.split(',').filter(Boolean) : [];
              return (
                <div key={e.id} style={{ position: 'relative', paddingBottom: i < recentExpenses.length - 1 ? '1.25rem' : 0 }}>
                  {/* Timeline dot */}
                  <div style={{ ...timelineDotStyle, background: catColor }} />
                  <div style={timelineCardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          <span style={{ ...categoryPillStyle, background: catColor + '1a', color: catColor, borderColor: catColor + '33' }}>
                            {e.category}
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                            {relativeTime(e.date)}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.125rem' }}>
                          {e.description}
                        </div>
                        {e.quantity != null && e.quantity > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {e.quantity} {e.unit || ''}{e.rate != null ? ` @ ${formatRs(e.rate)}` : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap', marginLeft: '0.75rem' }}>
                        {formatRs(e.total)}
                      </div>
                    </div>
                    {images.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem' }}>
                        {images.slice(0, 3).map((url, j) => {
                          const src = url.startsWith('http') ? url : fileUrl(url);
                          return (
                            <a key={j} href={src} target="_blank" rel="noopener noreferrer">
                              <img src={src} alt="" style={feedThumbStyle} />
                            </a>
                          );
                        })}
                        {images.length > 3 && (
                          <div style={{ ...feedThumbStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>
                            +{images.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={emptyStyle}>No expenses recorded yet.</p>
        )}
      </div>

      {/* Category breakdown table */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: '1rem' }}>Category Breakdown</div>
        {categoryData.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                  <th style={{ textAlign: 'right' }}>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {categoryData.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td style={{ textAlign: 'right' }}>{formatRs(c.value)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {totalSpent > 0 ? ((c.value / totalSpent) * 100).toFixed(1) : '0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={emptyStyle}>No expenses recorded yet.</p>
        )}
      </div>
    </div>
  );
}

const emptyStyle: CSSProperties = {
  textAlign: 'center',
  color: 'var(--text-secondary)',
  padding: '2rem',
};

const timelineLineStyle: CSSProperties = {
  position: 'absolute',
  left: '0.4375rem',
  top: '0.5rem',
  bottom: '0.5rem',
  width: 2,
  background: 'var(--border)',
};

const timelineDotStyle: CSSProperties = {
  position: 'absolute',
  left: '-1.5rem',
  top: '0.625rem',
  width: 12,
  height: 12,
  borderRadius: '50%',
  border: '2px solid var(--surface)',
  boxShadow: '0 0 0 2px var(--border)',
};

const timelineCardStyle: CSSProperties = {
  padding: '0.625rem 0.75rem',
  background: 'var(--bg)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
};

const categoryPillStyle: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  padding: '0.1rem 0.5rem',
  borderRadius: '9999px',
  border: '1px solid',
  whiteSpace: 'nowrap',
};

const feedThumbStyle: CSSProperties = {
  width: 40,
  height: 40,
  objectFit: 'cover',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
};

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}
