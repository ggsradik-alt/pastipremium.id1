import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi' }, { status: 400 });
    }

    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .eq('status', 'active')
      .single();

    if (error || !admin) {
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    }

    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    }

    // Update last login
    await supabase
      .from('admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', admin.id);

    return NextResponse.json({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
