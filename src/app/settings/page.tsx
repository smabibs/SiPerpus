'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
    School, BookOpen, Users, Settings, Save, Plus, Trash2,
    X, Upload, RotateCcw, ChevronRight, BookMarked, Tag, Edit, Check,
    Download, Database, AlertTriangle,
} from 'lucide-react';

interface AppSettings {
    school_name: string;
    school_address: string;
    school_city: string;
    school_phone: string;
    school_email: string;
    school_website: string;
    school_npsn: string;
    school_logo: string;
    library_head: string;
    loan_duration_days: string;
    fine_per_day: string;
    max_loan_books: string;
    classes: string;
    majors: string;
    grades: string;
}

type Tab = 'identity' | 'classes' | 'loan_rules' | 'subjects' | 'categories' | 'tags' | 'backup';

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

const TABS = [
    { id: 'identity' as Tab, label: 'Identitas Sekolah', icon: School },
    { id: 'classes' as Tab, label: 'Kelas & Jurusan', icon: Users },
    { id: 'loan_rules' as Tab, label: 'Aturan Peminjaman', icon: BookOpen },
    { id: 'subjects' as Tab, label: 'Mata Pelajaran', icon: BookMarked },
    { id: 'categories' as Tab, label: 'Kategori Buku', icon: Tag },
    { id: 'tags' as Tab, label: 'Tag Buku', icon: Tag },
    { id: 'backup' as Tab, label: 'Backup & Restore', icon: Database },
];

