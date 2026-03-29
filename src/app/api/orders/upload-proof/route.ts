import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendTelegramNotification } from '@/lib/telegram';
import { google } from 'googleapis';
import { Readable } from 'stream';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const orderNumber = formData.get('order_number') as string | null;

    if (!file || !orderNumber) {
      return NextResponse.json({ error: 'File dan nomor order wajib diisi' }, { status: 400 });
    }

    // Max 15MB
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 15MB' }, { status: 400 });
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

    // Only allow upload for pending/pending_payment orders
    if (order.payment_status === 'waiting_confirmation') {
      return NextResponse.json({ 
        error: 'Bukti pembayaran sudah pernah dikirim dan sedang diverifikasi admin. Harap tunggu.',
        already_uploaded: true 
      }, { status: 400 });
    }

    if (order.payment_status !== 'pending_payment' && order.payment_status !== 'pending') {
      return NextResponse.json({ error: 'Order sudah dibayar atau dibatalkan' }, { status: 400 });
    }

    // Prepare File Stream for Google Drive
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${orderNumber}-${Date.now()}.${ext}`;

    let publicUrl = '';

    // Upload to Google Drive
    try {
      if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
         throw new Error('Credential Google Drive belum di set di .env');
      }

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });

      const drive = google.drive({ version: 'v3', auth });
      const folderId = '1tqCQ-9N2TcF52Fb7YQWyua7xhHjN2MD9';

      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: folderId ? [folderId] : undefined,
        },
        media: {
          mimeType: file.type || 'application/octet-stream',
          body: stream,
        },
        fields: 'id, webViewLink, webContentLink',
      });

      const fileId = response.data.id;

      if (fileId) {
        // Set file as public so anyone with link can view (like Admin & Web)
        await drive.permissions.create({
          fileId: fileId,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
        });
        
        // Use webViewLink for the admin to view it directly
        publicUrl = response.data.webViewLink || '';
      } else {
        throw new Error('Gagal mendapatkan file ID dari Google Drive');
      }
    } catch (gdriveErr: any) {
      console.error('Google Drive Upload error:', gdriveErr);
      return NextResponse.json({ error: 'Konfigurasi Google Drive bermasalah atau gagal upload: ' + gdriveErr.message }, { status: 500 });
    }

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
      `🔔 <b>BUKTI TRANSFER DIUPLOAD! (Via GDrive)</b>\n\n` +
      `<b>Order:</b> <code>${orderNumber}</code>\n` +
      `<b>Nominal:</b> Rp ${order.total_amount?.toLocaleString('id-ID')}\n\n` +
      `<a href="${publicUrl}">📸 Lihat Foto Bukti (GDrive)</a>\n\n` +
      `Silakan cek <b>PastiPremium.id Admin</b> untuk memverifikasi dan mengirimkan akun.`
    );

    return NextResponse.json({
      success: true,
      message: 'Bukti pembayaran berhasil diupload ke Google Drive',
      proof_url: publicUrl,
    });
  } catch (err) {
    console.error('Upload proof error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
