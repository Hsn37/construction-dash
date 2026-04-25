import { useState, useRef, CSSProperties } from 'react';
import heic2any from 'heic2any';
import { postUploadImage, fileUrl } from '../api/client';
import { useToast } from '../components/Toast';

interface UploadItem {
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  url?: string;
  error?: string;
}

export default function ImageUpload() {
  const { showToast } = useToast();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const newItems: UploadItem[] = [];
    for (const file of Array.from(files)) {
      const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
        || /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name);
      if (isHeic) {
        try {
          const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 }) as Blob;
          const jpegFile = new File([blob], file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), { type: 'image/jpeg' });
          newItems.push({ file: jpegFile, preview: URL.createObjectURL(blob), status: 'pending' });
        } catch {
          newItems.push({ file, preview: URL.createObjectURL(file), status: 'pending' });
        }
      } else {
        newItems.push({ file, preview: URL.createObjectURL(file), status: 'pending' });
      }
    }
    setItems((prev) => [...prev, ...newItems]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleUpload = async () => {
    const pending = items.filter((i) => i.status === 'pending');
    if (pending.length === 0) return;

    setUploading(true);

    for (let i = 0; i < items.length; i++) {
      if (items[i].status !== 'pending') continue;

      setItems((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'uploading' } : item))
      );

      try {
        const result = await postUploadImage(items[i].file);
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'done', url: result.url } : item
          )
        );
      } catch (err: any) {
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error', error: err.message } : item
          )
        );
      }
    }

    setUploading(false);
    showToast('Upload complete');
  };

  const copyUrl = (url: string) => {
    // Build the full proxied URL for sharing
    const fullUrl = url.startsWith('http') ? url : fileUrl(url);
    navigator.clipboard.writeText(fullUrl).then(() => showToast('URL copied'));
  };

  const clearDone = () => {
    setItems((prev) => {
      prev.filter((i) => i.status === 'done' || i.status === 'error').forEach((i) => URL.revokeObjectURL(i.preview));
      return prev.filter((i) => i.status !== 'done' && i.status !== 'error');
    });
  };

  return (
    <div>
      <h1 className="page-title">Image Upload</h1>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div
          style={dropZoneStyle}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { handleFiles(e.target.files); if (inputRef.current) inputRef.current.value = ''; }}
          />
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#128247;</div>
          <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
            Click or drag images here
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Supports JPG, PNG, WebP, HEIC
          </p>
        </div>

        {items.length > 0 && (
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {items.length} file{items.length !== 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {items.some((i) => i.status === 'done' || i.status === 'error') && (
                <button className="btn btn-secondary btn-sm" onClick={clearDone}>
                  Clear Done
                </button>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { items.forEach((i) => URL.revokeObjectURL(i.preview)); setItems([]); }}
              >
                Clear All
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={uploading || items.every((i) => i.status !== 'pending')}
              >
                {uploading ? 'Uploading...' : 'Upload All'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {items.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Files</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {items.map((item, i) => (
              <div key={i} style={fileRowStyle}>
                {/* Thumbnail */}
                <a
                  href={item.url ? (item.url.startsWith('http') ? item.url : fileUrl(item.url)) : item.preview}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img src={item.preview} alt="" style={thumbStyle} />
                </a>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.file.name}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                    {(item.file.size / 1024).toFixed(0)} KB
                  </div>
                  {item.url && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.url}
                    </div>
                  )}
                  {item.error && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>
                      {item.error}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <StatusBadge status={item.status} />
                  {item.url && (
                    <button className="btn btn-secondary btn-sm" onClick={() => copyUrl(item.url!)}>
                      Copy
                    </button>
                  )}
                  {item.status === 'pending' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => removeItem(i)}
                      style={{ padding: '0.15rem 0.4rem', color: 'var(--danger)' }}
                      title="Remove"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: UploadItem['status'] }) {
  const styles: Record<string, CSSProperties> = {
    pending: { background: 'var(--warning-light)', color: '#92400e' },
    uploading: { background: 'var(--primary-light)', color: 'var(--primary)' },
    done: { background: 'var(--success-light)', color: 'var(--success)' },
    error: { background: 'var(--danger-light)', color: 'var(--danger)' },
  };
  const labels: Record<string, string> = {
    pending: 'Pending',
    uploading: 'Uploading...',
    done: 'Done',
    error: 'Failed',
  };
  return (
    <span className="badge" style={styles[status]}>
      {labels[status]}
    </span>
  );
}

const dropZoneStyle: CSSProperties = {
  border: '2px dashed var(--border)',
  borderRadius: 'var(--radius)',
  padding: '2.5rem',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 0.15s',
};

const fileRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem',
  background: 'var(--bg)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
};

const thumbStyle: CSSProperties = {
  width: 56,
  height: 56,
  objectFit: 'cover',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  flexShrink: 0,
};
