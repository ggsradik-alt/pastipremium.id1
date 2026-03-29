import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { signToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { name, phone } = await request.json();

    if (!name || !phone) {
      return NextResponse.json({ error: 'Nama dan nomor WA wajib diisi' }, { status: 400 });
    }

    const dummyEmail = `${phone.trim()}@wa.pastipremium.id`;

    // Find existing buyer by phone
    let { data: existing } = await supabase
      .from('buyers')
      .select('*')
      .eq('phone', phone.trim())
      .single();

    if (existing) {
      // Update name if changed
      if (existing.name !== name.trim()) {
        await supabase.from('buyers').update({
          name: name.trim(),
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        existing.name = name.trim();
      }
    } else {
      // Create new buyer
      const now = new Date().toISOString();
      const { data: newBuyer, error: createErr } = await supabase
        .from('buyers')
        .insert({
          name: name.trim(),
          email: dummyEmail,
          phone: phone.trim(),
          status: 'active',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (createErr) {
        return NextResponse.json({ error: 'Gagal membuat akun: ' + createErr.message }, { status: 500 });
      }
      existing = newBuyer;
    }

    // Generate JWT token
    const token = signToken({
      type: 'buyer',
      id: existing.id,
      name: existing.name,
      email: existing.email,
      phone: existing.phone,
    }, 72); // 72 hours

    return NextResponse.json({
      buyer: {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        phone: existing.phone,
      },
      token,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
