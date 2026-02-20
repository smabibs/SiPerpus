import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const db = getDb();
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';
        const type = searchParams.get('type') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params: (string | number)[] = [];

        if (search) {
            whereClause += ' AND (name LIKE ? OR member_id LIKE ? OR class LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (type) {
            whereClause += ' AND type = ?';
            params.push(type);
        }

        const total = db.prepare(`SELECT COUNT(*) as c FROM members ${whereClause}`).get(...params) as { c: number };
        const members = db.prepare(`
      SELECT *, 
        (SELECT COUNT(*) FROM loans WHERE member_id = members.id AND status = 'dipinjam') as active_loans
      FROM members ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

        return NextResponse.json({ members, total: total.c, page, limit });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const db = getDb();
        const body = await req.json();
        const { member_id, name, type, class: cls, major, phone, email, address } = body;

        if (!name || !type || !member_id) {
            return NextResponse.json({ error: 'ID anggota, nama, dan tipe wajib diisi' }, { status: 400 });
        }

        const result = db.prepare(`
      INSERT INTO members (member_id, name, type, class, major, phone, email, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(member_id, name, type, cls || null, major || null, phone || null, email || null, address || null);

        const newMember = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
        logAudit('CREATE', 'member', result.lastInsertRowid, name, `ID: ${member_id}, Tipe: ${type}`);
        return NextResponse.json(newMember, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const db = getDb();
        const body = await req.json();
        const { id, member_id, name, type, class: cls, major, phone, email, address, status } = body;

        if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

        db.prepare(`
      UPDATE members SET member_id=?, name=?, type=?, class=?, major=?, phone=?, email=?, address=?, status=?
      WHERE id=?
    `).run(member_id, name, type, cls || null, major || null, phone || null, email || null, address || null, status || 'aktif', id);

        const updated = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
        logAudit('UPDATE', 'member', id, name);
        return NextResponse.json(updated);
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const db = getDb();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

        const activeLoans = db.prepare("SELECT COUNT(*) as c FROM loans WHERE member_id = ? AND status = 'dipinjam'").get(id) as { c: number };
        if (activeLoans.c > 0) return NextResponse.json({ error: 'Anggota masih memiliki pinjaman aktif' }, { status: 400 });

        const memberInfo = db.prepare('SELECT name FROM members WHERE id = ?').get(id) as { name: string } | undefined;
        db.prepare('DELETE FROM members WHERE id = ?').run(id);
        logAudit('DELETE', 'member', id, memberInfo?.name || 'Unknown');
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
