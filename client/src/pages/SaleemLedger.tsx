import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { getAdvances, getExpenses, postAdvance } from '../api/client';
import type { Advance, Expense } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';

function formatRs(n: number): string {
  return 'Rs ' + n.toLocaleString('en-PK');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SaleemLedger() {
  const { showToast } = useToast();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formDate, setFormDate] = useState(todayStr());
  const [formAmount, setFormAmount] = useState('');
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([getAdvances(), getExpenses()])
      .then(([a, e]) => { setAdvances(a); setExpenses(e); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const totalGiven = useMemo(() => advances.reduce((s, a) => s + a.amount, 0), [advances]);
  const totalSpent = useMemo(() => expenses.reduce((s, e) => s + e.total, 0), [expenses]);
  const balance = totalGiven - totalSpent;

  const sortedAdvances = useMemo(() => {
    return [...advances].sort((a, b) => b.date.localeCompare(a.date));
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
