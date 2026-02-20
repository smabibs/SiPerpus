'use client';

import { useEffect, useState } from 'react';
import { GraduationCap, BookOpen, ChevronRight, X } from 'lucide-react';

interface Subject {
    id: number;
    name: string;
    color: string;
    description?: string;
    book_count: number;
}

interface Book {
    id: number;
    title: string;
    author?: string;
    isbn?: string;
    publisher?: string;
    year?: number;
    total_copies: number;
    available_copies: number;
    shelf_location?: string;
    subject_color?: string;
}

export default function SubjectsPage() {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [selected, setSelected] = useState<Subject | null>(null);
    const [books, setBooks] = useState<Book[]>([]);
    const [booksLoading, setBooksLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;

    useEffect(() => {
        fetch('/api/subjects')
            .then(r => r.json())
            .then(d => setSubjects(d.subjects || []));
    }, []);

    const loadBooks = async (subject: Subject, p = 1) => {
        setBooksLoading(true);
        const res = await fetch(`/api/books?subject_id=${subject.id}&limit=${limit}&page=${p}`);
        const data = await res.json();
        setBooks(data.books || []);
        setTotal(data.total || 0);
        setBooksLoading(false);
    };

    const selectSubject = (s: Subject) => {
        setSelected(s);
        setPage(1);
        loadBooks(s, 1);
    };

    const changePage = (newPage: number) => {
        setPage(newPage);
        if (selected) loadBooks(selected, newPage);
    };

    const totalPages = Math.ceil(total / limit);
    const totalAllBooks = subjects.reduce((sum, s) => sum + s.book_count, 0);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Koleksi Mata Pelajaran</h1>
                    <p>Jelajahi {subjects.length} mata pelajaran dengan total {totalAllBooks} judul buku</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '320px 1fr' : '1fr', gap: 20, alignItems: 'start' }}>
                {/* Subject grid */}
                <div>
                    <div className="subject-grid" style={{ gridTemplateColumns: selected ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                        {subjects.map(s => (
                            <div
                                key={s.id}
                                className={`subject-card ${selected?.id === s.id ? 'selected' : ''}`}
                                onClick={() => selected?.id === s.id ? setSelected(null) : selectSubject(s)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 12,
                                        background: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <GraduationCap size={20} color={s.color} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.book_count} judul buku</div>
                                    </div>
                                    <ChevronRight size={16} color="var(--text-muted)" style={{ transform: selected?.id === s.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                </div>

                                {/* Color bar */}
                                <div style={{
                                    height: 3, borderRadius: 2, marginTop: 14,
                                    background: `linear-gradient(to right, ${s.color}, ${s.color}44)`,
                                    width: `${Math.min(100, (s.book_count / Math.max(...subjects.map(x => x.book_count), 1)) * 100)}%`,
                                    minWidth: s.book_count > 0 ? 8 : 0,
                                }} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Book list for selected subject */}
                {selected && (
                    <div>
                        <div className="card" style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${selected.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <GraduationCap size={20} color={selected.color} />
                                    </div>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{selected.name}</h2>
                                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{total} judul buku tersedia</p>
                                    </div>
                                </div>
                                <button className="btn-icon btn" onClick={() => setSelected(null)}><X size={16} /></button>
                            </div>
                        </div>

                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>JUDUL BUKU</th>
                                        <th>ISBN</th>
                                        <th>PENGARANG</th>
                                        <th>PENERBIT</th>
                                        <th>STOK</th>
                                        <th>RAK</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {booksLoading ? (
                                        <tr><td colSpan={7}><div className="loading-overlay"><div className="spinner"></div></div></td></tr>
                                    ) : books.length === 0 ? (
                                        <tr><td colSpan={7}>
                                            <div className="empty-state">
                                                <BookOpen size={36} />
                                                <h3>Belum ada buku</h3>
                                                <p>Belum ada buku untuk mata pelajaran ini</p>
                                            </div>
                                        </td></tr>
                                    ) : books.map((book, i) => (
                                        <tr key={book.id}>
                                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(page - 1) * limit + i + 1}</td>
                                            <td>
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{book.title}</div>
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{book.isbn || '-'}</td>
                                            <td style={{ fontSize: 13 }}>{book.author || '-'}</td>
                                            <td style={{ fontSize: 13 }}>{book.publisher || '-'}{book.year ? ` (${book.year})` : ''}</td>
                                            <td>
                                                {book.available_copies === 0
                                                    ? <span className="badge badge-red">Habis</span>
                                                    : <span className="badge badge-green">{book.available_copies}/{book.total_copies}</span>}
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{book.shelf_location || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {totalPages > 1 && (
                                <div className="pagination">
                                    <span>Menampilkan {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} dari {total} buku</span>
                                    <div className="pagination-buttons">
                                        <button className="btn btn-secondary btn-sm" onClick={() => changePage(Math.max(1, page - 1))} disabled={page === 1}>‹ Prev</button>
                                        <span style={{ padding: '5px 10px', fontSize: 13, color: 'var(--text-muted)' }}>{page}/{totalPages}</span>
                                        <button className="btn btn-secondary btn-sm" onClick={() => changePage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Next ›</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
