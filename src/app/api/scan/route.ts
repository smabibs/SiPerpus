import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET: look up a book or member by barcode/ISBN/member_id
export async function GET(req: NextRequest) {
    try {
        const db = getDb();
        const { searchParams } = new URL(req.url);
        const isbn = searchParams.get('isbn') || '';
        const member_code = searchParams.get('member_code') || '';

        if (isbn) {
            const book = db.prepare(`
                SELECT b.id, b.isbn, b.title, b.author, b.available_copies, b.total_copies,
                       s.name as subject_name
                FROM books b LEFT JOIN subjects s ON b.subject_id = s.id
                WHERE b.isbn = ?
            `).get(isbn) as Record<string, string | number> | undefined;
            if (!book) return NextResponse.json({ error: `Buku dengan ISBN "${isbn}" tidak ditemukan` }, { status: 404 });
            return NextResponse.json({ type: 'book', data: book });
        }

        if (member_code) {
            const member = db.prepare(`
                SELECT id, member_id, name, type, class, major, status,
                       (SELECT COUNT(*) FROM loans WHERE member_id = members.id AND status = 'dipinjam') as active_loans
                FROM members WHERE member_id = ?
            `).get(member_code) as Record<string, string | number> | undefined;
            if (!member) return NextResponse.json({ error: `Anggota dengan ID "${member_code}" tidak ditemukan` }, { status: 404 });
            return NextResponse.json({ type: 'member', data: member });
        }

        return NextResponse.json({ error: 'Berikan parameter isbn atau member_code' }, { status: 400 });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

// POST: process a loan or return via barcode
export async function POST(req: NextRequest) {
    try {
        const db = getDb();
        const body = await req.json();
        const { action, isbn, member_code } = body as { action: string; isbn: string; member_code?: string };

        // ── PINJAM ───────────────────────────────────────────────────────────
        if (action === 'pinjam') {
            if (!isbn || !member_code) {
                return NextResponse.json({ error: 'ISBN buku dan ID anggota wajib diisi' }, { status: 400 });
            }

            const book = db.prepare(`
                SELECT id, isbn, title, author, available_copies FROM books WHERE isbn = ?
            `).get(isbn) as { id: number; isbn: string; title: string; author: string; available_copies: number } | undefined;
            if (!book) return NextResponse.json({ error: `Buku ISBN "${isbn}" tidak ditemukan` }, { status: 404 });
            if (book.available_copies < 1) return NextResponse.json({ error: `Buku "${book.title}" stok habis (0 tersedia)` }, { status: 400 });

            const member = db.prepare(`
                SELECT id, member_id, name, type, class, status FROM members WHERE member_id = ?
            `).get(member_code) as { id: number; member_id: string; name: string; type: string; class: string; status: string } | undefined;
            if (!member) return NextResponse.json({ error: `Anggota "${member_code}" tidak ditemukan` }, { status: 404 });
            if (member.status !== 'aktif') return NextResponse.json({ error: `Anggota "${member.name}" tidak aktif` }, { status: 400 });

            // Check duplicate active loan
            const existing = db.prepare(`SELECT id FROM loans WHERE book_id = ? AND member_id = ? AND status = 'dipinjam'`).get(book.id, member.id);
            if (existing) return NextResponse.json({ error: `${member.name} sudah meminjam buku ini dan belum dikembalikan` }, { status: 400 });

            // Get loan duration from settings
            const loanDaysSetting = db.prepare(`SELECT value FROM settings WHERE key = 'default_loan_days'`).get() as { value: string } | undefined;
            const loanDays = parseInt(loanDaysSetting?.value || '7');
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + loanDays);
            const dueDateStr = dueDate.toISOString().replace('T', ' ').substring(0, 19);

            const result = db.prepare(`
                INSERT INTO loans (book_id, member_id, quantity, due_date, status) VALUES (?, ?, 1, ?, 'dipinjam')
            `).run(book.id, member.id, dueDateStr);

            db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(book.id);

            const newLoan = db.prepare(`
                SELECT l.id, l.due_date, b.title as book_title, b.isbn as book_isbn,
                       m.name as member_name, m.member_id as member_code, m.class as member_class
                FROM loans l JOIN books b ON l.book_id = b.id JOIN members m ON l.member_id = m.id
                WHERE l.id = ?
            `).get(result.lastInsertRowid);

            return NextResponse.json({ success: true, action: 'pinjam', loan: newLoan });
        }

        // ── KEMBALI ──────────────────────────────────────────────────────────
        if (action === 'kembali') {
            if (!isbn) return NextResponse.json({ error: 'ISBN buku wajib diisi' }, { status: 400 });

            const book = db.prepare('SELECT id, title FROM books WHERE isbn = ?').get(isbn) as { id: number; title: string } | undefined;
            if (!book) return NextResponse.json({ error: `Buku ISBN "${isbn}" tidak ditemukan` }, { status: 404 });

            // If member_code provided, find that specific member's loan
            let loanQuery = `
                SELECT l.id, l.member_id, l.due_date, COALESCE(l.quantity, 1) as quantity,
                       m.name as member_name, m.member_id as member_code
                FROM loans l JOIN members m ON l.member_id = m.id
                WHERE l.book_id = ? AND l.status = 'dipinjam'
            `;
            const loanParams: (number | string)[] = [book.id];
            if (member_code) {
                const member = db.prepare('SELECT id FROM members WHERE member_id = ?').get(member_code) as { id: number } | undefined;
                if (member) { loanQuery += ' AND l.member_id = ?'; loanParams.push(member.id); }
            }
            loanQuery += ' ORDER BY l.loan_date ASC LIMIT 1';

            const loan = db.prepare(loanQuery).get(...loanParams) as {
                id: number; member_id: number; due_date: string; quantity: number;
                member_name: string; member_code: string;
            } | undefined;

            if (!loan) {
                return NextResponse.json({ error: `Tidak ada peminjaman aktif untuk buku ISBN "${isbn}"` }, { status: 404 });
            }

            // Calculate fine
            const dueDate = new Date(loan.due_date);
            const today = new Date();
            let fine = 0;
            let daysLate = 0;
            if (today > dueDate) {
                daysLate = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                fine = daysLate * 1000 * (loan.quantity || 1);
            }

            db.prepare(`
                UPDATE loans SET status='dikembalikan', return_date=datetime('now','localtime'), fine=? WHERE id=?
            `).run(fine, loan.id);

            db.prepare('UPDATE books SET available_copies = available_copies + ? WHERE id = ?').run(loan.quantity || 1, book.id);

            const updated = db.prepare(`
                SELECT l.id, l.fine, l.return_date, b.title as book_title, b.isbn as book_isbn,
                       m.name as member_name, m.member_id as member_code
                FROM loans l JOIN books b ON l.book_id = b.id JOIN members m ON l.member_id = m.id
                WHERE l.id = ?
            `).get(loan.id);

            return NextResponse.json({ success: true, action: 'kembali', fine, daysLate, loan: updated });
        }

        return NextResponse.json({ error: 'action tidak valid (pinjam/kembali)' }, { status: 400 });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
