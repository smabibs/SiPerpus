import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Default settings
const DEFAULTS: Record<string, string> = {
    school_name: 'SMA Negeri 1 Contoh',
    school_address: 'Jl. Pendidikan No. 1',
    school_city: 'Jakarta',
    school_phone: '021-1234567',
    school_email: '',
    school_website: '',
    school_npsn: '',
    school_logo: '',
    library_head: '',
    loan_duration_days: '7',
    fine_per_day: '1000',
    max_loan_books: '5',
    classes: JSON.stringify([
        'X-IPA-1', 'X-IPA-2', 'X-IPA-3',
        'X-IPS-1', 'X-IPS-2', 'X-IPS-3',
        'XI-IPA-1', 'XI-IPA-2', 'XI-IPA-3',
        'XI-IPS-1', 'XI-IPS-2', 'XI-IPS-3',
        'XII-IPA-1', 'XII-IPA-2', 'XII-IPA-3',
        'XII-IPS-1', 'XII-IPS-2', 'XII-IPS-3',
    ]),
    majors: JSON.stringify(['IPA', 'IPS', 'Bahasa']),
    grades: JSON.stringify(['X', 'XI', 'XII']),
};

export async function GET() {
    try {
        const db = getDb();
        const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
        const settings: Record<string, string> = { ...DEFAULTS };
        for (const row of rows) {
            settings[row.key] = row.value;
        }
        return NextResponse.json(settings);
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const db = getDb();
        const body = await req.json() as Record<string, string>;
        const upsert = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now','localtime'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `);
        const upsertMany = db.transaction((entries: [string, string][]) => {
            for (const [k, v] of entries) upsert.run(k, v);
        });
        upsertMany(Object.entries(body));
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
