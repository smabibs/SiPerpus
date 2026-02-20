import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'perpus_session';

const PUBLIC_PATHS = ['/login', '/api/auth'];

export function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Allow public paths and static assets
    if (
        PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon')
    ) {
        return NextResponse.next();
    }

    const sessionSecret = process.env.SESSION_SECRET;
    const token = req.cookies.get(COOKIE_NAME)?.value;

    if (sessionSecret && token === sessionSecret) {
        return NextResponse.next();
    }

    // Not authenticated → redirect to login
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
