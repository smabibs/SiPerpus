'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    ClipboardList, Search, Filter, ChevronLeft, ChevronRight,
    Plus, Pencil, Trash2, RotateCcw, Settings as SettingsIcon,
    BookOpen, Users, BookMarked, Tag, Layers,
} from 'lucide-react';

interface AuditLog {
    id: number;
    action: string;
    entity_type: string;
    entity_id: string;
    entity_name: string;
    details: string | null;
    created_at: string;
}

const actionIcons: Record<string, { icon: typeof Plus; color: string; bg: string }> = {
    'CREATE': { icon: Plus, color: '#3FB950', bg: 'rgba(63,185,80,0.12)' },
    'UPDATE': { icon: Pencil, color: '#388BFD', bg: 'rgba(56,139,253,0.12)' },
    'DELETE': { icon: Trash2, color: '#F85149', bg: 'rgba(248,81,73,0.12)' },
    'RETURN': { icon: RotateCcw, color: '#D29922', bg: 'rgba(210,153,34,0.12)' },
    'SETTING': { icon: SettingsIcon, color: '#8B949E', bg: 'rgba(139,148,158,0.12)' },
    'BACKUP': { icon: Layers, color: '#A371F7', bg: 'rgba(163,113,247,0.12)' },
    'RESTORE': { icon: Layers, color: '#F47067', bg: 'rgba(244,112,103,0.12)' },
    'BULK_DELETE': { icon: Trash2, color: '#F85149', bg: 'rgba(248,81,73,0.12)' },
    'BULK_RETURN': { icon: RotateCcw, color: '#D29922', bg: 'rgba(210,153,34,0.12)' },
};

const entityColors: Record<string, { color: string; bg: string; icon: typeof BookOpen }> = {
    'book': { color: '#4F6EF7', bg: 'rgba(79,110,247,0.12)', icon: BookOpen },
    'member': { color: '#3FB950', bg: 'rgba(63,185,80,0.12)', icon: Users },
    'loan': { color: '#D29922', bg: 'rgba(210,153,34,0.12)', icon: BookMarked },
    'subject': { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', icon: Tag },
    'category': { color: '#EC4899', bg: 'rgba(236,72,153,0.12)', icon: Layers },
    'setting': { color: '#6E7681', bg: 'rgba(110,118,129,0.12)', icon: SettingsIcon },
    'system': { color: '#A371F7', bg: 'rgba(163,113,247,0.12)', icon: Layers },
};

function formatDate(d: string) {
    const date = new Date(d);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function relativeTime(d: string) {
    const now = new Date();
    const then = new Date(d);
    const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
    if (diff < 60) return 'Baru saja';
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
    return formatDate(d);
}

export default function AuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [entityFilter, setEntityFilter] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 30;

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (search) params.set('search', search);
        if (entityFilter) params.set('entity_type', entityFilter);
        const res = await fetch(`/api/audit?${params}`);
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setLoading(false);
    }, [page, search, entityFilter]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const totalPages = Math.ceil(total / limit);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Audit Log</h1>
                    <p>Riwayat semua aktivitas sistem ({total} entri)</p>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Cari aktivitas..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="form-input"
                            style={{ paddingLeft: 32, height: 36, fontSize: 13 }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Filter size={13} color="var(--text-muted)" />
                        <select
                            value={entityFilter}
                            onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
                            className="form-input"
                            style={{ height: 36, fontSize: 13, minWidth: 140 }}
                        >
                            <option value="">Semua Tipe</option>
                            <option value="book">Buku</option>
                            <option value="member">Anggota</option>
                            <option value="loan">Peminjaman</option>
                            <option value="subject">Mata Pelajaran</option>
                            <option value="category">Kategori</option>
                            <option value="setting">Pengaturan</option>
                            <option value="system">Sistem</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Log list */}
            <div className="card" style={{ padding: 0 }}>
                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                        <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, margin: '0 auto' }} />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="empty-state" style={{ padding: 40 }}>
                        <ClipboardList size={40} />
                        <h3>Belum ada log</h3>
                        <p>Aktivitas akan tercatat otomatis di sini</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {logs.map((log) => {
                            const act = actionIcons[log.action] || actionIcons['UPDATE'];
                            const ent = entityColors[log.entity_type] || entityColors['system'];
                            const ActionIcon = act.icon;
                            const EntityIcon = ent.icon;
                            return (
                                <div key={log.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '12px 16px',
                                    borderBottom: '1px solid var(--border-color)',
                                    transition: 'background 0.1s',
                                }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    {/* Action Icon */}
                                    <div style={{
                                        width: 34, height: 34, borderRadius: 8,
                                        background: act.bg, display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}>
                                        <ActionIcon size={15} color={act.color} />
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                            <span style={{
                                                fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                                                color: act.color, letterSpacing: 0.5,
                                            }}>
                                                {log.action.replace('_', ' ')}
                                            </span>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                fontSize: 10.5, padding: '1px 6px', borderRadius: 4,
                                                background: ent.bg, color: ent.color, fontWeight: 500,
                                            }}>
                                                <EntityIcon size={10} />
                                                {log.entity_type}
                                            </span>
                                        </div>
                                        <div style={{
                                            fontSize: 13.5, fontWeight: 500,
                                            color: 'var(--text-primary)',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        }}>
                                            {log.entity_name}
                                        </div>
                                        {log.details && (
                                            <div style={{
                                                fontSize: 12, color: 'var(--text-muted)', marginTop: 2,
                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                            }}>
                                                {log.details}
                                            </div>
                                        )}
                                    </div>

                                    {/* Time */}
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                                            {relativeTime(log.created_at)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 16px', borderTop: '1px solid var(--border-color)',
                        fontSize: 13, color: 'var(--text-muted)',
                    }}>
                        <div>Halaman {page} dari {totalPages}</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="btn btn-secondary"
                                style={{ padding: '5px 10px', fontSize: 12 }}
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="btn btn-secondary"
                                style={{ padding: '5px 10px', fontSize: 12 }}
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
