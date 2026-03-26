import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendTelegramNotification } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  try {
    const { buyer_name, buyer_email, buyer_phone, product_id, ref_code } = await request.json();

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

    // Look up reseller by ref_code
    let resellerId = null;
    let reseller = null;
    if (ref_code) {
      const { data: resellerData } = await supabase
        .from('resellers')
        .select('*')
        .eq('ref_code', ref_code.toUpperCase())
        .eq('status', 'active')
        .single();
      if (resellerData) {
        resellerId = resellerData.id;
        reseller = resellerData;
      }
    }

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
        reseller_id: resellerId,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (orderError) {
      return NextResponse.json({ error: 'Gagal membuat pesanan: ' + orderError.message }, { status: 500 });
    }

    // Record commission if reseller exists
    if (reseller && order) {
      const commission = reseller.commission_per_sale || 0;
      // Insert commission record
      await supabase.from('reseller_commissions').insert({
        reseller_id: reseller.id,
        order_id: order.id,
        commission_amount: commission,
        status: 'unpaid',
      });
      // Update reseller stats
      await supabase.from('resellers').update({
        total_sales: (reseller.total_sales || 0) + 1,
        total_commission: (reseller.total_commission || 0) + commission,
        unpaid_commission: (reseller.unpaid_commission || 0) + commission,
        updated_at: now,
      }).eq('id', reseller.id);
    }

    // Send Telegram Notification
    // Don't wait for it to finish (fire and forget) to speed up response
    sendTelegramNotification(
      `🛒 <b>PESANAN BARU! (Belum Bayar)</b>\n\n` +
      `<b>Order:</b> <code>${orderNumber}</code>\n` +
      `<b>Produk:</b> ${product.name}\n` +
      `<b>Harga:</b> Rp ${product.price.toLocaleString('id-ID')}\n\n` +
      `<b>Buyer:</b> ${buyer.name}\n` +
      `<b>WA:</b> ${buyer.phone}` +
      (reseller ? `\n\n🤝 <b>Via Reseller:</b> ${reseller.name} (${reseller.ref_code})` : '')
    );

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
