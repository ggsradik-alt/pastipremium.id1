import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendTelegramNotification } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const orderNumber = formData.get('order_number') as string | null;

    if (!file || !orderNumber) {
      return NextResponse.json({ error: 'File dan nomor order wajib diisi' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Format file harus JPG, PNG, atau WebP' }, { status: 400 });
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 5MB' }, { status: 400 });
    }

    // Find order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }

    // Only allow upload for pending orders
    if (order.payment_status !== 'pending_payment') {
      return NextResponse.json({ error: 'Order sudah dibayar atau dibatalkan' }, { status: 400 });
    }

    // Upload to Supabase Storage
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${orderNumber}-${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadErr } = await supabase.storage
      .from('payment-proofs')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.error('Upload error:', uploadErr);
      return NextResponse.json({ error: 'Gagal upload file: ' + uploadErr.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    // Update order with proof URL and change payment_status to waiting_confirmation
    await supabase
      .from('orders')
      .update({
        payment_proof_url: publicUrl,
        payment_status: 'waiting_confirmation',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    // Send Telegram Notification
    sendTelegramNotification(
      `🔔 <b>BUKTI TRANSFER DIUPLOAD!</b>\n\n` +
      `<b>Order:</b> <code>${orderNumber}</code>\n` +
      `<b>Nominal:</b> Rp ${order.total_amount?.toLocaleString('id-ID')}\n\n` +
      `<a href="${publicUrl}">📸 Lihat Foto Bukti</a>\n\n` +
      `Silakan cek <b>PastiPremium.id Admin</b> untuk menyetujui dan membagikan akun secara otomatis.`
    );

    return NextResponse.json({
      success: true,
      message: 'Bukti pembayaran berhasil diupload',
      proof_url: publicUrl,
    });
  } catch (err) {
    console.error('Upload proof error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
