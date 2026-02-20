'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Search, Edit, Trash2, X, BookOpen, Filter, Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, CheckSquare, Globe, Loader2, Tag } from 'lucide-react';

interface Book {
    id: number;
    isbn?: string;
    title: string;
    author?: string;
    publisher?: string;
    year?: number;
    edition?: string;
    subject_id?: number;
    category_id?: number;
    subject_name?: string;
    subject_color?: string;
    category_name?: string;
    total_copies: number;
    available_copies: number;
    shelf_location?: string;
    description?: string;
    language?: string;
    tags?: { id: number; name: string; color: string }[];
    tag_ids?: number[];
}

interface Subject { id: number; name: string; color: string; }
interface Category { id: number; name: string; }
interface TagItem { id: number; name: string; color: string; }

interface Toast { id: number; type: 'success' | 'error'; message: string; }

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast toast-${t.type}`}>
                    <span style={{ flex: 1 }}>{t.message}</span>
                    <button onClick={() => onRemove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
                        <X size={14} />
                    </button>
                </div>
            ))}
        </div>
    );
}

const EMPTY_BOOK: Partial<Book> = { title: '', author: '', isbn: '', publisher: '', year: undefined, total_copies: 1, shelf_location: '', language: 'Indonesia' };

export default function BooksPage() {
    const [books, setBooks] = useState<Book[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filterSubject, setFilterSubject] = useState('');
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<Book | null>(null);
    const [editBook, setEditBook] = useState<Partial<Book>>(EMPTY_BOOK);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [importModal, setImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [allTags, setAllTags] = useState<TagItem[]>([]);
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
    const [isbnLooking, setIsbnLooking] = useState(false);
    const limit = 15;

    const addToast = (message: string, type: 'success' | 'error' = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    const fetchBooks = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: String(limit), search, subject_id: filterSubject });
        const res = await fetch(`/api/books?${params}`);
        const data = await res.json();
        setBooks(data.books || []);
        setTotal(data.total || 0);
        setLoading(false);
    }, [page, search, filterSubject]);

    useEffect(() => {
        fetchBooks();
    }, [fetchBooks]);

    useEffect(() => {
        fetch('/api/subjects').then(r => r.json()).then(d => setSubjects(d.subjects || []));
        fetch('/api/tags').then(r => r.json()).then(d => setAllTags(d.tags || []));
        fetch('/api/books?limit=1').then(r => r.json()).then(() => {
            setCategories([
                { id: 1, name: 'Buku Teks' }, { id: 2, name: 'Buku Referensi' },
                { id: 3, name: 'Fiksi' }, { id: 4, name: 'Non-Fiksi' },
                { id: 5, name: 'Majalah / Jurnal' }, { id: 6, name: 'Pengembangan Diri' },
            ]);
        });
    }, []);

    const openAdd = () => {
        setEditBook(EMPTY_BOOK);
        setSelectedTagIds([]);
        setIsEditing(false);
        setModalOpen(true);
    };

    const openEdit = (book: Book) => {
        setEditBook({ ...book });
        setSelectedTagIds(book.tags?.map(t => t.id) || []);
        setIsEditing(true);
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!editBook.title?.trim()) { addToast('Judul buku wajib diisi', 'error'); return; }
        setSaving(true);
        const method = isEditing ? 'PUT' : 'POST';
        const res = await fetch('/api/books', {
            method, headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...editBook, tag_ids: selectedTagIds }),
        });
        const data = await res.json();
        setSaving(false);
        if (res.ok) {
            addToast(isEditing ? 'Buku berhasil diperbarui' : 'Buku berhasil ditambahkan');
            setModalOpen(false);
            fetchBooks();
        } else {
            addToast(data.error || 'Terjadi kesalahan', 'error');
        }
    };

    const handleDelete = async (book: Book) => {
        const res = await fetch(`/api/books?id=${book.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            addToast('Buku berhasil dihapus');
            setDeleteConfirm(null);
            fetchBooks();
        } else {
            addToast(data.error || 'Gagal menghapus buku', 'error');
            setDeleteConfirm(null);
        }
    };

    const totalPages = Math.ceil(total / limit);

    const handleImport = async () => {
        if (!importFile) return;
        setImporting(true);
        setImportResult(null);
        const fd = new FormData();
        fd.append('file', importFile);
        const res = await fetch('/api/import/books', { method: 'POST', body: fd });
        const data = await res.json();
        setImporting(false);
        if (res.ok) {
            setImportResult(data);
            if (data.imported > 0) fetchBooks();
        } else {
            setImportResult({ imported: 0, skipped: 0, errors: [data.error] });
        }
    };

    const openImportModal = () => { setImportModal(true); setImportFile(null); setImportResult(null); };

    const handleIsbnLookup = async () => {
        const isbn = editBook.isbn?.replace(/[-\s]/g, '');
        if (!isbn) { addToast('Masukkan ISBN terlebih dahulu', 'error'); return; }
        setIsbnLooking(true);
        try {
            const res = await fetch(`/api/isbn-lookup?isbn=${isbn}`);
            const data = await res.json();
            if (data.found) {
                const d = data.data;
                setEditBook(prev => ({
                    ...prev,
                    title: d.title || prev.title,
                    author: d.author || prev.author,
                    publisher: d.publisher || prev.publisher,
                    year: d.year || prev.year,
                    description: d.description || prev.description,
                }));
                addToast(`Data ditemukan dari ${data.source === 'openlibrary' ? 'Open Library' : 'Google Books'}`);
            } else {
                addToast('ISBN tidak ditemukan di database online', 'error');
            }
        } catch { addToast('Gagal mencari ISBN online', 'error'); }
        setIsbnLooking(false);
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const toggleSelectAll = () => {
        if (selectedIds.size === books.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(books.map(b => b.id)));
    };
    const handleBulkDelete = async () => {
        if (!confirm(`Hapus ${selectedIds.size} buku yang dipilih?`)) return;
        setBulkDeleting(true);
        try {
            const res = await fetch('/api/bulk', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete_books', ids: Array.from(selectedIds) }),
            });
            const data = await res.json();
            if (res.ok) {
                addToast(`${data.deleted} buku dihapus${data.skipped > 0 ? `, ${data.skipped} dilewati (pinjaman aktif)` : ''}`);
                setSelectedIds(new Set());
                fetchBooks();
            } else {
                addToast(data.error || 'Gagal menghapus', 'error');
            }
        } catch { addToast('Gagal menghapus', 'error'); }
        setBulkDeleting(false);
    };

    const getStockBadge = (book: Book) => {
        const pct = book.available_copies / book.total_copies;
        if (book.available_copies === 0) return <span className="badge badge-red">Habis</span>;
        if (pct <= 0.3) return <span className="badge badge-yellow">{book.available_copies}/{book.total_copies}</span>;
        return <span className="badge badge-green">{book.available_copies}/{book.total_copies}</span>;
    };

    return (
        <div>
            <ToastContainer toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

            <div className="page-header">
                <div>
                    <h1>Katalog Buku</h1>
                    <p>Total {total} judul buku terdaftar</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        className="btn btn-secondary"
                        onClick={openImportModal}
                        style={{ display: 'flex', alignItems: 'center', gap: 7 }}
                    >
                        <Upload size={15} /> Import Excel
                    </button>
                    <button className="btn btn-primary" onClick={openAdd}>
                        <Plus size={16} /> Tambah Buku
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="toolbar">
                <div className="search-bar">
                    <Search size={15} />
                    <input
                        className="form-input"
                        placeholder="Cari judul, pengarang, ISBN..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                    <select
                        className="form-select"
                        style={{ width: 'auto', minWidth: 180 }}
                        value={filterSubject}
                        onChange={e => { setFilterSubject(e.target.value); setPage(1); }}
                    >
                        <option value="">Semua Mata Pelajaran</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
                <div style={{
                    background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)',
                    borderRadius: 10, padding: '10px 16px', marginBottom: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckSquare size={15} color="#F85149" />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedIds.size} buku dipilih</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedIds(new Set())}>Batal</button>
                        <button className="btn btn-danger btn-sm" onClick={handleBulkDelete} disabled={bulkDeleting}>
                            <Trash2 size={13} /> {bulkDeleting ? 'Menghapus...' : 'Hapus Terpilih'}
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: 36 }}>
                                <input type="checkbox" checked={books.length > 0 && selectedIds.size === books.length} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                            </th>
                            <th>JUDUL BUKU</th>
                            <th>ISBN</th>
                            <th>PENGARANG</th>
                            <th>PENERBIT</th>
                            <th>MATA PELAJARAN</th>
                            <th>STOK</th>
                            <th>RAK</th>
                            <th>AKSI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={10}><div className="loading-overlay"><div className="spinner"></div></div></td></tr>
                        ) : books.length === 0 ? (
                            <tr><td colSpan={10}>
                                <div className="empty-state">
                                    <BookOpen size={40} />
                                    <h3>Tidak ada buku</h3>
                                    <p>Tambahkan buku pertama Anda</p>
                                </div>
                            </td></tr>
                        ) : books.map((book, i) => (
                            <tr key={book.id} style={{ background: selectedIds.has(book.id) ? 'rgba(79,110,247,0.06)' : undefined }}>
                                <td>
                                    <input type="checkbox" checked={selectedIds.has(book.id)} onChange={() => toggleSelect(book.id)} style={{ cursor: 'pointer' }} />
                                </td>
                                <td>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13.5 }}>{book.title}</div>
                                    {book.edition && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Edisi {book.edition}</div>}
                                </td>
                                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{book.isbn || '-'}</td>
                                <td>{book.author || '-'}</td>
                                <td>{book.publisher || '-'}{book.year ? ` (${book.year})` : ''}</td>
                                <td>
                                    {book.subject_name ? (
                                        <span className="badge" style={{
                                            background: `${book.subject_color || '#4F6EF7'}22`,
                                            color: book.subject_color || '#4F6EF7',
                                        }}>{book.subject_name}</span>
                                    ) : '-'}
                                </td>
                                <td>{getStockBadge(book)}</td>
                                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{book.shelf_location || '-'}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn-icon btn" title="Edit" onClick={() => openEdit(book)}><Edit size={13} /></button>
                                        <button className="btn-icon btn" title="Hapus" onClick={() => setDeleteConfirm(book)} style={{ color: 'var(--danger)' }}>
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {totalPages > 1 && (
                    <div className="pagination">
                        <span>Menampilkan {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} dari {total} buku</span>
                        <div className="pagination-buttons">
                            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</button>
                            <span style={{ padding: '5px 10px', fontSize: 13, color: 'var(--text-muted)' }}>{page} / {totalPages}</span>
                            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next ›</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {modalOpen && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
                    <div className="modal">
                        <div className="modal-header">
                            <h2>{isEditing ? 'Edit Buku' : 'Tambah Buku Baru'}</h2>
                            <button className="btn-icon btn" onClick={() => setModalOpen(false)}><X size={16} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-row">
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Judul Buku *</label>
                                    <input className="form-input" value={editBook.title || ''} onChange={e => setEditBook({ ...editBook, title: e.target.value })} placeholder="Masukkan judul buku" />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">ISBN</label>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <input className="form-input" value={editBook.isbn || ''} onChange={e => setEditBook({ ...editBook, isbn: e.target.value })} placeholder="978xxxxxxxxxx" style={{ flex: 1 }} />
                                        <button className="btn btn-secondary btn-sm" onClick={handleIsbnLookup} disabled={isbnLooking} title="Cari data buku online" style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {isbnLooking ? <Loader2 size={13} className="spin" /> : <Globe size={13} />}
                                            {isbnLooking ? 'Mencari...' : 'Cari Online'}
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Edisi</label>
                                    <input className="form-input" value={editBook.edition || ''} onChange={e => setEditBook({ ...editBook, edition: e.target.value })} placeholder="1, 2, Revisi..." />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Pengarang</label>
                                    <input className="form-input" value={editBook.author || ''} onChange={e => setEditBook({ ...editBook, author: e.target.value })} placeholder="Nama pengarang" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Penerbit</label>
                                    <input className="form-input" value={editBook.publisher || ''} onChange={e => setEditBook({ ...editBook, publisher: e.target.value })} placeholder="Nama penerbit" />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Tahun Terbit</label>
                                    <input className="form-input" type="number" value={editBook.year || ''} onChange={e => setEditBook({ ...editBook, year: parseInt(e.target.value) || undefined })} placeholder="2024" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Jumlah Eksemplar</label>
                                    <input className="form-input" type="number" min={1} value={editBook.total_copies || 1} onChange={e => setEditBook({ ...editBook, total_copies: parseInt(e.target.value) || 1 })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Mata Pelajaran</label>
                                    <select className="form-select" value={editBook.subject_id || ''} onChange={e => setEditBook({ ...editBook, subject_id: parseInt(e.target.value) || undefined })}>
                                        <option value="">-- Pilih Mata Pelajaran --</option>
                                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Kategori</label>
                                    <select className="form-select" value={editBook.category_id || ''} onChange={e => setEditBook({ ...editBook, category_id: parseInt(e.target.value) || undefined })}>
                                        <option value="">-- Pilih Kategori --</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Lokasi Rak</label>
                                    <input className="form-input" value={editBook.shelf_location || ''} onChange={e => setEditBook({ ...editBook, shelf_location: e.target.value })} placeholder="A-01" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Bahasa</label>
                                    <select className="form-select" value={editBook.language || 'Indonesia'} onChange={e => setEditBook({ ...editBook, language: e.target.value })}>
                                        <option>Indonesia</option>
                                        <option>Inggris</option>
                                        <option>Arab</option>
                                        <option>Lainnya</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Deskripsi</label>
                                <textarea className="form-textarea" value={editBook.description || ''} onChange={e => setEditBook({ ...editBook, description: e.target.value })} placeholder="Deskripsi singkat buku..." />
                            </div>
                            {/* Tag picker */}
                            <div className="form-group">
                                <label className="form-label">Tag</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {allTags.map(tag => {
                                        const sel = selectedTagIds.includes(tag.id);
                                        return (
                                            <button key={tag.id} type="button" onClick={() => {
                                                setSelectedTagIds(prev => sel ? prev.filter(id => id !== tag.id) : [...prev, tag.id]);
                                            }} style={{
                                                padding: '3px 10px', borderRadius: 12, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                                                border: sel ? 'none' : '1px dashed var(--border-color)',
                                                background: sel ? tag.color + '22' : 'transparent',
                                                color: sel ? tag.color : 'var(--text-muted)',
                                            }}>
                                                <Tag size={10} style={{ marginRight: 3 }} />{tag.name}
                                            </button>
                                        );
                                    })}
                                    {allTags.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum ada tag. Buat di menu Pengaturan.</span>}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Menyimpan...' : (isEditing ? 'Simpan Perubahan' : 'Tambah Buku')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirm && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
                    <div className="modal" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h2>Hapus Buku</h2>
                            <button className="btn-icon btn" onClick={() => setDeleteConfirm(null)}><X size={16} /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                                Apakah Anda yakin ingin menghapus buku <strong style={{ color: 'var(--text-primary)' }}>&ldquo;{deleteConfirm.title}&rdquo;</strong>?
                                Tindakan ini tidak dapat dibatalkan.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Batal</button>
                            <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Hapus</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Excel Modal */}
            {importModal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setImportModal(false); }}>
                    <div className="modal" style={{ maxWidth: 520 }}>
                        <div className="modal-header">
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FileSpreadsheet size={18} color="#16A34A" /> Import Katalog Buku
                            </h2>
                            <button className="btn-icon btn" onClick={() => setImportModal(false)}><X size={16} /></button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* Template download */}
                            <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <FileSpreadsheet size={20} color="#16A34A" style={{ flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Download Format Template</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Isi data buku sesuai template, lalu upload kembali</div>
                                </div>
                                <a
                                    href="/api/import/books"
                                    download
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#16A34A', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
                                >
                                    <Download size={13} /> Unduh Template
                                </a>
                            </div>

                            {/* File picker */}
                            {!importResult && (
                                <div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls"
                                        style={{ display: 'none' }}
                                        onChange={e => setImportFile(e.target.files?.[0] ?? null)}
                                    />
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{
                                            border: `2px dashed ${importFile ? '#3B82F6' : 'var(--border-color)'}`,
                                            borderRadius: 12, padding: '28px', textAlign: 'center',
                                            cursor: 'pointer', transition: 'border-color 0.2s',
                                            background: importFile ? 'rgba(59,130,246,0.04)' : 'var(--bg-secondary)',
                                        }}
                                    >
                                        {importFile ? (
                                            <>
                                                <FileSpreadsheet size={28} color="#3B82F6" style={{ margin: '0 auto 8px', display: 'block' }} />
                                                <div style={{ fontWeight: 600, color: '#3B82F6', fontSize: 14 }}>{importFile.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{(importFile.size / 1024).toFixed(1)} KB · Klik untuk ganti file</div>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.35 }} />
                                                <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>Klik untuk pilih file Excel</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>.xlsx atau .xls · Maksimal 10 MB</div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Result */}
                            {importResult && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <div style={{ flex: 1, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                                            <CheckCircle2 size={20} color="#16A34A" style={{ display: 'block', margin: '0 auto 4px' }} />
                                            <div style={{ fontSize: 22, fontWeight: 800, color: '#16A34A' }}>{importResult.imported}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Buku diimpor</div>
                                        </div>
                                        <div style={{ flex: 1, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                                            <AlertCircle size={20} color="#CA8A04" style={{ display: 'block', margin: '0 auto 4px' }} />
                                            <div style={{ fontSize: 22, fontWeight: 800, color: '#CA8A04' }}>{importResult.skipped}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dilewati</div>
                                        </div>
                                    </div>
                                    {importResult.errors.length > 0 && (
                                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12, maxHeight: 140, overflowY: 'auto' }}>
                                            <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase' }}>Log</p>
                                            {importResult.errors.map((e, i) => (
                                                <div key={i} style={{ fontSize: 12, color: '#CA8A04', padding: '2px 0' }}>⚠ {e}</div>
                                            ))}
                                        </div>
                                    )}
                                    <button className="btn btn-secondary" onClick={() => { setImportFile(null); setImportResult(null); }}>
                                        Import File Lain
                                    </button>
                                </div>
                            )}
                        </div>

                        {!importResult && (
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setImportModal(false)}>Batal</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleImport}
                                    disabled={!importFile || importing}
                                    style={{ background: 'linear-gradient(135deg,#15803D,#22C55E)' }}
                                >
                                    {importing ? 'Mengimpor…' : 'Impor Sekarang'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
