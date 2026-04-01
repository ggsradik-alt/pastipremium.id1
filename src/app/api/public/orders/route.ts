import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
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

    // Anti-spam: Check if buyer already has a pending order for the same product within last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('buyer_id', buyer.id)
      .eq('product_id', product.id)
      .eq('payment_status', 'pending_payment')
      .gte('created_at', tenMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingOrder) {
      // Return existing pending order instead of creating a new one
      return NextResponse.json({
        order_id: existingOrder.id,
        order_number: existingOrder.order_number,
        payment_status: existingOrder.payment_status,
        order_status: existingOrder.order_status,
        amount: existingOrder.total_amount,
        reused: true,
      });
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
      const { data: productCommission } = await supabase
        .from('reseller_product_commissions')
        .select('*')
        .eq('reseller_id', reseller.id)
        .eq('product_id', product.id)
        .maybeSingle();

      const commissionType = productCommission?.commission_type || reseller.default_commission_type || 'fixed';
      const commissionRate = productCommission?.commission_value ?? (reseller.default_commission_value || 0);

      let commissionAmount = 0;
      if (commissionType === 'percentage') {
        commissionAmount = Math.round(product.price * commissionRate / 100);
      } else {
        commissionAmount = commissionRate;
      }

      if (commissionAmount > 0) {
        // Insert commission record
        await supabase.from('reseller_commissions').insert({
          reseller_id: reseller.id,
          order_id: order.id,
          product_id: product.id,
          product_name: product.name,
          order_amount: product.price,
          commission_type: commissionType,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          status: 'unpaid',
        });
        
        // Update reseller stats
        await supabase.from('resellers').update({
          total_sales: (reseller.total_sales || 0) + 1,
          total_commission: (reseller.total_commission || 0) + commissionAmount,
          unpaid_commission: (reseller.unpaid_commission || 0) + commissionAmount,
          updated_at: now,
        }).eq('id', reseller.id);
      }
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
