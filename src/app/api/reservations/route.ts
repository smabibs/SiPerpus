import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const db = getDb();
        const { searchParams } = new URL(req.url);
        const book_id = searchParams.get('book_id');
        const member_id = searchParams.get('member_id');
        const status = searchParams.get('status') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        let where = 'WHERE 1=1';
        const params: (string | number)[] = [];

        if (book_id) { where += ' AND r.book_id = ?'; params.push(parseInt(book_id)); }
        if (member_id) { where += ' AND r.member_id = ?'; params.push(parseInt(member_id)); }
        if (status) { where += ' AND r.status = ?'; params.push(status); }

        const total = db.prepare(`SELECT COUNT(*) as c FROM reservations r ${where}`).get(...params) as { c: number };
        const reservations = db.prepare(`
            SELECT r.*, b.title as book_title, b.isbn as book_isbn, m.name as member_name, m.member_id as member_code
            FROM reservations r
            JOIN books b ON r.book_id = b.id
            JOIN members m ON r.member_id = m.id
            ${where}
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        return NextResponse.json({ reservations, total: total.c, page, limit });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const db = getDb();
        const { book_id, member_id } = await req.json();

        if (!book_id || !member_id) {
            return NextResponse.json({ error: 'book_id dan member_id wajib diisi' }, { status: 400 });
        }

        // Validate book exists
        const book = db.prepare('SELECT id, title, available_copies FROM books WHERE id = ?').get(book_id) as { id: number; title: string; available_copies: number } | undefined;
        if (!book) return NextResponse.json({ error: 'Buku tidak ditemukan' }, { status: 404 });

        // Check if book still available (reservation only for unavailable books)
        if (book.available_copies > 0) {
            return NextResponse.json({ error: 'Buku masih tersedia, tidak perlu reservasi' }, { status: 400 });
        }

        // Check if member already has active reservation for this book
        const existing = db.prepare(`
            SELECT id FROM reservations WHERE book_id = ? AND member_id = ? AND status = 'aktif'
        `).get(book_id, member_id);
        if (existing) {
            return NextResponse.json({ error: 'Anggota sudah memiliki reservasi aktif untuk buku ini' }, { status: 400 });
        }

        // Create reservation with 7-day expiry
        const result = db.prepare(`
            INSERT INTO reservations (book_id, member_id, expires_at)
            VALUES (?, ?, datetime('now','localtime','+7 days'))
        `).run(book_id, member_id);

        const member = db.prepare('SELECT name FROM members WHERE id = ?').get(member_id) as { name: string };
        logAudit('CREATE', 'reservation', result.lastInsertRowid, book.title, `Oleh: ${member.name}`);

        return NextResponse.json({ id: result.lastInsertRowid, message: 'Reservasi berhasil dibuat' }, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const db = getDb();
        const { id, status } = await req.json();

        if (!id || !status) return NextResponse.json({ error: 'id dan status wajib' }, { status: 400 });
        if (!['terpenuhi', 'dibatalkan'].includes(status)) {
            return NextResponse.json({ error: 'Status harus terpenuhi atau dibatalkan' }, { status: 400 });
        }

        const reservation = db.prepare(`
            SELECT r.*, b.title as book_title FROM reservations r JOIN books b ON r.book_id = b.id WHERE r.id = ?
        `).get(id) as { book_title: string; status: string } | undefined;
        if (!reservation) return NextResponse.json({ error: 'Reservasi tidak ditemukan' }, { status: 404 });
        if (reservation.status !== 'aktif') return NextResponse.json({ error: 'Reservasi sudah tidak aktif' }, { status: 400 });

        db.prepare('UPDATE reservations SET status = ? WHERE id = ?').run(status, id);
        logAudit('UPDATE', 'reservation', id, reservation.book_title, `Status: ${status}`);

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const db = getDb();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 });

        const reservation = db.prepare(`
            SELECT r.*, b.title as book_title FROM reservations r JOIN books b ON r.book_id = b.id WHERE r.id = ?
        `).get(id) as { book_title: string } | undefined;

        db.prepare("UPDATE reservations SET status = 'dibatalkan' WHERE id = ? AND status = 'aktif'").run(id);
        logAudit('DELETE', 'reservation', id, reservation?.book_title || 'Unknown', 'Dibatalkan');

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
