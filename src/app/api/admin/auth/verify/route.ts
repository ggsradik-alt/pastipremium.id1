import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ valid: false, error: 'No token' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    return NextResponse.json({ valid: false, error: 'Invalid or expired token' }, { status: 401 });
  }

  return NextResponse.json({ valid: true, user: payload });
}
