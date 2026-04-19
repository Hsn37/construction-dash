import { useState, useEffect, CSSProperties } from 'react';
import { getCategories, postCategories } from '../api/client';
import type { Category } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';

export default function Categories() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setSaving(true);
    try {
      const result = await postCategories({ action: 'add', label: newLabel.trim() });
      setCategories(result);
      setNewLabel('');
      showToast('Category added');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditValue(cat.label);
  };

  const handleEditSave = async (id: string) => {
    if (!editValue.trim()) return;
    setSaving(true);
    try {
      const result = await postCategories({ action: 'update', id, label: editValue.trim() });
      setCategories(result);
      setEditingId(null);
      showToast('Category updated');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, activate: boolean) => {
    setSaving(true);
    try {
      if (activate) {
        const result = await postCategories({ action: 'add', id, label: categories.find(c => c.id === id)?.label });
        setCategories(result);
      } else {
        const result = await postCategories({ action: 'delete', id });
        setCategories(result);
      }
      showToast(activate ? 'Category reactivated' : 'Category deactivated');
      await reload();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="card" style={{ color: 'var(--danger)' }}>Error: {error}</div>;

  const active = categories.filter((c) => c.active === 1);
  const inactive = categories.filter((c) => c.active !== 1);

  return (
    <div>
      <h1 className="page-title">Categories</h1>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label>New Category</label>
            <input
              type="text"
              placeholder='e.g. بجری (gravel)'
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving || !newLabel.trim()}>
            Add
          </button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={sectionTitle}>Active Categories ({active.length})</h2>
        {active.length === 0 ? (
          <p style={emptyStyle}>No active categories.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {active.map((cat) => (
              <div key={cat.id} style={rowStyle}>
                {editingId === cat.id ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditSave(cat.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => handleEditSave(cat.id)}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                ) : (
                  <span
                    style={{ flex: 1, cursor: 'pointer', padding: '0.25rem 0' }}
                    onClick={() => startEdit(cat)}
                    title="Click to edit"
                  >
                    {cat.label}
                  </span>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => toggleActive(cat.id, false)}
                  disabled={saving}
                  title="Deactivate"
                >
                  Deactivate
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {inactive.length > 0 && (
        <div className="card">
          <h2 style={sectionTitle}>Inactive Categories ({inactive.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {inactive.map((cat) => (
              <div key={cat.id} style={{ ...rowStyle, opacity: 0.5 }}>
                <span style={{ flex: 1, textDecoration: 'line-through' }}>{cat.label}</span>
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => toggleActive(cat.id, true)}
                  disabled={saving}
                >
                  Reactivate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const sectionTitle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  marginBottom: '1rem',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.5rem 0.75rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
};

const emptyStyle: CSSProperties = {
  textAlign: 'center',
  color: 'var(--text-secondary)',
  padding: '1.5rem',
};
