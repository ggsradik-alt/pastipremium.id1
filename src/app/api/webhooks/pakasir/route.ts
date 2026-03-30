import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { sendTelegramNotification } from '@/lib/telegram';

// Pakasir Webhook Handler
// Pakasir will POST to this endpoint when payment is completed
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { amount, order_id, project, status, payment_method, completed_at } = payload;

    console.log('📥 Pakasir Webhook received:', JSON.stringify(payload));

    // Validate required fields
    if (!order_id || !amount || !status) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    // Validate project slug
    if (project !== (process.env.PAKASIR_SLUG || 'pastipremiumid1')) {
      console.error('Invalid project slug:', project);
      return NextResponse.json({ error: 'Invalid project' }, { status: 400 });
    }

    // Find order by order_number (pakasir order_id = our order_number)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order not found for webhook:', order_id);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Idempotency: already paid
    if (order.payment_status === 'paid') {
      console.log('Order already paid, skipping:', order_id);
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    // Validate amount matches
    if (Number(amount) !== Number(order.total_amount)) {
      console.error(`Amount mismatch: webhook=${amount}, order=${order.total_amount}`);
      // Still process but log warning
    }

    if (status !== 'completed') {
      console.log('Non-completed webhook status:', status);
      return NextResponse.json({ success: true, message: 'Status noted' });
    }

    const now = new Date().toISOString();

    // Record payment in payments table
    await supabase.from('payments').insert({
      order_id: order.id,
      gateway_name: 'pakasir',
      gateway_reference: `pakasir-${order_id}-${payment_method}`,
      amount: amount || order.total_amount,
      status: 'success',
      payload_raw: payload,
      paid_at: completed_at || now,
      created_at: now,
      updated_at: now,
    });

    // Update order status to paid
    await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        order_status: 'paid',
        paid_at: completed_at || now,
        payment_method: `pakasir_${payment_method || 'qris'}`,
        payment_reference: `pakasir-${order_id}`,
        updated_at: now,
      })
      .eq('id', order.id);

    // Auto-assign account to buyer
    let assignResult = null;
    try {
      const { data } = await supabase.rpc('assign_account_for_order', {
        p_order_id: order.id,
      });
      assignResult = data;

      if (assignResult?.success && assignResult?.assignment_id) {
        await supabase
          .from('account_assignments')
          .update({ delivered_at: now, updated_at: now })
          .eq('id', assignResult.assignment_id);

        await supabase
          .from('orders')
          .update({ order_status: 'delivered', delivered_at: now, updated_at: now })
          .eq('id', order.id);
      }
    } catch (assignErr) {
      console.error('Auto-assign error:', assignErr);
    }

    // Get product name and type for notification
    const { data: product } = await supabase
      .from('products')
      .select('name, account_type')
      .eq('id', order.product_id)
      .single();

    // Send Telegram Notification for payment
    const assigned = assignResult?.success ? '✅ Akun otomatis dikirim!' : '⚠️ Perlu assign akun manual';
    sendTelegramNotification(
      `💰 <b>PEMBAYARAN MASUK VIA PAKASIR!</b>\n\n` +
      `<b>Order:</b> <code>${order_id}</code>\n` +
      `<b>Produk:</b> ${product?.name || '-'}\n` +
      `<b>Nominal:</b> Rp ${Number(amount).toLocaleString('id-ID')}\n` +
      `<b>Metode:</b> ${payment_method || 'QRIS'}\n` +
      `<b>Waktu:</b> ${completed_at || now}\n\n` +
      `${assigned}`
    );

    // Check remaining stock if assignment was successful
    if (assignResult?.success) {
      try {
        const { count: remainingStock } = await supabase
          .from('stock_accounts')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', order.product_id)
          .eq('status', 'active');

        // Notify if stock is running low (1 or 0)
        if (remainingStock !== null && remainingStock <= 1) {
          const typeLabel = product?.account_type === 'sharing' ? 'Sharing' : 'Private';
          const stockWarning = remainingStock === 0 ? 'HABIS! (0)' : 'tinggal 1';
          
          sendTelegramNotification(
            `⚠️ <b>PERINGATAN STOK MENIPIS!</b>\n\n` +
            `<b>Produk:</b> ${product?.name}\n` +
            `<b>Tipe:</b> ${typeLabel}\n` +
            `<b>Sisa Stok:</b> ${stockWarning}\n\n` +
            `Mohon segera tambahkan stok baru untuk produk ini.`
          );
        }
      } catch (stockErr) {
        console.error('Error checking remaining stock:', stockErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Payment processed' });
  } catch (err) {
    console.error('Pakasir webhook error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
