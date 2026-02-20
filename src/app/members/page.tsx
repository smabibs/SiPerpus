'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Search, Edit, Trash2, X, Users, Filter, CreditCard, CheckSquare, BookMarked, Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import { IdCardModal } from '@/components/IdCardModal';
import MemberHistoryModal from '@/components/MemberHistoryModal';

interface Member {
    id: number;
    member_id: string;
    name: string;
    type: string;
    class?: string;
    major?: string;
    phone?: string;
    email?: string;
    address?: string;
    status: string;
    joined_at: string;
    active_loans: number;
    photo?: string;
}

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

const CLASSES = [
    'X-IPA-1', 'X-IPA-2', 'X-IPA-3', 'X-IPS-1', 'X-IPS-2', 'X-IPS-3',
    'XI-IPA-1', 'XI-IPA-2', 'XI-IPA-3', 'XI-IPS-1', 'XI-IPS-2', 'XI-IPS-3',
    'XII-IPA-1', 'XII-IPA-2', 'XII-IPA-3', 'XII-IPS-1', 'XII-IPS-2', 'XII-IPS-3',
];

const EMPTY_MEMBER: Partial<Member> = { name: '', member_id: '', type: 'siswa', class: '', major: 'IPA', status: 'aktif' };

export default function MembersPage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<Member | null>(null);
    const [editMember, setEditMember] = useState<Partial<Member>>(EMPTY_MEMBER);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [idCardMember, setIdCardMember] = useState<Member | null>(null);
    const [school, setSchool] = useState({ school_name: '', school_address: '', school_city: '', school_phone: '', school_logo: '' });
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [historyMember, setHistoryMember] = useState<Member | null>(null);
    const [importModal, setImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const limit = 15;

    useEffect(() => {
        fetch('/api/settings').then(r => r.json()).then(d => setSchool({
            school_name: d.school_name || '', school_address: d.school_address || '',
            school_city: d.school_city || '', school_phone: d.school_phone || '',
            school_logo: d.school_logo || '',
        }));
    }, []);

    const addToast = (message: string, type: 'success' | 'error' = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    const fetchMembers = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: String(limit), search, type: filterType });
        const res = await fetch(`/api/members?${params}`);
        const data = await res.json();
        setMembers(data.members || []);
        setTotal(data.total || 0);
        setLoading(false);
    }, [page, search, filterType]);

    useEffect(() => { fetchMembers(); }, [fetchMembers]);

    const openAdd = () => {
        setEditMember({ ...EMPTY_MEMBER });
        setIsEditing(false);
        setModalOpen(true);
    };

    const openEdit = (m: Member) => {
        setEditMember({ ...m });
        setIsEditing(true);
        setModalOpen(true);
    };

    const autoGenerateId = () => {
        const prefix = editMember.type === 'siswa' ? 'SIS' : editMember.type === 'guru' ? 'GUR' : 'STF';
        const num = Math.floor(Math.random() * 90000) + 10000;
        setEditMember(prev => ({ ...prev, member_id: `${prefix}${num}` }));
    };

    const handleSave = async () => {
        if (!editMember.name?.trim() || !editMember.member_id?.trim() || !editMember.type) {
            addToast('ID anggota, nama, dan tipe wajib diisi', 'error'); return;
        }
        setSaving(true);
        const method = isEditing ? 'PUT' : 'POST';
        const res = await fetch('/api/members', {
            method, headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editMember),
        });
        const data = await res.json();
        setSaving(false);
        if (res.ok) {
            addToast(isEditing ? 'Data anggota diperbarui' : 'Anggota baru ditambahkan');
            setModalOpen(false); fetchMembers();
        } else {
            addToast(data.error || 'Terjadi kesalahan', 'error');
        }
    };

    const handleDelete = async (m: Member) => {
        const res = await fetch(`/api/members?id=${m.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) { addToast('Anggota berhasil dihapus'); setDeleteConfirm(null); fetchMembers(); }
        else { addToast(data.error || 'Gagal menghapus anggota', 'error'); setDeleteConfirm(null); }
    };

    const totalPages = Math.ceil(total / limit);

    const typeBadge = (type: string) => {
        const cfg: Record<string, { cls: string; label: string }> = {
            siswa: { cls: 'badge-blue', label: 'Siswa' },
            guru: { cls: 'badge-purple', label: 'Guru' },
            staff: { cls: 'badge-gray', label: 'Staff' },
        };
        const c = cfg[type] || { cls: 'badge-gray', label: type };
        return <span className={`badge ${c.cls}`}>{c.label}</span>;
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const toggleSelectAll = () => {
        if (selectedIds.size === members.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(members.map(m => m.id)));
    };
    const handleBulkDelete = async () => {
        if (!confirm(`Hapus ${selectedIds.size} anggota yang dipilih?`)) return;
        setBulkDeleting(true);
        try {
            const res = await fetch('/api/bulk', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete_members', ids: Array.from(selectedIds) }),
            });
            const data = await res.json();
            if (res.ok) {
                addToast(`${data.deleted} anggota dihapus${data.skipped > 0 ? `, ${data.skipped} dilewati (pinjaman aktif)` : ''}`);
                setSelectedIds(new Set());
                fetchMembers();
            } else {
                addToast(data.error || 'Gagal menghapus', 'error');
            }
        } catch { addToast('Gagal menghapus', 'error'); }
        setBulkDeleting(false);
    };

    return (
        <div>
            <ToastContainer toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

            <div className="page-header">
                <div>
                    <h1>Manajemen Anggota</h1>
                    <p>Total {total} anggota terdaftar</p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}>
                    <Plus size={16} /> Tambah Anggota
                </button>
            </div>

            <div className="toolbar">
                <div className="search-bar">
                    <Search size={15} />
                    <input className="form-input" placeholder="Cari nama, ID, kelas..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setImportModal(true); setImportFile(null); setImportResult(null); }}>
                        <Upload size={13} /> Import Excel
                    </button>
                    <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                    <select className="form-select" style={{ width: 'auto' }} value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
                        <option value="">Semua Tipe</option>
                        <option value="siswa">Siswa</option>
                        <option value="guru">Guru</option>
                        <option value="staff">Staff</option>
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
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedIds.size} anggota dipilih</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedIds(new Set())}>Batal</button>
                        <button className="btn btn-danger btn-sm" onClick={handleBulkDelete} disabled={bulkDeleting}>
                            <Trash2 size={13} /> {bulkDeleting ? 'Menghapus...' : 'Hapus Terpilih'}
                        </button>
                    </div>
                </div>
            )}

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: 36 }}>
                                <input type="checkbox" checked={members.length > 0 && selectedIds.size === members.length} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                            </th>
                            <th>ID ANGGOTA</th>
                            <th>NAMA</th>
                            <th>TIPE</th>
                            <th>KELAS / JABATAN</th>
                            <th>PINJAMAN AKTIF</th>
                            <th>STATUS</th>
                            <th>BERGABUNG</th>
                            <th>AKSI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={10}><div className="loading-overlay"><div className="spinner"></div></div></td></tr>
                        ) : members.length === 0 ? (
                            <tr><td colSpan={10}>
                                <div className="empty-state">
                                    <Users size={40} />
                                    <h3>Belum ada anggota</h3>
                                    <p>Tambahkan anggota perpustakaan</p>
                                </div>
                            </td></tr>
                        ) : members.map((m, i) => (
                            <tr key={m.id} style={{ background: selectedIds.has(m.id) ? 'rgba(79,110,247,0.06)' : undefined }}>
                                <td>
                                    <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleSelect(m.id)} style={{ cursor: 'pointer' }} />
                                </td>
                                <td style={{ fontFamily: 'monospace', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{m.member_id}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {m.photo ? (
                                            <img src={`/uploads/members/${m.photo}`} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                        ) : (
                                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                                {m.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13.5 }}>{m.name}</div>
                                            {m.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.email}</div>}
                                        </div>
                                    </div>
                                </td>
                                <td>{typeBadge(m.type)}</td>
                                <td style={{ fontSize: 13 }}>
                                    {m.class ? `${m.class}` : '-'}
                                    {m.major && m.type === 'siswa' ? <span> · {m.major}</span> : null}
                                </td>
                                <td>
                                    {m.active_loans > 0 ? (
                                        <span className="badge badge-blue">{m.active_loans} buku</span>
                                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>-</span>}
                                </td>
                                <td>
                                    <span className={`badge ${m.status === 'aktif' ? 'badge-green' : 'badge-gray'}`}>
                                        {m.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                                    </span>
                                </td>
                                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    {new Date(m.joined_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn-icon btn" title="Riwayat Pinjaman" onClick={() => setHistoryMember(m)} style={{ color: '#3FB950' }}><BookMarked size={13} /></button>
                                        <button className="btn-icon btn" title="ID Card" onClick={() => setIdCardMember(m)} style={{ color: '#6D28D9' }}><CreditCard size={13} /></button>
                                        <button className="btn-icon btn" title="Edit" onClick={() => openEdit(m)}><Edit size={13} /></button>
                                        <button className="btn-icon btn" title="Hapus" onClick={() => setDeleteConfirm(m)} style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {totalPages > 1 && (
                    <div className="pagination">
                        <span>Menampilkan {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} dari {total} anggota</span>
                        <div className="pagination-buttons">
                            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</button>
                            <span style={{ padding: '5px 10px', fontSize: 13, color: 'var(--text-muted)' }}>{page}/{totalPages}</span>
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
                            <h2>{isEditing ? 'Edit Anggota' : 'Tambah Anggota Baru'}</h2>
                            <button className="btn-icon btn" onClick={() => setModalOpen(false)}><X size={16} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Tipe Anggota *</label>
                                    <select className="form-select" value={editMember.type || 'siswa'} onChange={e => setEditMember({ ...editMember, type: e.target.value })}>
                                        <option value="siswa">Siswa</option>
                                        <option value="guru">Guru</option>
                                        <option value="staff">Staff</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">ID Anggota *</label>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <input className="form-input" value={editMember.member_id || ''} onChange={e => setEditMember({ ...editMember, member_id: e.target.value })} placeholder="SIS10001" style={{ flex: 1 }} />
                                        <button className="btn btn-secondary btn-sm" onClick={autoGenerateId} title="Generate otomatis" style={{ flexShrink: 0 }}>Auto</button>
                                    </div>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Nama Lengkap *</label>
                                <input className="form-input" value={editMember.name || ''} onChange={e => setEditMember({ ...editMember, name: e.target.value })} placeholder="Masukkan nama lengkap" />
                            </div>
                            {editMember.type === 'siswa' && (
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Kelas</label>
                                        <select className="form-select" value={editMember.class || ''} onChange={e => setEditMember({ ...editMember, class: e.target.value })}>
                                            <option value="">-- Pilih Kelas --</option>
                                            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Jurusan</label>
                                        <select className="form-select" value={editMember.major || 'IPA'} onChange={e => setEditMember({ ...editMember, major: e.target.value })}>
                                            <option value="IPA">IPA</option>
                                            <option value="IPS">IPS</option>
                                            <option value="Bahasa">Bahasa</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">No. HP</label>
                                    <input className="form-input" value={editMember.phone || ''} onChange={e => setEditMember({ ...editMember, phone: e.target.value })} placeholder="08xxxxxxxxxx" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input className="form-input" type="email" value={editMember.email || ''} onChange={e => setEditMember({ ...editMember, email: e.target.value })} placeholder="email@example.com" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Alamat</label>
                                <textarea className="form-textarea" style={{ minHeight: 60 }} value={editMember.address || ''} onChange={e => setEditMember({ ...editMember, address: e.target.value })} placeholder="Alamat lengkap..." />
                            </div>
                            {/* Photo Upload */}
                            {isEditing && editMember.id && (
                                <div className="form-group">
                                    <label className="form-label">Foto Profil</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        {editMember.photo ? (
                                            <img src={`/uploads/members/${editMember.photo}`} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>
                                                {editMember.name?.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={async e => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const fd = new FormData();
                                            fd.append('file', file);
                                            fd.append('member_id', String(editMember.id));
                                            const res = await fetch('/api/upload/member-photo', { method: 'POST', body: fd });
                                            const data = await res.json();
                                            if (res.ok) {
                                                setEditMember(prev => ({ ...prev, photo: data.photo }));
                                                addToast('Foto berhasil diupload');
                                                fetchMembers();
                                            } else { addToast(data.error || 'Gagal upload foto', 'error'); }
                                        }} />
                                        <button className="btn btn-secondary btn-sm" onClick={() => photoInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Camera size={13} /> Upload Foto
                                        </button>
                                        {editMember.photo && (
                                            <button className="btn btn-secondary btn-sm" onClick={async () => {
                                                await fetch(`/api/upload/member-photo?member_id=${editMember.id}`, { method: 'DELETE' });
                                                setEditMember(prev => ({ ...prev, photo: undefined }));
                                                addToast('Foto dihapus');
                                                fetchMembers();
                                            }} style={{ color: 'var(--danger)' }}>Hapus</button>
                                        )}
                                    </div>
                                </div>
                            )}
                            {isEditing && (
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-select" value={editMember.status || 'aktif'} onChange={e => setEditMember({ ...editMember, status: e.target.value })}>
                                        <option value="aktif">Aktif</option>
                                        <option value="nonaktif">Non-aktif</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Menyimpan...' : (isEditing ? 'Simpan Perubahan' : 'Tambah Anggota')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {deleteConfirm && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
                    <div className="modal" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h2>Hapus Anggota</h2>
                            <button className="btn-icon btn" onClick={() => setDeleteConfirm(null)}><X size={16} /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                                Hapus anggota <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm.name}</strong>?
                                Pastikan tidak ada pinjaman aktif sebelum menghapus.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Batal</button>
                            <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Hapus</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ID Card Modal */}
            {idCardMember && (
                <IdCardModal member={idCardMember} school={school} onClose={() => setIdCardMember(null)} />
            )}

            {/* Member Loan History Modal */}
            {historyMember && (
                <MemberHistoryModal
                    member={historyMember}
                    onClose={() => setHistoryMember(null)}
                />
            )}

            {/* Import Modal */}
            {importModal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setImportModal(false); }}>
                    <div className="modal" style={{ maxWidth: 520 }}>
                        <div className="modal-header">
                            <h2><FileSpreadsheet size={18} /> Import Anggota dari Excel</h2>
                            <button className="btn-icon btn" onClick={() => setImportModal(false)}><X size={16} /></button>
                        </div>
                        <div className="modal-body">
                            <div style={{ background: 'rgba(79,110,247,0.06)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                                    Download template Excel, isi data anggota, lalu upload kembali.
                                </p>
                                <a href="/api/import/members" download style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    marginTop: 8, fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none',
                                }}><Download size={14} /> Download Template</a>
                            </div>
                            <div style={{
                                border: '2px dashed var(--border-color)', borderRadius: 10,
                                padding: 20, textAlign: 'center', cursor: 'pointer',
                                background: importFile ? 'rgba(79,110,247,0.04)' : undefined,
                            }} onClick={() => fileInputRef.current?.click()}>
                                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={e => {
                                    setImportFile(e.target.files?.[0] || null); setImportResult(null);
                                }} />
                                {importFile ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                                        <FileSpreadsheet size={18} color="var(--accent)" />
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>{importFile.name}</span>
                                        <button className="btn-icon btn" onClick={e => { e.stopPropagation(); setImportFile(null); }}><X size={14} /></button>
                                    </div>
                                ) : (
                                    <>
                                        <Upload size={24} style={{ color: 'var(--text-muted)', marginBottom: 6 }} />
                                        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Klik untuk memilih file Excel</p>
                                    </>
                                )}
                            </div>
                            {importResult && (
                                <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: importResult.imported > 0 ? 'rgba(63,185,80,0.08)' : 'rgba(248,81,73,0.08)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                        {importResult.imported > 0
                                            ? <><CheckCircle2 size={15} color="#3FB950" /><span style={{ fontWeight: 600, fontSize: 13 }}>{importResult.imported} anggota diimpor</span></>
                                            : <><AlertCircle size={15} color="#F85149" /><span style={{ fontWeight: 600, fontSize: 13 }}>Tidak ada data diimpor</span></>}
                                        {importResult.skipped > 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({importResult.skipped} dilewati)</span>}
                                    </div>
                                    {importResult.errors.length > 0 && (
                                        <div style={{ maxHeight: 120, overflowY: 'auto', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                                            {importResult.errors.map((e, i) => <div key={i}>• {e}</div>)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setImportModal(false)}>Tutup</button>
                            <button className="btn btn-primary" onClick={async () => {
                                if (!importFile) return;
                                setImporting(true); setImportResult(null);
                                const fd = new FormData(); fd.append('file', importFile);
                                const res = await fetch('/api/import/members', { method: 'POST', body: fd });
                                const data = await res.json();
                                setImporting(false);
                                if (res.ok) { setImportResult(data); if (data.imported > 0) fetchMembers(); }
                                else setImportResult({ imported: 0, skipped: 0, errors: [data.error] });
                            }} disabled={!importFile || importing}>
                                {importing ? 'Mengimpor...' : 'Import'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
