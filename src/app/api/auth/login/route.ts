import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'perpus_session';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

// POST /api/auth/login
export async function POST(req: NextRequest) {
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;
        const sessionSecret = process.env.SESSION_SECRET;

        if (!adminEmail || !adminPassword || !sessionSecret) {
            return NextResponse.json({ error: 'Konfigurasi server tidak lengkap' }, { status: 500 });
        }

        const body = await req.json();
        const { email, password } = body as { email: string; password: string };

        if (
            email?.trim().toLowerCase() !== adminEmail.toLowerCase() ||
            password !== adminPassword
        ) {
            return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
        }

        const res = NextResponse.json({ success: true, email: adminEmail });
        res.cookies.set(COOKIE_NAME, sessionSecret, {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: COOKIE_MAX_AGE,
        });
        return res;
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

// DELETE /api/auth/login  (logout)
export async function DELETE() {
    const res = NextResponse.json({ success: true });
    res.cookies.set('perpus_session', '', { maxAge: 0, path: '/' });
    return res;
}

