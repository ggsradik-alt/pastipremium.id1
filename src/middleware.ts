import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  
  // Jika diakses menggunakan domain Vercel bawaan, arahkan ke custom domain
  if (host === 'pastipremiumid1.vercel.app') {
    const url = request.nextUrl.clone();
    url.host = 'pastipremium.store';
    url.port = ''; // Pastikan tidak ada port
    url.protocol = 'https:'; // Pastikan menggunakan HTTPS
    
    return NextResponse.redirect(url, 301); // 301 Moved Permanently
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/webhooks (bisa ditambahkan jika webhook butuh akses spesifik)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sembarangan ekstensi gambar/aset lainnya
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
