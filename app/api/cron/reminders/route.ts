import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import webpush from 'web-push';

// Requires service role to read all subscriptions and reminders securely
// For this MVP we act with user's keys but Cron usually runs server-side trusted.
// We'll use env vars.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Or Service Role key for better security in Cron
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.NEXT_PUBLIC_VAPID_SUBJECT!;

webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

export async function GET() {
    // 1. Check authorization (Vercel Cron Header) ensuring it's not spam-called
    // The header 'Authorization' with 'Bearer ${process.env.CRON_SECRET}' is standard for Vercel Cron
    // For now we skip strict auth for MVP testing convenience, or check for a simple query param ?key=...

    try {
        // 2. Fetch pending reminders for NOW or OLDER (missed ones)
        const now = new Date().toISOString(); // Full timestamp needed for time comparison

        const { data: reminders, error } = await supabase
            .from('reminders')
            .select('*, deadlines(title), exams(name)')
            .eq('is_sent', false)
            .lte('remind_at', now);

        if (error) throw error;
        if (!reminders || reminders.length === 0) {
            return NextResponse.json({ message: 'No reminders to send.' });
        }

        // 3. Fetch all subscriptions (Broadcasting to all for now - in a multi-user app we'd filter by user_id)
        // Since UniTracker is single-user personal app, sending to all registered devices is correct.
        const { data: subscriptions, error: subError } = await supabase.from('push_subscriptions').select('*');
        if (subError) throw subError;

        let sentCount = 0;

        // 4. Send Notifications
        for (const reminder of reminders) {
            let title = 'Promemoria UniTracker';
            let body = 'Hai una scadenza oggi!';

            if (reminder.entity_type === 'exam' && reminder.exams) {
                title = `Esame in arrivo: ${reminder.exams.name}`;
                body = 'Preparati per il tuo esame!';
            } else if (reminder.entity_type === 'deadline' && reminder.deadlines) {
                title = `Scadenza: ${reminder.deadlines.title}`;
                body = 'Ricordati di pagare questa scadenza.';
            }

            const payload = JSON.stringify({ title, body, url: '/' });

            for (const sub of subscriptions || []) {
                try {
                    await webpush.sendNotification({
                        endpoint: sub.endpoint,
                        keys: { auth: sub.auth, p256dh: sub.p256dh }
                    }, payload);
                    sentCount++;
                } catch (e) {
                    console.error('Failed to send to', sub.endpoint, e);
                    // If error is 410 (Gone), delete subscription
                }
            }

            // 5. Mark as sent
            await supabase.from('reminders').update({ is_sent: true }).eq('id', reminder.id);
        }

        return NextResponse.json({ success: true, sent: sentCount });

    } catch (err: unknown) {
        console.error('Cron job failed:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
