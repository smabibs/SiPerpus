import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const db = getDb();
        const { searchParams } = new URL(req.url);
        const entity_type = searchParams.get('entity_type') || '';
        const action = searchParams.get('action') || '';
        const search = searchParams.get('search') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '30');
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params: (string | number)[] = [];

        if (entity_type) {
            whereClause += ' AND entity_type = ?';
            params.push(entity_type);
        }
        if (action) {
            whereClause += ' AND action = ?';
            params.push(action);
        }
        if (search) {
            whereClause += ' AND (entity_name LIKE ? OR details LIKE ? OR entity_id LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const total = db.prepare(`SELECT COUNT(*) as c FROM audit_logs ${whereClause}`).get(...params) as { c: number };
        const logs = db.prepare(`
            SELECT * FROM audit_logs
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        return NextResponse.json({ logs, total: total.c, page, limit });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
