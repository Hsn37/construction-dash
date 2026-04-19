import { useState, useEffect, useMemo, CSSProperties } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { getExpenses, getAdvances } from '../api/client';
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

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day;
  const weekStart = new Date(d);
  weekStart.setDate(diff);
  return weekStart.toISOString().slice(0, 10);
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
  const balance = totalAdvances - totalSpent;

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
