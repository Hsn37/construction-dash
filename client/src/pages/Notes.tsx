import { useState, useEffect, useRef, CSSProperties } from 'react';
import { getNotes, postNote, deleteNote, type Note } from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { useRole } from '../App';

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr + 'Z');
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB');
}

export default function Notes() {
  const role = useRole();
  const isAdmin = role === 'admin';
  const { showToast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchNotes = () => {
    getNotes()
      .then(setNotes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotes(); }, []);

  const handleAdd = async () => {
    const content = newNote.trim();
    if (!content) return;
    setSubmitting(true);
    try {
      await postNote(content);
      setNewNote('');
      showToast('Note added');
      fetchNotes();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setConfirmDeleteId(null);
      showToast('Note deleted');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="card" style={{ color: 'var(--danger)' }}>Error: {error}</div>;

  return (
    <div>
      <h1 className="page-title">Notes</h1>

      {/* Add note */}
      {isAdmin && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <textarea
            ref={inputRef}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Write a note..."
            rows={3}
            style={{ resize: 'vertical', marginBottom: '0.75rem' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd();
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
              Ctrl+Enter to save
            </span>
            <button
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={!newNote.trim() || submitting}
            >
              {submitting ? 'Saving...' : 'Add Note'}
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {notes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notes.map((note) => (
            <div key={note.id} className="card" style={noteCardStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={noteContentStyle}>{note.content}</div>
                <div style={noteMetaStyle}>{timeAgo(note.created_at)}</div>
              </div>
              {isAdmin && (
                <div style={{ flexShrink: 0, marginLeft: '0.75rem' }}>
                  {confirmDeleteId === note.id ? (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(note.id)}
                        style={{ fontSize: '0.6875rem', padding: '0.15rem 0.5rem' }}
                      >
                        Confirm
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setConfirmDeleteId(null)}
                        style={{ fontSize: '0.6875rem', padding: '0.15rem 0.5rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setConfirmDeleteId(note.id)}
                      style={{ padding: '0.15rem 0.4rem', color: 'var(--danger)' }}
                      title="Delete note"
                    >
                      &times;
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
          No notes yet.
        </div>
      )}
    </div>
  );
}

const noteCardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  padding: '1rem',
};

const noteContentStyle: CSSProperties = {
  fontSize: '0.9375rem',
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const noteMetaStyle: CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--text-secondary)',
  marginTop: '0.375rem',
};