export default function SettingsPage() {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('identity');
    const [saving, setSaving] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [loading, setLoading] = useState(true);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const restoreInputRef = useRef<HTMLInputElement>(null);
    const [backupLoading, setBackupLoading] = useState(false);
    const [restoreLoading, setRestoreLoading] = useState(false);

    // Subjects
    interface SubjectItem { id: number; name: string; color: string; description?: string; book_count: number; }
    interface CategoryItem { id: number; name: string; description?: string; book_count: number; }
    const [subjects, setSubjects] = useState<SubjectItem[]>([]);
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [newSubjectName, setNewSubjectName] = useState('');
    const [newSubjectColor, setNewSubjectColor] = useState('#4F46E5');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
    const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);

    // Tags
    interface TagItem { id: number; name: string; color: string; }
    const [tags, setTags] = useState<TagItem[]>([]);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#6366F1');
    const [editingTag, setEditingTag] = useState<TagItem | null>(null);

    // Derived editable state from settings
    const [classes, setClasses] = useState<string[]>([]);
    const [majors, setMajors] = useState<string[]>([]);
    const [grades, setGrades] = useState<string[]>([]);
    const [newClass, setNewClass] = useState('');
    const [newMajor, setNewMajor] = useState('');
    const [newGrade, setNewGrade] = useState('');

    const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const fetchSubjects = useCallback(() =>
        fetch('/api/subjects').then(r => r.json()).then(d => setSubjects(d.subjects || [])), []);
    const fetchCategories = useCallback(() =>
        fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories || [])), []);
    const fetchTags = useCallback(() =>
        fetch('/api/tags').then(r => r.json()).then(d => setTags(d.tags || [])), []);

    useEffect(() => {
        fetch('/api/settings')
            .then(r => r.json())
            .then((data: AppSettings) => {
                setSettings(data);
                setClasses(safeParseArray(data.classes));
                setMajors(safeParseArray(data.majors));
                setGrades(safeParseArray(data.grades));
                setLoading(false);
            });
        fetchSubjects();
        fetchCategories();
        fetchTags();
    }, [fetchSubjects, fetchCategories, fetchTags]);

    function safeParseArray(v: string): string[] {
        try { return JSON.parse(v) as string[]; } catch { return []; }
    }

    const updateSetting = (key: keyof AppSettings, value: string) => {
        setSettings(prev => prev ? { ...prev, [key]: value } : prev);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 500 * 1024) { addToast('Ukuran logo maksimal 500 KB', 'error'); return; }
        const reader = new FileReader();
        reader.onload = ev => {
            const base64 = ev.target?.result as string;
            updateSetting('school_logo', base64);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        const payload: Record<string, string> = {
            ...settings,
            classes: JSON.stringify(classes),
            majors: JSON.stringify(majors),
            grades: JSON.stringify(grades),
        };
        const res = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        setSaving(false);
        if (res.ok) {
            addToast('Pengaturan berhasil disimpan');
        } else {
            addToast('Gagal menyimpan pengaturan', 'error');
        }
    };

    const addItem = (list: string[], setList: (l: string[]) => void, val: string, setVal: (v: string) => void) => {
        const trimmed = val.trim();
        if (!trimmed || list.includes(trimmed)) { setVal(''); return; }
        setList([...list, trimmed]);
        setVal('');
    };

    const removeItem = (list: string[], setList: (l: string[]) => void, idx: number) => {
        setList(list.filter((_, i) => i !== idx));
    };

    // ── Subject handlers ──────────────────────────────────────────────────
    const handleAddSubject = async () => {
        const name = newSubjectName.trim();
        if (!name) return;
        const res = await fetch('/api/subjects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color: newSubjectColor }) });
        if (res.ok) { setNewSubjectName(''); fetchSubjects(); addToast('Mata pelajaran ditambahkan'); }
        else { const d = await res.json(); addToast(d.error || 'Gagal', 'error'); }
    };
    const handleSaveSubject = async () => {
        if (!editingSubject) return;
        const res = await fetch('/api/subjects', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingSubject) });
        if (res.ok) { setEditingSubject(null); fetchSubjects(); addToast('Mata pelajaran diperbarui'); }
        else { const d = await res.json(); addToast(d.error || 'Gagal', 'error'); }
    };
    const handleDeleteSubject = async (id: number) => {
        if (!confirm('Hapus mata pelajaran ini?')) return;
        const res = await fetch(`/api/subjects?id=${id}`, { method: 'DELETE' });
        if (res.ok) { fetchSubjects(); addToast('Mata pelajaran dihapus'); }
        else { const d = await res.json(); addToast(d.error, 'error'); }
    };

    // ── Category handlers ─────────────────────────────────────────────────
    const handleAddCategory = async () => {
        const name = newCategoryName.trim();
        if (!name) return;
        const res = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        if (res.ok) { setNewCategoryName(''); fetchCategories(); addToast('Kategori ditambahkan'); }
        else { const d = await res.json(); addToast(d.error || 'Gagal', 'error'); }
    };
    const handleSaveCategory = async () => {
        if (!editingCategory) return;
        const res = await fetch('/api/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingCategory) });
        if (res.ok) { setEditingCategory(null); fetchCategories(); addToast('Kategori diperbarui'); }
        else { const d = await res.json(); addToast(d.error || 'Gagal', 'error'); }
    };
    const handleDeleteCategory = async (id: number) => {
        if (!confirm('Hapus kategori ini?')) return;
        const res = await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
        if (res.ok) { fetchCategories(); addToast('Kategori dihapus'); }
        else { const d = await res.json(); addToast(d.error, 'error'); }
    };

    // ── Tag handlers ──────────────────────────────────────────────────────
    const handleAddTag = async () => {
        const name = newTagName.trim();
        if (!name) return;
        const res = await fetch('/api/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color: newTagColor }) });
        if (res.ok) { setNewTagName(''); fetchTags(); addToast('Tag ditambahkan'); }
        else { const d = await res.json(); addToast(d.error || 'Gagal', 'error'); }
    };
    const handleSaveTag = async () => {
        if (!editingTag) return;
        const res = await fetch('/api/tags', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingTag) });
        if (res.ok) { setEditingTag(null); fetchTags(); addToast('Tag diperbarui'); }
        else { const d = await res.json(); addToast(d.error || 'Gagal', 'error'); }
    };
    const handleDeleteTag = async (id: number) => {
        if (!confirm('Hapus tag ini?')) return;
        const res = await fetch(`/api/tags?id=${id}`, { method: 'DELETE' });
        if (res.ok) { fetchTags(); addToast('Tag dihapus'); }
        else { const d = await res.json(); addToast(d.error, 'error'); }
    };

    if (loading) return <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></div></div>;

    return (
        <div>
            <ToastContainer toasts={toasts} onRemove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
            <div className="page-header">
                <div>
                    <h1>Pengaturan</h1>
                    <p>Konfigurasi sistem perpustakaan sekolah</p>
                </div>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    <Save size={15} /> {saving ? 'Menyimpan...' : 'Simpan Semua'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>
                {/* Tab list */}
                <div className="card" style={{ padding: '8px 0' }}>
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 16px', background: isActive ? 'rgba(79,110,247,0.12)' : 'none',
                                    border: 'none', cursor: 'pointer',
                                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                    fontWeight: isActive ? 600 : 400, fontSize: 13.5,
                                    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                                    transition: 'all 0.15s',
                                    textAlign: 'left',
                                }}
                            >
                                <Icon size={15} />
                                <span style={{ flex: 1 }}>{tab.label}</span>
                                {isActive && <ChevronRight size={14} />}
                            </button>
                        );
                    })}
                    <div style={{ borderTop: '1px solid var(--border-color)', margin: '8px 0' }} />
                    <button
                        onClick={() => { setActiveTab('identity'); }}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', fontSize: 13, textAlign: 'left',
                        }}
                    >
                        <Settings size={14} />
                        <span>v1.0.0</span>
                    </button>
                </div>

                {/* Tab content */}
                <div>
                    {activeTab === 'identity' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Logo */}
                            <div className="card">
                                <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Logo Sekolah
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                    <div style={{
                                        width: 96, height: 96, borderRadius: 12,
                                        background: 'var(--bg-tertiary)',
                                        border: '2px dashed var(--border-color)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        overflow: 'hidden', flexShrink: 0,
                                    }}>
                                        {settings?.school_logo ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={settings.school_logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            <School size={36} color="var(--text-muted)" />
                                        )}
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                                            Upload logo sekolah. Format: PNG, JPG, SVG. Maks: 500 KB.
                                        </p>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => logoInputRef.current?.click()}>
                                                <Upload size={13} /> Pilih File
                                            </button>
                                            {settings?.school_logo && (
                                                <button className="btn btn-secondary btn-sm" onClick={() => updateSetting('school_logo', '')} style={{ color: 'var(--danger)' }}>
                                                    <RotateCcw size={13} /> Hapus Logo
                                                </button>
                                            )}
                                        </div>
                                        <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                                    </div>
                                </div>
                            </div>

                            {/* School identity */}
                            <div className="card">
                                <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Identitas Sekolah
                                </h3>
                                <div className="form-group">
                                    <label className="form-label">Nama Sekolah</label>
                                    <input className="form-input" value={settings?.school_name || ''} onChange={e => updateSetting('school_name', e.target.value)} placeholder="SMA Negeri 1 ..." />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">NPSN</label>
                                    <input className="form-input" value={settings?.school_npsn || ''} onChange={e => updateSetting('school_npsn', e.target.value)} placeholder="12345678" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Alamat</label>
                                    <textarea className="form-textarea" style={{ minHeight: 60 }} value={settings?.school_address || ''} onChange={e => updateSetting('school_address', e.target.value)} placeholder="Jl. Pendidikan No. 1..." />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Kota / Kabupaten</label>
                                        <input className="form-input" value={settings?.school_city || ''} onChange={e => updateSetting('school_city', e.target.value)} placeholder="Jakarta" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">No. Telepon</label>
                                        <input className="form-input" value={settings?.school_phone || ''} onChange={e => updateSetting('school_phone', e.target.value)} placeholder="021-..." />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input className="form-input" type="email" value={settings?.school_email || ''} onChange={e => updateSetting('school_email', e.target.value)} placeholder="sekolah@email.com" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Website</label>
                                        <input className="form-input" value={settings?.school_website || ''} onChange={e => updateSetting('school_website', e.target.value)} placeholder="https://..." />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Kepala Perpustakaan</label>
                                    <input className="form-input" value={settings?.library_head || ''} onChange={e => updateSetting('library_head', e.target.value)} placeholder="Nama kepala perpustakaan" />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'classes' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Grades */}
                            <div className="card">
                                <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>Tingkat / Grade</h3>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Tingkat kelas (contoh: X, XI, XII)</p>
                                <ListEditor
                                    items={grades}
                                    newVal={newGrade}
                                    setNewVal={setNewGrade}
                                    onAdd={() => addItem(grades, setGrades, newGrade, setNewGrade)}
                                    onRemove={i => removeItem(grades, setGrades, i)}
                                    placeholder="Contoh: X"
                                    badgeColor="#4F6EF7"
                                />
                            </div>

                            {/* Majors */}
                            <div className="card">
                                <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>Jurusan / Program Studi</h3>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Jurusan yang tersedia di sekolah</p>
                                <ListEditor
                                    items={majors}
                                    newVal={newMajor}
                                    setNewVal={setNewMajor}
                                    onAdd={() => addItem(majors, setMajors, newMajor, setNewMajor)}
                                    onRemove={i => removeItem(majors, setMajors, i)}
                                    placeholder="Contoh: IPA"
                                    badgeColor="#22C55E"
                                />
                            </div>

                            {/* Classes */}
                            <div className="card">
                                <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>Daftar Kelas</h3>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Semua kelas yang digunakan saat menambah anggota siswa</p>
                                <ListEditor
                                    items={classes}
                                    newVal={newClass}
                                    setNewVal={setNewClass}
                                    onAdd={() => addItem(classes, setClasses, newClass, setNewClass)}
                                    onRemove={i => removeItem(classes, setClasses, i)}
                                    placeholder="Contoh: X-IPA-1"
                                    badgeColor="#8B5CF6"
                                    grid
                                />
                                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => {
                                        const generated: string[] = [];
                                        for (const g of grades) {
                                            for (const m of majors) {
                                                for (let n = 1; n <= 3; n++) {
                                                    const cls = `${g}-${m}-${n}`;
                                                    if (!classes.includes(cls)) generated.push(cls);
                                                }
                                            }
                                        }
                                        if (generated.length > 0) setClasses(prev => [...prev, ...generated]);
                                    }}>
                                        <Plus size={13} /> Generate dari Tingkat & Jurusan
                                    </button>
                                    <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => {
                                        if (confirm('Hapus semua kelas?')) setClasses([]);
                                    }}>
                                        <Trash2 size={13} /> Hapus Semua
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'loan_rules' && (
                        <div className="card">
                            <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>Aturan Peminjaman</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                                Pengaturan ini menjadi nilai default saat mencatat peminjaman baru
                            </p>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Durasi Pinjam Default (Hari)</label>
                                    <input className="form-input" type="number" min={1} max={60}
                                        value={settings?.loan_duration_days || '7'}
                                        onChange={e => updateSetting('loan_duration_days', e.target.value)} />
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                        Jumlah hari sebelum buku harus dikembalikan
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Denda per Hari (Rp)</label>
                                    <input className="form-input" type="number" min={0}
                                        value={settings?.fine_per_day || '1000'}
                                        onChange={e => updateSetting('fine_per_day', e.target.value)} />
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                        Denda per eksemplar per hari keterlambatan
                                    </div>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Maksimum Buku Dipinjam per Anggota</label>
                                <input className="form-input" type="number" min={1} max={20} style={{ maxWidth: 160 }}
                                    value={settings?.max_loan_books || '5'}
                                    onChange={e => updateSetting('max_loan_books', e.target.value)} />
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                    Batas maksimal judul buku yang boleh dipinjam bersamaan
                                </div>
                            </div>

                            <div style={{ background: 'rgba(79,110,247,0.07)', border: '1px solid rgba(79,110,247,0.2)', borderRadius: 10, padding: '12px 14px', marginTop: 8 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Ringkasan Aturan Saat Ini</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                    • Durasi pinjam: <strong>{settings?.loan_duration_days || 7} hari</strong><br />
                                    • Denda keterlambatan: <strong>Rp {Number(settings?.fine_per_day || 1000).toLocaleString('id-ID')}/eksemplar/hari</strong><br />
                                    • Maks. buku dipinjam: <strong>{settings?.max_loan_books || 5} judul</strong>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Mata Pelajaran Tab ──────────────────────────────────────── */}
                    {activeTab === 'subjects' && (
                        <div className="card">
                            <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>Mata Pelajaran</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Kelola daftar mata pelajaran yang dapat dipilih saat menambah buku</p>

                            {/* Add new */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                                <input type="color" value={newSubjectColor} onChange={e => setNewSubjectColor(e.target.value)}
                                    style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'pointer', padding: 2, flexShrink: 0 }} />
                                <input className="form-input" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)}
                                    placeholder="Nama mata pelajaran baru..."
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddSubject(); }}
                                    style={{ flex: 1 }} />
                                <button className="btn btn-primary btn-sm" onClick={handleAddSubject} disabled={!newSubjectName.trim()}>
                                    <Plus size={13} /> Tambah
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {subjects.length === 0 && (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: 20 }}>Belum ada mata pelajaran</div>
                                )}
                                {subjects.map(s => (
                                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                                        {editingSubject?.id === s.id ? (
                                            <>
                                                <input type="color" value={editingSubject.color} onChange={e => setEditingSubject({ ...editingSubject, color: e.target.value })}
                                                    style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 1, flexShrink: 0 }} />
                                                <input className="form-input" value={editingSubject.name} onChange={e => setEditingSubject({ ...editingSubject, name: e.target.value })}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveSubject(); if (e.key === 'Escape') setEditingSubject(null); }}
                                                    style={{ flex: 1, padding: '4px 8px', height: 32 }} autoFocus />
                                                <button className="btn btn-primary btn-sm" onClick={handleSaveSubject}><Check size={12} /></button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => setEditingSubject(null)}><X size={12} /></button>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ width: 14, height: 14, borderRadius: 4, background: s.color, flexShrink: 0 }} />
                                                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{s.name}</span>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.book_count} buku</span>
                                                <button className="btn-icon btn" title="Edit" onClick={() => setEditingSubject({ ...s })} style={{ width: 28, height: 28 }}><Edit size={12} /></button>
                                                <button className="btn-icon btn" title="Hapus" onClick={() => handleDeleteSubject(s.id)} style={{ width: 28, height: 28, color: 'var(--danger)' }}><Trash2 size={12} /></button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Kategori Tab ──────────────────────────────────────────────── */}
                    {activeTab === 'categories' && (
                        <div className="card">
                            <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>Kategori Buku</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Kelola kategori buku perpustakaan (Buku Teks, Fiksi, dsb.)</p>

                            {/* Add new */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                <input className="form-input" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                                    placeholder="Nama kategori baru..."
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }}
                                    style={{ flex: 1 }} />
                                <button className="btn btn-primary btn-sm" onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
                                    <Plus size={13} /> Tambah
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {categories.length === 0 && (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: 20 }}>Belum ada kategori</div>
                                )}
                                {categories.map(c => (
                                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                                        {editingCategory?.id === c.id ? (
                                            <>
                                                <input className="form-input" value={editingCategory.name} onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveCategory(); if (e.key === 'Escape') setEditingCategory(null); }}
                                                    style={{ flex: 1, padding: '4px 8px', height: 32 }} autoFocus />
                                                <button className="btn btn-primary btn-sm" onClick={handleSaveCategory}><Check size={12} /></button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => setEditingCategory(null)}><X size={12} /></button>
                                            </>
                                        ) : (
                                            <>
                                                <Tag size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{c.name}</span>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.book_count} buku</span>
                                                <button className="btn-icon btn" title="Edit" onClick={() => setEditingCategory({ ...c })} style={{ width: 28, height: 28 }}><Edit size={12} /></button>
                                                <button className="btn-icon btn" title="Hapus" onClick={() => handleDeleteCategory(c.id)} style={{ width: 28, height: 28, color: 'var(--danger)' }}><Trash2 size={12} /></button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tags Tab */}
                    {activeTab === 'tags' && (
                        <div className="card">
                            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Tag Buku</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Tag memungkinkan klasifikasi buku secara fleksibel. Satu buku bisa memiliki banyak tag.</p>

                            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                                <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} style={{ width: 32, height: 32, padding: 0, border: 'none', borderRadius: 6, cursor: 'pointer' }} />
                                <input className="form-input" value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Nama tag baru" onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); }} style={{ maxWidth: 240 }} />
                                <button className="btn btn-primary btn-sm" onClick={handleAddTag}><Plus size={13} /> Tambah</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {tags.length === 0 && (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: 20 }}>Belum ada tag</div>
                                )}
                                {tags.map(tag => (
                                    <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                                        {editingTag?.id === tag.id ? (
                                            <>
                                                <input type="color" value={editingTag.color} onChange={e => setEditingTag({ ...editingTag, color: e.target.value })} style={{ width: 28, height: 28, padding: 0, border: 'none', cursor: 'pointer' }} />
                                                <input className="form-input" value={editingTag.name} onChange={e => setEditingTag({ ...editingTag, name: e.target.value })}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveTag(); if (e.key === 'Escape') setEditingTag(null); }}
                                                    style={{ flex: 1, padding: '4px 8px', height: 32 }} autoFocus />
                                                <button className="btn btn-primary btn-sm" onClick={handleSaveTag}><Check size={12} /></button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => setEditingTag(null)}><X size={12} /></button>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ width: 14, height: 14, borderRadius: '50%', background: tag.color, flexShrink: 0 }} />
                                                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{tag.name}</span>
                                                <button className="btn-icon btn" title="Edit" onClick={() => setEditingTag({ ...tag })} style={{ width: 28, height: 28 }}><Edit size={12} /></button>
                                                <button className="btn-icon btn" title="Hapus" onClick={() => handleDeleteTag(tag.id)} style={{ width: 28, height: 28, color: 'var(--danger)' }}><Trash2 size={12} /></button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Backup & Restore Tab */}
                    {activeTab === 'backup' && (
                        <div>
                            <div className="card" style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(79,110,247,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Download size={18} color="#4F6EF7" />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Backup Database</h3>
                                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Unduh file database sebagai backup</p>
                                    </div>
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                                    Simpan salinan database untuk keamanan data. File backup berformat <code>.db</code> dan mencakup semua data buku, anggota, peminjaman, dan pengaturan.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    disabled={backupLoading}
                                    onClick={async () => {
                                        setBackupLoading(true);
                                        try {
                                            const res = await fetch('/api/backup');
                                            if (!res.ok) throw new Error('Gagal membuat backup');
                                            const blob = await res.blob();
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || 'backup.db';
                                            a.click();
                                            URL.revokeObjectURL(url);
                                            setToasts(t => [...t, { id: Date.now(), type: 'success', message: 'Backup berhasil diunduh!' }]);
                                        } catch (err) {
                                            setToasts(t => [...t, { id: Date.now(), type: 'error', message: String(err) }]);
                                        }
                                        setBackupLoading(false);
                                    }}
                                >
                                    <Download size={15} /> {backupLoading ? 'Mengunduh...' : 'Download Backup'}
                                </button>
                            </div>

                            <div className="card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(248,81,73,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Upload size={18} color="#F85149" />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Restore Database</h3>
                                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Pulihkan database dari file backup</p>
                                    </div>
                                </div>
                                <div style={{
                                    background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)',
                                    borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                                    display: 'flex', gap: 10, alignItems: 'flex-start',
                                }}>
                                    <AlertTriangle size={16} color="#F85149" style={{ flexShrink: 0, marginTop: 2 }} />
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                        <strong>Peringatan:</strong> Restore akan menggantikan SELURUH data yang ada saat ini. Pastikan Anda sudah membuat backup terlebih dahulu.
                                    </div>
                                </div>
                                <input
                                    ref={restoreInputRef}
                                    type="file"
                                    accept=".db"
                                    style={{ display: 'none' }}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        if (!confirm('Anda yakin ingin me-restore database? Semua data saat ini akan diganti.')) {
                                            e.target.value = '';
                                            return;
                                        }
                                        setRestoreLoading(true);
                                        try {
                                            const formData = new FormData();
                                            formData.append('file', file);
                                            const res = await fetch('/api/backup', { method: 'POST', body: formData });
                                            const data = await res.json();
                                            if (!res.ok) throw new Error(data.error);
                                            setToasts(t => [...t, { id: Date.now(), type: 'success', message: 'Database berhasil di-restore! Halaman akan dimuat ulang...' }]);
                                            setTimeout(() => window.location.reload(), 1500);
                                        } catch (err) {
                                            setToasts(t => [...t, { id: Date.now(), type: 'error', message: String(err) }]);
                                        }
                                        setRestoreLoading(false);
                                        e.target.value = '';
                                    }}
                                />
                                <button
                                    className="btn" style={{ background: 'rgba(248,81,73,0.1)', color: '#F85149', border: '1px solid rgba(248,81,73,0.2)' }}
                                    disabled={restoreLoading}
                                    onClick={() => restoreInputRef.current?.click()}
                                >
                                    <Upload size={15} /> {restoreLoading ? 'Memulihkan...' : 'Upload & Restore'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Save button bottom */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            <Save size={15} /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}

