import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { signToken } from '@/lib/auth';

// Google OAuth login verification for admin
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const { data: admin } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .eq('status', 'active')
      .single();

    if (!admin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    // Update last login
    await supabase
      .from('admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', admin.id);

    // Generate JWT token
    const token = signToken({
      type: 'admin',
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    }, 48);

    return NextResponse.json({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
      token,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
