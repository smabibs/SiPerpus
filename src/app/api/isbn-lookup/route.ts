import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const isbn = searchParams.get('isbn')?.replace(/[-\s]/g, '');

        if (!isbn) {
            return NextResponse.json({ error: 'ISBN wajib diisi' }, { status: 400 });
        }

        // Try Open Library first
        const olRes = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, {
            signal: AbortSignal.timeout(8000),
        });

        if (olRes.ok) {
            const olData = await olRes.json();

            // Get author names
            let author = '';
            if (olData.authors && olData.authors.length > 0) {
                const authorKeys = olData.authors.map((a: { key: string }) => a.key);
                const authorNames = await Promise.all(
                    authorKeys.slice(0, 3).map(async (key: string) => {
                        try {
                            const aRes = await fetch(`https://openlibrary.org${key}.json`, {
                                signal: AbortSignal.timeout(5000),
                            });
                            if (aRes.ok) {
                                const aData = await aRes.json();
                                return aData.name || '';
                            }
                        } catch { /* skip */ }
                        return '';
                    })
                );
                author = authorNames.filter(Boolean).join(', ');
            }

            // Get publisher from editions
            let publisher = '';
            if (olData.publishers) {
                publisher = Array.isArray(olData.publishers) ? olData.publishers[0] : olData.publishers;
            }

            // Get publish year
            const year = olData.publish_date
                ? parseInt(olData.publish_date.match(/\d{4}/)?.[0] || '') || null
                : null;

            // Cover image
            const cover = olData.covers && olData.covers.length > 0
                ? `https://covers.openlibrary.org/b/id/${olData.covers[0]}-M.jpg`
                : null;

            // Description
            let description = '';
            if (olData.description) {
                description = typeof olData.description === 'string'
                    ? olData.description
                    : olData.description.value || '';
            }

            return NextResponse.json({
                found: true,
                source: 'openlibrary',
                data: {
                    isbn,
                    title: olData.title || '',
                    author,
                    publisher,
                    year,
                    description: description.substring(0, 500),
                    cover,
                    pages: olData.number_of_pages || null,
                    language: olData.languages?.[0]?.key?.replace('/languages/', '') || null,
                },
            });
        }

        // Fallback: Try Google Books API (no key, limited quota)
        const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`, {
            signal: AbortSignal.timeout(8000),
        });

        if (gbRes.ok) {
            const gbData = await gbRes.json();
            if (gbData.totalItems > 0) {
                const vol = gbData.items[0].volumeInfo;
                return NextResponse.json({
                    found: true,
                    source: 'google_books',
                    data: {
                        isbn,
                        title: vol.title || '',
                        author: (vol.authors || []).join(', '),
                        publisher: vol.publisher || '',
                        year: vol.publishedDate ? parseInt(vol.publishedDate.substring(0, 4)) || null : null,
                        description: (vol.description || '').substring(0, 500),
                        cover: vol.imageLinks?.thumbnail || null,
                        pages: vol.pageCount || null,
                        language: vol.language || null,
                    },
                });
            }
        }

        return NextResponse.json({ found: false, error: 'ISBN tidak ditemukan' });
    } catch (e) {
        return NextResponse.json({ error: `Gagal mencari ISBN: ${String(e)}` }, { status: 500 });
    }
}