// Reusable list editor component
function ListEditor({
    items, newVal, setNewVal, onAdd, onRemove, placeholder, badgeColor, grid
}: {
    items: string[];
    newVal: string;
    setNewVal: (v: string) => void;
    onAdd: () => void;
    onRemove: (i: number) => void;
    placeholder: string;
    badgeColor: string;
    grid?: boolean;
}) {
    return (
        <div>
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: items.length > 0 ? 12 : 0,
                ...(grid ? {} : {}),
            }}>
                {items.map((item, i) => (
                    <div key={i} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: `${badgeColor}18`, border: `1px solid ${badgeColor}44`,
                        borderRadius: 6, padding: '4px 10px', fontSize: 13,
                        color: badgeColor, fontWeight: 500,
                    }}>
                        {item}
                        <button onClick={() => onRemove(i)} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: badgeColor, padding: 0, display: 'flex', alignItems: 'center', opacity: 0.7,
                        }}>
                            <X size={12} />
                        </button>
                    </div>
                ))}
                {items.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Belum ada item. Tambahkan di bawah.</div>
                )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    className="form-input"
                    value={newVal}
                    onChange={e => setNewVal(e.target.value)}
                    placeholder={placeholder}
                    onKeyDown={e => { if (e.key === 'Enter') onAdd(); }}
                    style={{ maxWidth: 240 }}
                />
                <button className="btn btn-secondary btn-sm" onClick={onAdd}>
                    <Plus size={13} /> Tambah
                </button>
            </div>
        </div>
    );
}
