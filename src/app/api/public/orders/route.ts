import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { buyer_name, buyer_email, buyer_phone, product_id } = await request.json();

    if (!buyer_name || !product_id) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Get product
    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('status', 'active')
      .single();

    if (prodError || !product) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }

    // Find or create buyer
    let buyer;
    if (buyer_email) {
      const { data: existingBuyer } = await supabase
        .from('buyers')
        .select('*')
        .eq('email', buyer_email)
        .single();

      if (existingBuyer) {
        buyer = existingBuyer;
      }
    }

    if (!buyer) {
      const now = new Date().toISOString();
      const { data: newBuyer, error: buyerError } = await supabase
        .from('buyers')
        .insert({
          name: buyer_name,
          email: buyer_email || null,
          phone: buyer_phone || null,
          status: 'active',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (buyerError) {
        return NextResponse.json({ error: 'Gagal membuat data buyer' }, { status: 500 });
      }
      buyer = newBuyer;
    }

    // Generate order number
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const orderNumber = `ORD-${dateStr}-${rand}`;

    const now = new Date().toISOString();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        buyer_id: buyer.id,
        product_id: product.id,
        unit_price: product.price,
        total_amount: product.price,
        payment_status: 'pending_payment',
        order_status: 'pending',
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (orderError) {
      return NextResponse.json({ error: 'Gagal membuat pesanan: ' + orderError.message }, { status: 500 });
    }

    return NextResponse.json({
      order_id: order.id,
      order_number: order.order_number,
      payment_status: order.payment_status,
      order_status: order.order_status,
      amount: order.total_amount,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
