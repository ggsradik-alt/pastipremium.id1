import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';

// CATATAN: Endpoint ini khusus digunakan admin (yang login dari dashboard frontend)
// Karena saat ini auth di admin menggunakan localStorage & Supabase dummy auth,
// ini adalah pendekatan sederhana untuk decrypt satu password secara on-demand.

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get('id');
    if (!accountId) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    // Ambil akun dari database
    const { data: account, error } = await supabase
      .from('stock_accounts')
      .select('account_secret_encrypted')
      .eq('id', accountId)
      .single();

    if (error || !account) {
      return NextResponse.json({ error: 'Account tidak ditemukan' }, { status: 404 });
    }

    if (!account.account_secret_encrypted) {
      return NextResponse.json({ secret: '' }, { status: 200 });
    }

    // Decrypt password
    const decryptedSecret = decrypt(account.account_secret_encrypted);

    return NextResponse.json({ secret: decryptedSecret }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to decrypt', detail: err.message }, { status: 500 });
  }
}
