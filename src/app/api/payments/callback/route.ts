import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { order_number, gateway_name, gateway_reference, amount, status } = await request.json();

    if (!order_number || !gateway_name) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Find order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', order_number)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }

    // Idempotency check - already paid
    if (order.payment_status === 'paid') {
      return NextResponse.json({ success: true, message: 'Payment already processed', idempotent: true });
    }

    // Only allow processing for pending or waiting_confirmation orders
    if (!['pending_payment', 'waiting_confirmation'].includes(order.payment_status)) {
      return NextResponse.json({ error: 'Order tidak bisa diproses (status: ' + order.payment_status + ')' }, { status: 400 });
    }

    if (status !== 'success') {
      // Mark payment as failed
      await supabase.from('payments').insert({
        order_id: order.id,
        gateway_name,
        gateway_reference: gateway_reference || null,
        amount: amount || order.total_amount,
        status: 'failed',
        payload_raw: { order_number, gateway_name, gateway_reference, amount, status },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await supabase
        .from('orders')
        .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', order.id);

      return NextResponse.json({ success: false, error: 'Payment failed' });
    }

    // Idempotency check - duplicate gateway reference
    if (gateway_reference) {
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('gateway_reference', gateway_reference)
        .single();

      if (existingPayment) {
        return NextResponse.json({ success: true, message: 'Payment already recorded', idempotent: true });
      }
    }

    const now = new Date().toISOString();

    // Record payment
    await supabase.from('payments').insert({
      order_id: order.id,
      gateway_name,
      gateway_reference: gateway_reference || null,
      amount: amount || order.total_amount,
      status: 'success',
      payload_raw: { order_number, gateway_name, gateway_reference, amount, status },
      paid_at: now,
      created_at: now,
      updated_at: now,
    });

    // Update order status
    await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        order_status: 'paid',
        paid_at: now,
        payment_method: gateway_name,
        payment_reference: gateway_reference || null,
        updated_at: now,
      })
      .eq('id', order.id);

    // Trigger auto assignment
    const { data: assignResult } = await supabase.rpc('assign_account_for_order', {
      p_order_id: order.id,
    });

    // If assignment succeeded, mark as delivered via web
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

    return NextResponse.json({
      success: true,
      message: 'Payment processed',
      assigned: assignResult?.success || false,
      assignment_id: assignResult?.assignment_id || null,
      needs_manual: assignResult?.needs_manual || false,
    });
  } catch (err) {
    console.error('Payment callback error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
