import { useState, useEffect, useRef, useCallback, CSSProperties } from 'react';
import { getCategories, postCategories, postTranscribe, postParse, postCommit, postUploadImage } from '../api/client';
import type { Category } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';

interface ParsedRow {
  id: string;
  date: string;
  category: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  total: string;
  assignedImages: number[]; // indices into uploadedFiles
}

interface UploadedFile {
  file: File;
  preview: string;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AddEntry() {
  const { showToast } = useToast();

  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  // Step 1: Input
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Files
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Process
  const [processing, setProcessing] = useState(false);

  // Step 3: Preview
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [selectedImageIdx, setSelectedImageIdx] = useState<number | null>(null);

  // Step 4: Saving
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoadingCats(false));
  }, []);

  // Cleanup previews
  useEffect(() => {
    return () => {
      uploadedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    };
  }, [uploadedFiles]);

  // Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setTranscribing(true);
        try {
          const res = await postTranscribe(blob);
          setText((prev) => (prev ? prev + '\n' : '') + res.text);
          showToast('Transcription added');
        } catch (err: any) {
          showToast('Transcription failed: ' + err.message, 'error');
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = window.setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err: any) {
      showToast('Microphone access denied', 'error');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  // File handling
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles: UploadedFile[] = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (idx: number) => {
    setUploadedFiles((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });
    // Update row assignments
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        assignedImages: r.assignedImages
          .filter((i) => i !== idx)
          .map((i) => (i > idx ? i - 1 : i)),
      }))
    );
  };

  // Process text
  const handleProcess = async () => {
    if (!text.trim()) return;
    setProcessing(true);
    try {
      const catLabels = categories.filter((c) => c.active === 1).map((c) => c.label);
      const res = await postParse(text.trim(), catLabels);
      const parsed: ParsedRow[] = (res.rows || []).map((r: any) => ({
        id: crypto.randomUUID(),
        date: r.date || todayStr(),
        category: r.category || '',
        description: r.description || '',
        quantity: r.quantity != null ? String(r.quantity) : '',
        unit: r.unit || '',
        rate: r.rate != null ? String(r.rate) : '',
        total: r.total != null ? String(r.total) : '',
        assignedImages: [],
      }));
      setRows(parsed);

      // Detect new categories suggested by LLM
      const existingLabels = new Set(categories.filter(c => c.active === 1).map(c => c.label));
      const newCats = new Set(parsed.map(r => r.category).filter(c => c && !existingLabels.has(c)));
      if (newCats.size > 0) {
        showToast(`Parsed ${parsed.length} row(s) — ${newCats.size} new categor${newCats.size === 1 ? 'y' : 'ies'} suggested`);
      } else {
        showToast(`Parsed ${parsed.length} row(s)`);
      }
    } catch (err: any) {
      showToast('Parse failed: ' + err.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Row editing — auto-calculate total when qty or rate changes
  const updateRow = useCallback(
    (id: string, field: keyof ParsedRow, value: string) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const updated = { ...r, [field]: value };
          if (field === 'quantity' || field === 'rate') {
            const qty = parseFloat(updated.quantity);
            const rate = parseFloat(updated.rate);
            if (!isNaN(qty) && !isNaN(rate)) {
              updated.total = String(qty * rate);
            }
          }
          return updated;
        })
      );
    },
    []
  );

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        date: todayStr(),
        category: '',
        description: '',
        quantity: '',
        unit: '',
        rate: '',
        total: '',
        assignedImages: [],
      },
    ]);
  };

  // Image assignment
  const toggleImageAssignment = (rowId: string, imgIdx: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const has = r.assignedImages.includes(imgIdx);
        return {
          ...r,
          assignedImages: has
            ? r.assignedImages.filter((i) => i !== imgIdx)
            : [...r.assignedImages, imgIdx],
        };
      })
    );
  };

  // Save / Commit
  const handleSave = async () => {
    if (rows.length === 0) return;
    setSaving(true);
    try {
      // Auto-create any new categories that don't exist yet
      const existingLabels = new Set(categories.filter(c => c.active === 1).map(c => c.label));
      const newCatLabels = [...new Set(rows.map(r => r.category).filter(c => c && !existingLabels.has(c)))];
      for (const label of newCatLabels) {
        const updated = await postCategories({ action: 'add', label });
        setCategories(updated);
      }

      // Upload all unique images that are assigned
      const assignedIndices = new Set<number>();
      rows.forEach((r) => r.assignedImages.forEach((i) => assignedIndices.add(i)));

      const imageUrlMap = new Map<number, string>();
      for (const idx of assignedIndices) {
        const uf = uploadedFiles[idx];
        if (uf) {
          const res = await postUploadImage(uf.file);
          imageUrlMap.set(idx, res.url);
        }
      }

      // Build rows data with image URLs
      const rowsData = rows.map((r) => ({
        date: r.date,
        category: r.category,
        description: r.description,
        quantity: r.quantity ? parseFloat(r.quantity) : null,
        unit: r.unit || null,
        rate: r.rate ? parseFloat(r.rate) : null,
        total: r.total ? parseFloat(r.total) : 0,
        image_urls: r.assignedImages
          .map((i) => imageUrlMap.get(i))
          .filter(Boolean)
          .join(','),
      }));

      const fd = new FormData();
      fd.append('rows', JSON.stringify(rowsData));

      const result = await postCommit(fd);
      if (result.success) {
        showToast(`Saved ${result.ids.length} entries!`);
        // Clear form
        setText('');
        setRows([]);
        setUploadedFiles((prev) => {
          prev.forEach((f) => URL.revokeObjectURL(f.preview));
          return [];
        });
        setSelectedImageIdx(null);
      }
    } catch (err: any) {
      showToast('Save failed: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const activeCategories = categories.filter((c) => c.active === 1);

  if (loadingCats) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="page-title">Add Entry</h1>

      {/* Step 1: Input Area */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={sectionTitle}>Step 1: Notes</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {isRecording && (
              <span style={recordingIndicator}>
                <span style={redDot} />
                {formatDuration(recordingDuration)}
              </span>
            )}
            {transcribing && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--primary)' }}>
                Transcribing...
              </span>
            )}
            {!isRecording ? (
              <button
                className="btn btn-secondary"
                onClick={startRecording}
                disabled={transcribing}
                title="Record voice"
              >
                &#127908; Record
              </button>
            ) : (
              <button
                className="btn btn-danger"
                onClick={stopRecording}
              >
                &#9632; Stop
              </button>
            )}
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or dictate expense notes here...&#10;&#10;Example: آج 200 بجری خریدی 50 روپے فی بوری، مزدور کو 2000 دیے"
          rows={6}
          style={{ resize: 'vertical' }}
        />

        {/* File upload area */}
        <div style={{ marginTop: '1rem' }}>
          <label style={{ marginBottom: '0.5rem', display: 'block' }}>Attachments</label>
          <div
            style={dropZoneStyle}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => addFiles(e.target.files)}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Click or drag images here
            </span>
          </div>
          {uploadedFiles.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {uploadedFiles.map((uf, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={uf.preview} alt={uf.file.name} style={previewThumbStyle} />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    style={removeThumbBtn}
                    title="Remove"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Process */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={sectionTitle}>Step 2: Process</h2>
          <button
            className="btn btn-primary"
            onClick={handleProcess}
            disabled={!text.trim() || processing}
          >
            {processing ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LoadingSpinnerInline /> Processing...
              </span>
            ) : (
              'Process with AI'
            )}
          </button>
        </div>
        {processing && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            AI is parsing your notes into structured expense rows...
          </p>
        )}
      </div>

      {/* Step 3: Preview & Assign */}
      {rows.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={sectionTitle}>Step 3: Preview &amp; Edit</h2>
            <button className="btn btn-secondary btn-sm" onClick={addRow}>
              + Add Row
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            {/* Table area */}
            <div style={{ flex: 1, overflowX: 'auto' }}>
              <table style={{ fontSize: '0.875rem', tableLayout: 'fixed', minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Date</th>
                    <th style={{ width: 160 }}>Category</th>
                    <th style={{ width: 240 }}>Description</th>
                    <th style={{ width: 70 }}>Qty</th>
                    <th style={{ width: 70 }}>Unit</th>
                    <th style={{ width: 90 }}>Rate</th>
                    <th style={{ width: 100 }}>Total</th>
                    <th style={{ width: 50 }}>Imgs</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      style={selectedImageIdx !== null ? { cursor: 'pointer' } : undefined}
                      onClick={() => {
                        if (selectedImageIdx !== null) {
                          toggleImageAssignment(row.id, selectedImageIdx);
                        }
                      }}
                    >
                      <td style={cellPad}>
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => updateRow(row.id, 'date', e.target.value)}
                          style={cellInputStyle}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td style={cellPad}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <CategorySelect
                            value={row.category}
                            categories={activeCategories}
                            onChange={(val) => updateRow(row.id, 'category', val)}
                            onAddNew={async (label) => {
                              try {
                                const updated = await postCategories({ action: 'add', label });
                                setCategories(updated);
                                updateRow(row.id, 'category', label);
                                showToast(`Category "${label}" added`);
                              } catch (err: any) {
                                showToast(err.message, 'error');
                              }
                            }}
                          />
                          {row.category && !activeCategories.some(c => c.label === row.category) && (
                            <span style={newBadge}>new</span>
                          )}
                        </div>
                      </td>
                      <td style={cellPad}>
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                          style={cellInputStyle}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td style={cellPad}>
                        <input
                          type="number"
                          value={row.quantity}
                          onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                          style={{ ...cellInputStyle, width: 60 }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td style={cellPad}>
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(e) => updateRow(row.id, 'unit', e.target.value)}
                          style={{ ...cellInputStyle, width: 60 }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td style={cellPad}>
                        <input
                          type="number"
                          value={row.rate}
                          onChange={(e) => updateRow(row.id, 'rate', e.target.value)}
                          style={{ ...cellInputStyle, width: 80 }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td style={cellPad}>
                        <input
                          type="number"
                          value={row.total}
                          onChange={(e) => updateRow(row.id, 'total', e.target.value)}
                          style={{ ...cellInputStyle, width: 90 }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td style={{ ...cellPad, textAlign: 'center' }}>
                        {row.assignedImages.length > 0 ? (
                          <span className="badge">{row.assignedImages.length}</span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>-</span>
                        )}
                      </td>
                      <td style={cellPad}>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={(e) => { e.stopPropagation(); deleteRow(row.id); }}
                          title="Delete row"
                          style={{ padding: '0.15rem 0.4rem' }}
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Image panel */}
            {uploadedFiles.length > 0 && (
              <div style={imagePanelStyle}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  Images
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Click an image to select it, then click rows to assign.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {uploadedFiles.map((uf, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedImageIdx(selectedImageIdx === i ? null : i)}
                      style={{
                        ...imageThumbWrap,
                        borderColor: selectedImageIdx === i ? 'var(--primary)' : 'var(--border)',
                        boxShadow: selectedImageIdx === i ? '0 0 0 2px var(--primary-light)' : 'none',
                      }}
                    >
                      <img src={uf.preview} alt="" style={imagePanelThumb} />
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {uf.file.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {rows.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={sectionTitle}>Step 4: Save</h2>
            <button
              className="btn btn-success btn-lg"
              onClick={handleSave}
              disabled={saving || rows.length === 0}
            >
              {saving ? 'Saving...' : `Save ${rows.length} Entr${rows.length === 1 ? 'y' : 'ies'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CategorySelect({
  value,
  categories,
  onChange,
  onAddNew,
}: {
  value: string;
  categories: Category[];
  onChange: (val: string) => void;
  onAddNew: (label: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  if (adding) {
    return (
      <div style={{ display: 'flex', gap: '0.25rem' }} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder='e.g. بجری (gravel)'
          style={{ ...cellInputStyle, flex: 1 }}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && newLabel.trim()) {
              await onAddNew(newLabel.trim());
              setNewLabel('');
              setAdding(false);
            }
            if (e.key === 'Escape') {
              setAdding(false);
              setNewLabel('');
            }
          }}
        />
        <button
          className="btn btn-primary btn-sm"
          style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
          onClick={async () => {
            if (newLabel.trim()) {
              await onAddNew(newLabel.trim());
              setNewLabel('');
              setAdding(false);
            }
          }}
        >
          OK
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === '__add_new__') {
          setAdding(true);
        } else {
          onChange(e.target.value);
        }
      }}
      style={cellInputStyle}
      onClick={(e) => e.stopPropagation()}
    >
      <option value="">Select...</option>
      {/* Show LLM-suggested value if not in the existing list */}
      {value && !categories.some(c => c.label === value) && (
        <option value={value}>{value}</option>
      )}
      {categories.map((c) => (
        <option key={c.id} value={c.label}>{c.label}</option>
      ))}
      <option value="__add_new__">+ Add new...</option>
    </select>
  );
}

function LoadingSpinnerInline() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
}

const sectionTitle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  margin: 0,
};

const dropZoneStyle: CSSProperties = {
  border: '2px dashed var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '1rem',
  textAlign: 'center',
  cursor: 'pointer',
};

const newBadge: CSSProperties = {
  fontSize: '0.625rem',
  fontWeight: 600,
  padding: '0.1rem 0.35rem',
  borderRadius: '9999px',
  background: 'var(--warning-light)',
  color: '#92400e',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const previewThumbStyle: CSSProperties = {
  width: 64,
  height: 64,
  objectFit: 'cover',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
};

const removeThumbBtn: CSSProperties = {
  position: 'absolute',
  top: -6,
  right: -6,
  width: 20,
  height: 20,
  borderRadius: '50%',
  background: 'var(--danger)',
  color: '#fff',
  border: 'none',
  fontSize: '0.75rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};

const recordingIndicator: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--danger)',
};

const redDot: CSSProperties = {
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: 'var(--danger)',
  animation: 'pulse 1s ease infinite',
};

const cellPad: CSSProperties = {
  padding: '0.25rem 0.25rem',
};

const cellInputStyle: CSSProperties = {
  padding: '0.375rem 0.5rem',
  fontSize: '0.875rem',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  width: '100%',
  lineHeight: '1.8',
};

const imagePanelStyle: CSSProperties = {
  width: 160,
  flexShrink: 0,
  padding: '0.75rem',
  background: 'var(--bg)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  maxHeight: 400,
  overflowY: 'auto',
};

const imageThumbWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  padding: '0.375rem',
  border: '2px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  transition: 'border-color 0.15s',
};

const imagePanelThumb: CSSProperties = {
  width: '100%',
  height: 80,
  objectFit: 'cover',
  borderRadius: 'var(--radius-sm)',
};
