import { useState, useEffect, useMemo, useRef, useCallback, CSSProperties } from 'react';
import { getExpenses, getCategories, deleteExpense, fileUrl } from '../api/client';
import type { Expense, Category } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { useRole } from '../App';

function formatRs(n: number): string {
  return 'Rs ' + n.toLocaleString('en-PK');
}

/** Normalize any date string to YYYY-MM-DD for sorting/comparison */
function toISO(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  if (parts[0].length === 4) return dateStr; // already YYYY-MM-DD
  return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY → YYYY-MM-DD
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const iso = toISO(dateStr);
  const parts = iso.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

type SortField = 'date' | 'category' | 'description' | 'quantity' | 'rate' | 'total';
type SortDir = 'asc' | 'desc';

const DELETE_MODE_DURATION = 30; // seconds

export default function Entries() {
  const role = useRole();
  const isAdmin = role === 'admin';
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [groupByDate, setGroupByDate] = useState(true);

  // Delete mode: 5-tap activation
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteTimer, setDeleteTimer] = useState(DELETE_MODE_DURATION);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const tapTimestamps = useRef<number[]>([]);
  const timerRef = useRef<number | null>(null);

  const activateDeleteMode = useCallback(() => {
    setDeleteMode(true);
    setDeleteTimer(DELETE_MODE_DURATION);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setDeleteTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setDeleteMode(false);
          setConfirmId(null);
          return DELETE_MODE_DURATION;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  const deactivateDeleteMode = useCallback(() => {
    setDeleteMode(false);
    setConfirmId(null);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const handleTitleTap = useCallback(() => {
    if (!isAdmin) return;
    if (deleteMode) { deactivateDeleteMode(); return; }
    const now = Date.now();
    tapTimestamps.current.push(now);
    // Keep only last 5 taps
    if (tapTimestamps.current.length > 5) tapTimestamps.current.shift();
    // Check if 5 taps within 2 seconds
    if (tapTimestamps.current.length === 5) {
      const elapsed = now - tapTimestamps.current[0];
      if (elapsed < 2000) {
        tapTimestamps.current = [];
        activateDeleteMode();
        showToast('Delete mode activated (30s)', 'error');
      }
    }
  }, [isAdmin, deleteMode, activateDeleteMode, deactivateDeleteMode, showToast]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      setConfirmId(null);
      showToast('Entry deleted');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    Promise.all([getExpenses(), getCategories()])
      .then(([e, c]) => { setExpenses(e); setCategories(c); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const d = toISO(e.date);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      if (catFilter && e.category !== catFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !e.description.toLowerCase().includes(s) &&
          !e.category.toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [expenses, dateFrom, dateTo, catFilter, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'date': aVal = toISO(a.date); bVal = toISO(b.date); break;
        case 'category': aVal = a.category; bVal = b.category; break;
        case 'description': aVal = a.description; bVal = b.description; break;
        case 'quantity': aVal = a.quantity ?? 0; bVal = b.quantity ?? 0; break;
        case 'rate': aVal = a.rate ?? 0; bVal = b.rate ?? 0; break;
        case 'total': aVal = a.total; bVal = b.total; break;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const grouped = useMemo(() => {
    if (!groupByDate) return null;
    const map = new Map<string, Expense[]>();
    for (const e of sorted) {
      const key = toISO(e.date);
      const list = map.get(key) || [];
      list.push(e);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) =>
      sortDir === 'desc' ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])
    );
  }, [sorted, groupByDate, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return ' \u2195';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

  const parseImages = (urls: string): string[] => {
    if (!urls) return [];
    return urls.split(',').map((u) => u.trim()).filter(Boolean);
  };

  const imgSrc = (url: string): string => {
    // If it's already a full URL, use as-is. Otherwise proxy through /api/files
    return url.startsWith('http') ? url : fileUrl(url);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="card" style={{ color: 'var(--danger)' }}>Error: {error}</div>;

  const activeCategories = categories.filter((c) => c.active === 1);

  const renderRow = (e: Expense) => (
    <>
      <tr
        key={e.id}
        onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
        style={{ cursor: 'pointer' }}
      >
        {deleteMode && (
          <td style={{ textAlign: 'center' }} onClick={(ev) => ev.stopPropagation()}>
            {confirmId === e.id ? (
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button className="btn btn-danger btn-sm" style={{ fontSize: '0.6875rem', padding: '0.15rem 0.4rem' }} onClick={() => handleDelete(e.id)}>Yes</button>
                <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.6875rem', padding: '0.15rem 0.4rem' }} onClick={() => setConfirmId(null)}>No</button>
              </div>
            ) : (
              <button className="btn btn-danger btn-sm" style={{ padding: '0.15rem 0.4rem' }} onClick={() => setConfirmId(e.id)} title="Delete">&times;</button>
            )}
          </td>
        )}
        <td>{formatDate(e.date)}</td>
        <td>{e.category}</td>
        <td>{e.description}</td>
        <td style={{ textAlign: 'right' }}>{e.quantity ?? '-'}</td>
        <td>{e.unit || '-'}</td>
        <td style={{ textAlign: 'right' }}>{e.rate != null ? formatRs(e.rate) : '-'}</td>
        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatRs(e.total)}</td>
        <td style={{ fontSize: '0.75rem' }}>{e.paid_by || 'سلیم صاحب'}</td>
      </tr>
      {expandedId === e.id && (
        <tr key={e.id + '-images'}>
          <td colSpan={deleteMode ? 9 : 8} style={{ background: '#f8fafc', padding: '1rem' }}>
            {parseImages(e.image_urls).length > 0 ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {parseImages(e.image_urls).map((url, i) => (
                  <a key={i} href={imgSrc(url)} target="_blank" rel="noopener noreferrer">
                    <img
                      src={imgSrc(url)}
                      alt={`Attachment ${i + 1}`}
                      style={thumbStyle}
                    />
                  </a>
                ))}
              </div>
            ) : (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                No images attached
              </span>
            )}
          </td>
        </tr>
      )}
    </>
  );

  const renderCard = (e: Expense) => (
    <div
      key={e.id}
      className="card"
      style={{ marginBottom: '0.5rem', padding: '0.75rem 1rem', cursor: 'pointer' }}
      onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{formatDate(e.date)}</span>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{formatRs(e.total)}</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>{e.description}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          <span className="badge">{e.category}</span>
          <span style={{ fontSize: '0.625rem', color: (e.paid_by || 'سلیم صاحب') === 'سلیم صاحب' ? 'var(--success)' : 'var(--primary)', fontWeight: 600 }}>
            {e.paid_by || 'سلیم صاحب'}
          </span>
        </div>
        {(e.quantity != null && e.quantity > 0) && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {e.quantity} {e.unit || ''} {e.rate != null ? `@ ${formatRs(e.rate)}` : ''}
          </span>
        )}
      </div>
      {expandedId === e.id && parseImages(e.image_urls).length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
          {parseImages(e.image_urls).map((url, i) => (
            <a key={i} href={imgSrc(url)} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()}>
              <img src={imgSrc(url)} alt={`Attachment ${i + 1}`} style={thumbStyle} />
            </a>
          ))}
        </div>
      )}
      {deleteMode && (
        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }} onClick={(ev) => ev.stopPropagation()}>
          {confirmId === e.id ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>Delete this entry?</span>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.id)}>Delete</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmId(null)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmId(e.id)}>Delete</button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {deleteMode && (
        <div style={deleteBannerStyle}>
          <span>Delete mode active — {deleteTimer}s remaining</span>
          <button className="btn btn-secondary btn-sm" onClick={deactivateDeleteMode} style={{ background: '#fff', fontSize: '0.75rem' }}>Exit</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0, cursor: isAdmin ? 'pointer' : 'default', userSelect: 'none' }} onClick={handleTitleTap}>Entries</h1>
        <button
          className={`btn ${groupByDate ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setGroupByDate(!groupByDate)}
        >
          {groupByDate ? 'Ungrouped' : 'Group by Date'}
        </button>
      </div>

      <div className="filter-bar">
        <div>
          <label>From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-placeholder="Select date" />
        </div>
        <div>
          <label>To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-placeholder="Select date" />
        </div>
        <div>
          <label>Category</label>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="">All Categories</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.label}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Search</label>
          <input
            type="search"
            placeholder="Search description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="table-wrap desktop-only">
        <table>
          <thead>
            <tr>
              {deleteMode && <th style={{ width: 60 }}></th>}
              <th style={thClickable} onClick={() => handleSort('date')}>
                Date{sortIcon('date')}
              </th>
              <th style={thClickable} onClick={() => handleSort('category')}>
                Category{sortIcon('category')}
              </th>
              <th style={thClickable} onClick={() => handleSort('description')}>
                Description{sortIcon('description')}
              </th>
              <th style={{ ...thClickable, textAlign: 'right' }} onClick={() => handleSort('quantity')}>
                Qty{sortIcon('quantity')}
              </th>
              <th>Unit</th>
              <th style={{ ...thClickable, textAlign: 'right' }} onClick={() => handleSort('rate')}>
                Rate{sortIcon('rate')}
              </th>
              <th style={{ ...thClickable, textAlign: 'right' }} onClick={() => handleSort('total')}>
                Total{sortIcon('total')}
              </th>
              <th>Paid By</th>
            </tr>
          </thead>
          <tbody>
            {grouped
              ? grouped.map(([date, items]) => (
                  <>
                    <tr key={'group-' + date}>
                      <td
                        colSpan={deleteMode ? 9 : 8}
                        style={{
                          background: 'var(--primary-light)',
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          color: 'var(--primary)',
                          padding: '0.5rem 1rem',
                        }}
                      >
                        {formatDate(date)} ({items.length} {items.length === 1 ? 'entry' : 'entries'})
                      </td>
                    </tr>
                    {items.map(renderRow)}
                  </>
                ))
              : sorted.map(renderRow)}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={deleteMode ? 9 : 8} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                  No entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="mobile-only">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', overflowX: 'auto' }}>
          {(['date', 'total', 'category'] as SortField[]).map((f) => (
            <button
              key={f}
              className={`btn btn-sm ${sortField === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleSort(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}{sortField === f ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : ''}
            </button>
          ))}
        </div>
        {grouped
          ? grouped.map(([date, items]) => (
              <div key={'mgroup-' + date}>
                <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.8125rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
                  {formatDate(date)} ({items.length} {items.length === 1 ? 'entry' : 'entries'})
                </div>
                {items.map(renderCard)}
              </div>
            ))
          : sorted.map(renderCard)}
        {sorted.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
            No entries found.
          </div>
        )}
      </div>

      <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        Showing {sorted.length} of {expenses.length} entries
        {sorted.length > 0 && (
          <> &mdash; Total: <strong>{formatRs(sorted.reduce((s, e) => s + e.total, 0))}</strong></>
        )}
      </div>
    </div>
  );
}

const thClickable: CSSProperties = {
  cursor: 'pointer',
  userSelect: 'none',
};

const deleteBannerStyle: CSSProperties = {
  background: 'var(--danger)',
  color: '#fff',
  padding: '0.5rem 1rem',
  borderRadius: 'var(--radius-sm)',
  marginBottom: '1rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '0.8125rem',
  fontWeight: 600,
};

const thumbStyle: CSSProperties = {
  width: 80,
  height: 80,
  objectFit: 'cover',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
};
