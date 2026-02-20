'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, CalendarClock, X, Filter, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface Reservation {
    id: number;
    book_id: number;
    member_id: number;
    book_title: string;
    book_isbn: string;
    member_name: string;
    member_code: string;
    reserved_at: string;
    expires_at: string;
    status: string;
}

interface Book { id: number; title: string; isbn?: string; available_copies: number; }
interface Member { id: number; name: string; member_id: string; class?: string; type: string; }
interface Toast { id: number; type: 'success' | 'error'; message: string; }

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast toast-${t.type}`}>
                    <span style={{ flex: 1 }}>{t.message}</span>
                    <button onClick={() => onRemove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}><X size={14} /></button>
                </div>
            ))}
        </div>
    );
}

function formatDate(s: string) {
    if (!s) return '-';
    return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = { aktif: 'badge-blue', terpenuhi: 'badge-green', dibatalkan: 'badge-red' };
    const icons: Record<string, React.ReactNode> = {
        aktif: <Clock size={11} />,
        terpenuhi: <CheckCircle2 size={11} />,
        dibatalkan: <XCircle size={11} />,
    };
    const label: Record<string, string> = { aktif: 'Aktif', terpenuhi: 'Terpenuhi', dibatalkan: 'Dibatalkan' };
    return (
        <span className={`badge ${map[status] || 'badge-gray'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {icons[status]}{label[status] || status}
        </span>
    );
}

function isExpired(expiresAt: string) {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
}

