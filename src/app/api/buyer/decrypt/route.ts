import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  try {
    const { encrypted } = await request.json();

    if (!encrypted) {
      return NextResponse.json({ error: 'No data' }, { status: 400 });
    }

    const decrypted = decrypt(encrypted);
    return NextResponse.json({ decrypted });
  } catch {
    return NextResponse.json({ error: 'Decrypt failed' }, { status: 500 });
  }
}
