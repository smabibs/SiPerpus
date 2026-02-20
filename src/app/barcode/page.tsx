'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Printer, CheckSquare, Square, Barcode, X } from 'lucide-react';
import BarcodeGenerator from '@/components/BarcodeGenerator';

interface Book {
    id: number;
    isbn?: string;
    title: string;
    author?: string;
    subject_name?: string;
    shelf_location?: string;
    total_copies: number;
    available_copies: number;
}

export default function BarcodePage() {
    const [books, setBooks] = useState<Book[]>([]);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [copyCount, setCopyCount] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setMounted(true); }, []);

    const fetchBooks = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ search, limit: '50' });
        const res = await fetch(`/api/books?${params}`);
        const data = await res.json();
        setBooks(data.books || []);
        setLoading(false);
    }, [search]);

    useEffect(() => {
        fetchBooks();
    }, [fetchBooks]);

    const toggleSelect = (id: number) => {
        setSelected(prev => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    };

    const toggleAll = () => {
        if (selected.size === books.length) setSelected(new Set());
        else setSelected(new Set(books.map(b => b.id)));
    };

    const handlePrint = () => {
        window.print();
    };

    const getSelectedBooks = () => books.filter(b => selected.has(b.id));
    const getCopies = (id: number) => copyCount[id] ?? 1;

    // Label cards for print portal
    const PrintArea = () => (
        <div
            id="barcode-print-portal"
            ref={printRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                background: 'white',
                zIndex: -1,
                visibility: 'hidden',
                pointerEvents: 'none',
            }}
        >
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px',
                padding: '16px',
            }}>
                {getSelectedBooks().flatMap(book =>
                    Array.from({ length: getCopies(book.id) }).map((_, i) => (
                        <div
                            key={`${book.id}-${i}`}
                            style={{
                                background: 'white',
                                border: '1px solid #ccc',
                                borderRadius: 6,
                                padding: '8px 6px',
                                textAlign: 'center',
                                fontFamily: 'Arial, sans-serif',
                                pageBreakInside: 'avoid',
                                breakInside: 'avoid',
                            }}
                        >
                            <div style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#111',
                                marginBottom: 4,
                                lineHeight: 1.3,
                                wordBreak: 'break-word',
                            }}>
                                {book.title.length > 55 ? book.title.substring(0, 55) + '…' : book.title}
                            </div>
                            {book.isbn ? (
                                <>
                                    <BarcodeGenerator value={book.isbn} width={1.5} height={55} />
                                    <div style={{ fontSize: 9, color: '#555', marginTop: 2, fontFamily: 'monospace' }}>
                                        {book.isbn}
                                    </div>
                                </>
                            ) : (
                                <div style={{ padding: '12px 0', color: '#aaa', fontSize: 10 }}>No ISBN</div>
                            )}
                            {book.shelf_location && (
                                <div style={{ fontSize: 8, color: '#888', marginTop: 2 }}>Rak: {book.shelf_location}</div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <div>
            {/* Print CSS: visibility approach so child can override parent */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #barcode-print-portal {
                        visibility: visible !important;
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        z-index: 99999 !important;
                        background: white !important;
                    }
                    #barcode-print-portal * {
                        visibility: visible !important;
                    }
                }
            `}</style>

            <div className="page-header">
                <div>
                    <h1>Cetak Barcode</h1>
                    <p>Pilih buku dan cetak label barcode untuk ditempel pada buku</p>
                </div>
                {selected.size > 0 && (
                    <button className="btn btn-primary" onClick={handlePrint}>
                        <Printer size={16} /> Cetak {selected.size} Label
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
                {/* Book list */}
                <div>
                    <div className="toolbar">
                        <div className="search-bar" style={{ maxWidth: '100%', flex: 1 }}>
                            <Search size={15} />
                            <input className="form-input" placeholder="Cari judul, ISBN..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={toggleAll}>
                            {selected.size === books.length ? <CheckSquare size={14} /> : <Square size={14} />}
                            {selected.size === books.length ? ' Batal Semua' : ' Pilih Semua'}
                        </button>
                    </div>

                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 36 }}></th>
                                    <th>JUDUL BUKU</th>
                                    <th>ISBN</th>
                                    <th>MATA PELAJARAN</th>
                                    <th>JUMLAH LABEL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5}><div className="loading-overlay"><div className="spinner"></div></div></td></tr>
                                ) : books.map(book => (
                                    <tr key={book.id} onClick={() => toggleSelect(book.id)} style={{ cursor: 'pointer' }}>
                                        <td onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selected.has(book.id)}
                                                onChange={() => toggleSelect(book.id)}
                                                style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--accent)' }}
                                            />
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{book.title}</div>
                                            {book.author && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{book.author}</div>}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{book.isbn || <span style={{ color: 'var(--text-muted)' }}>No ISBN</span>}</td>
                                        <td>
                                            {book.subject_name ? (
                                                <span className="badge badge-blue">{book.subject_name}</span>
                                            ) : '-'}
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            {selected.has(book.id) && (
                                                <input
                                                    type="number"
                                                    min={1} max={20}
                                                    value={getCopies(book.id)}
                                                    onChange={e => setCopyCount(prev => ({ ...prev, [book.id]: parseInt(e.target.value) || 1 }))}
                                                    className="form-input"
                                                    style={{ width: 70 }}
                                                />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Preview panel */}
                <div className="card" style={{ position: 'sticky', top: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <Barcode size={16} color="var(--accent)" />
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Preview Label</h3>
                        {selected.size > 0 && (
                            <button onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {selected.size === 0 ? (
                        <div className="empty-state" style={{ padding: '30px 0' }}>
                            <Barcode size={36} />
                            <h3>Belum ada yang dipilih</h3>
                            <p>Centang buku dari daftar kiri</p>
                        </div>
                    ) : (
                        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {getSelectedBooks().slice(0, 6).map(book => (
                                    <div key={book.id} style={{ background: 'white', padding: '10px 12px', textAlign: 'center', borderRadius: 8, border: '1px solid #ddd' }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#333', marginBottom: 4, lineHeight: 1.3 }}>
                                            {book.title.length > 50 ? book.title.substring(0, 50) + '...' : book.title}
                                        </div>
                                        {book.isbn ? (
                                            <>
                                                <BarcodeGenerator value={book.isbn} width={1.5} height={50} />
                                                <div style={{ fontSize: 10, color: '#666', marginTop: 2, fontFamily: 'monospace' }}>{book.isbn}</div>
                                            </>
                                        ) : (
                                            <div style={{ fontSize: 10, color: '#999', padding: '16px 0' }}>Tidak ada ISBN</div>
                                        )}
                                    </div>
                                ))}
                                {selected.size > 6 && (
                                    <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
                                        +{selected.size - 6} label lainnya akan dicetak
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {selected.size > 0 && (
                        <button className="btn btn-primary" style={{ width: '100%', marginTop: 14, justifyContent: 'center' }} onClick={handlePrint}>
                            <Printer size={15} /> Cetak {getSelectedBooks().reduce((sum, b) => sum + getCopies(b.id), 0)} Label
                        </button>
                    )}
                </div>
            </div>

            {/* React Portal: mount print area directly under <body> to escape layout hierarchy */}
            {mounted && createPortal(<PrintArea />, document.body)}
        </div>
    );
}