export default function ReservationsPage() {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [filterStatus, setFilterStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [createModal, setCreateModal] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [saving, setSaving] = useState(false);

    // Book + member search for create modal
    const [books, setBooks] = useState<Book[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [bookSearch, setBookSearch] = useState('');
    const [memberSearch, setMemberSearch] = useState('');
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);

    // Confirm action
    const [confirmAction, setConfirmAction] = useState<{ id: number; action: 'terpenuhi' | 'dibatalkan'; title: string } | null>(null);

    const limit = 15;

    const addToast = (message: string, type: 'success' | 'error' = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    const fetchReservations = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: String(limit), status: filterStatus });
        const res = await fetch(`/api/reservations?${params}`);
        const data = await res.json();
        setReservations(data.reservations || []);
        setTotal(data.total || 0);
        setLoading(false);
    }, [page, filterStatus]);

    useEffect(() => { fetchReservations(); }, [fetchReservations]);

    // Search books
    useEffect(() => {
        if (bookSearch.length > 1) {
            fetch(`/api/books?search=${bookSearch}&limit=10`)
                .then(r => r.json())
                .then(d => setBooks(d.books || []));
        } else {
            setBooks([]);
        }
    }, [bookSearch]);

    // Search members
    useEffect(() => {
        if (memberSearch.length > 1) {
            fetch(`/api/members?search=${memberSearch}&limit=10`)
                .then(r => r.json())
                .then(d => setMembers(d.members || []));
        } else {
            setMembers([]);
        }
    }, [memberSearch]);

    const handleCreate = async () => {
        if (!selectedBook || !selectedMember) { addToast('Pilih buku dan anggota terlebih dahulu', 'error'); return; }
        setSaving(true);
        const res = await fetch('/api/reservations', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ book_id: selectedBook.id, member_id: selectedMember.id }),
        });
        const data = await res.json();
        setSaving(false);
        if (res.ok) {
            addToast(`Reservasi buku "${selectedBook.title}" berhasil dibuat`);
            setCreateModal(false);
            setSelectedBook(null); setSelectedMember(null); setBookSearch(''); setMemberSearch('');
            fetchReservations();
        } else {
            addToast(data.error || 'Gagal membuat reservasi', 'error');
        }
    };

    const handleStatusChange = async () => {
        if (!confirmAction) return;
        const res = await fetch('/api/reservations', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: confirmAction.id, status: confirmAction.action }),
        });
        const data = await res.json();
        if (res.ok) {
            addToast(confirmAction.action === 'terpenuhi'
                ? `Reservasi "${confirmAction.title}" berhasil dipenuhi`
                : `Reservasi "${confirmAction.title}" dibatalkan`);
            setConfirmAction(null);
            fetchReservations();
        } else {
            addToast(data.error || 'Gagal mengubah status', 'error');
        }
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div>
            <ToastContainer toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

            <div className="page-header">
                <div>
                    <h1>Reservasi Buku</h1>
                    <p>Kelola reservasi buku yang sedang tidak tersedia</p>
                </div>
                <button className="btn btn-primary" onClick={() => setCreateModal(true)}>
                    <Plus size={16} /> Buat Reservasi
                </button>
            </div>

            <div className="toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                    <select className="form-select" style={{ width: 'auto' }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
                        <option value="">Semua Status</option>
                        <option value="aktif">Aktif</option>
                        <option value="terpenuhi">Terpenuhi</option>
                        <option value="dibatalkan">Dibatalkan</option>
                    </select>
                </div>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: 36 }}>#</th>
                            <th>BUKU</th>
                            <th>ANGGOTA</th>
                            <th>TGL RESERVASI</th>
                            <th>KADALUARSA</th>
                            <th>STATUS</th>
                            <th>AKSI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7}><div className="loading-overlay"><div className="spinner"></div></div></td></tr>
                        ) : reservations.length === 0 ? (
                            <tr><td colSpan={7}>
                                <div className="empty-state">
                                    <CalendarClock size={40} />
                                    <h3>Belum ada data reservasi</h3>
                                    <p>Klik &ldquo;Buat Reservasi&rdquo; untuk memulai</p>
                                </div>
                            </td></tr>
                        ) : reservations.map((r, i) => (
                            <tr key={r.id}>
                                <td><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{(page - 1) * limit + i + 1}</span></td>
                                <td>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{r.book_title}</div>
                                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{r.book_isbn}</div>
                                </td>
                                <td>
                                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 13 }}>{r.member_name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.member_code}</div>
                                </td>
                                <td style={{ fontSize: 13 }}>{formatDate(r.reserved_at)}</td>
                                <td style={{ fontSize: 13 }}>
                                    <span style={{ color: r.status === 'aktif' && isExpired(r.expires_at) ? 'var(--danger)' : 'inherit' }}>
                                        {formatDate(r.expires_at)}
                                        {r.status === 'aktif' && isExpired(r.expires_at) && (
                                            <span style={{ fontSize: 10, marginLeft: 4, fontWeight: 600, color: 'var(--danger)' }}>EXPIRED</span>
                                        )}
                                    </span>
                                </td>
                                <td><StatusBadge status={r.status} /></td>
                                <td>
                                    {r.status === 'aktif' && (
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button
                                                className="btn btn-success btn-sm"
                                                onClick={() => setConfirmAction({ id: r.id, action: 'terpenuhi', title: r.book_title })}
                                            >
                                                <CheckCircle2 size={12} /> Penuhi
                                            </button>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => setConfirmAction({ id: r.id, action: 'dibatalkan', title: r.book_title })}
                                                style={{ color: 'var(--danger)' }}
                                            >
                                                <XCircle size={12} /> Batal
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {totalPages > 1 && (
                    <div className="pagination">
                        <span>Menampilkan {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} dari {total} reservasi</span>
                        <div className="pagination-buttons">
                            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</button>
                            <span style={{ padding: '5px 10px', fontSize: 13, color: 'var(--text-muted)' }}>{page}/{totalPages}</span>
                            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next ›</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create Reservation Modal */}
            {createModal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setCreateModal(false); }}>
                    <div className="modal">
                        <div className="modal-header">
                            <h2>Buat Reservasi Buku</h2>
                            <button className="btn-icon btn" onClick={() => setCreateModal(false)}><X size={16} /></button>
                        </div>
                        <div className="modal-body">
                            <div style={{
                                background: 'rgba(79,110,247,0.08)', border: '1px solid rgba(79,110,247,0.2)',
                                borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                                fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
                            }}>
                                <CalendarClock size={14} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--accent)' }} />
                                Reservasi hanya bisa dibuat untuk buku yang stoknya <strong>habis</strong> (0 eksemplar tersedia). Reservasi berlaku selama <strong>7 hari</strong>.
                            </div>

                            {/* Book search */}
                            <div className="form-group">
                                <label className="form-label">Cari Buku *</label>
                                {selectedBook ? (
                                    <div style={{ background: 'rgba(79,110,247,0.1)', border: '1px solid rgba(79,110,247,0.3)', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{selectedBook.title}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {selectedBook.isbn} · Stok: <strong style={{ color: 'var(--danger)' }}>0 eksemplar</strong>
                                            </div>
                                        </div>
                                        <button onClick={() => { setSelectedBook(null); setBookSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ position: 'relative' }}>
                                        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                        <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Cari judul atau ISBN buku yang habis..." value={bookSearch} onChange={e => setBookSearch(e.target.value)} />
                                        {books.length > 0 && bookSearch.length > 1 && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, zIndex: 50, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                                                {books.filter(b => b.available_copies === 0).length === 0 ? (
                                                    <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                                                        Tidak ada buku habis stok yang cocok
                                                    </div>
                                                ) : books.filter(b => b.available_copies === 0).map(b => (
                                                    <div key={b.id} onClick={() => { setSelectedBook(b); setBookSearch(''); setBooks([]); }}
                                                        style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b.title}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                            {b.isbn} · <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Stok Habis</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Member search */}
                            <div className="form-group">
                                <label className="form-label">Cari Anggota *</label>
                                {selectedMember ? (
                                    <div style={{ background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{selectedMember.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {selectedMember.member_id}{selectedMember.class ? ` · ${selectedMember.class}` : ''} · {selectedMember.type}
                                            </div>
                                        </div>
                                        <button onClick={() => { setSelectedMember(null); setMemberSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ position: 'relative' }}>
                                        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                        <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Cari nama atau ID anggota..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
                                        {members.length > 0 && memberSearch.length > 1 && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, zIndex: 50, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                                                {members.map(m => (
                                                    <div key={m.id} onClick={() => { setSelectedMember(m); setMemberSearch(''); setMembers([]); }}
                                                        style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                            {m.member_id}{m.class ? ` · ${m.class}` : ''} · {m.type}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setCreateModal(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !selectedBook || !selectedMember}>
                                {saving ? 'Menyimpan...' : 'Buat Reservasi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Action Modal */}
            {confirmAction && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setConfirmAction(null); }}>
                    <div className="modal" style={{ maxWidth: 440 }}>
                        <div className="modal-header">
                            <h2>{confirmAction.action === 'terpenuhi' ? 'Penuhi Reservasi' : 'Batalkan Reservasi'}</h2>
                            <button className="btn-icon btn" onClick={() => setConfirmAction(null)}><X size={16} /></button>
                        </div>
                        <div className="modal-body">
                            {confirmAction.action === 'terpenuhi' ? (
                                <div style={{
                                    background: 'rgba(63,185,80,0.08)', border: '1px solid rgba(63,185,80,0.2)',
                                    borderRadius: 10, padding: '14px 16px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                        <CheckCircle2 size={18} color="#3FB950" style={{ flexShrink: 0, marginTop: 1 }} />
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, marginBottom: 4 }}>
                                                Penuhi reservasi ini?
                                            </div>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                Buku <strong>&ldquo;{confirmAction.title}&rdquo;</strong> akan ditandai sebagai terpenuhi.
                                                Pastikan buku sudah tersedia dan siap dipinjamkan.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)',
                                    borderRadius: 10, padding: '14px 16px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                        <XCircle size={18} color="#F85149" style={{ flexShrink: 0, marginTop: 1 }} />
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--danger)', fontSize: 14, marginBottom: 4 }}>
                                                Batalkan reservasi ini?
                                            </div>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                Reservasi buku <strong>&ldquo;{confirmAction.title}&rdquo;</strong> akan dibatalkan. Tindakan ini tidak bisa dikembalikan.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setConfirmAction(null)}>Kembali</button>
                            {confirmAction.action === 'terpenuhi' ? (
                                <button className="btn btn-success" onClick={handleStatusChange}>
                                    <CheckCircle2 size={14} /> Penuhi Reservasi
                                </button>
                            ) : (
                                <button className="btn btn-danger" onClick={handleStatusChange} style={{ background: 'var(--danger)', color: 'white' }}>
                                    <XCircle size={14} /> Batalkan Reservasi
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
