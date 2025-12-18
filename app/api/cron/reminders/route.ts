import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import webpush from 'web-push';

// Requires service role to read all subscriptions and reminders securely
// For this MVP we act with user's keys but Cron usually runs server-side trusted.
// We'll use env vars.

// Supabase client will be initialized inside the handler to catch config errors



export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
    // 1. Check authorization (Vercel Cron Header) ensuring it's not spam-called
    // The header 'Authorization' with 'Bearer ${process.env.CRON_SECRET}' is standard for Vercel Cron
    // For now we skip strict auth for MVP testing convenience, or check for a simple query param ?key=...

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        if (!supabaseUrl || !supabaseAnonKey) {
            return NextResponse.json({ error: 'Missing Supabase keys (NEXT_PUBLIC_SUPABASE_URL or ANON_KEY)' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
        const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
        const VAPID_SUBJECT = process.env.NEXT_PUBLIC_VAPID_SUBJECT!;

        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
            return NextResponse.json({ error: 'Missing VAPID keys' }, { status: 500 });
        }

        webpush.setVapidDetails(
            VAPID_SUBJECT,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        );

        // 2. Fetch pending reminders for NOW or OLDER
        const now = new Date().toISOString();

        const { data: reminders, error } = await supabase
            .from('reminders')
            .select('*') // No joins here, just raw reminder data
            .eq('is_sent', false)
            .lte('remind_at', now);

        if (error) throw error;
        if (!reminders || reminders.length === 0) {
            return NextResponse.json({ message: 'No reminders to send.' });
        }

        // 2.1 Fetch related entity details manually (Application-Side Join)
        // Since entity_id is polymorphic (can be Exam or Deadline), we can't use standard SQL FK joins easily.
        const deadlineIds = reminders
            .filter((r) => r.entity_type === 'deadline')
            .map((r) => r.entity_id);

        const examIds = reminders
            .filter((r) => r.entity_type === 'exam')
            .map((r) => r.entity_id);

        let deadlinesMap: Record<string, string> = {};
        let examsMap: Record<string, string> = {};

        if (deadlineIds.length > 0) {
            const { data: deadlines } = await supabase
                .from('deadlines')
                .select('id, title')
                .in('id', deadlineIds);

            deadlines?.forEach((d) => { deadlinesMap[d.id] = d.title; });
        }

        if (examIds.length > 0) {
            const { data: exams } = await supabase
                .from('exams')
                .select('id, name') // Assuming 'name' describes the exam course
                .in('id', examIds);

            exams?.forEach((e) => { examsMap[e.id] = e.name; });
        }

        // 3. Fetch all subscriptions
        const { data: subscriptions, error: subError } = await supabase.from('push_subscriptions').select('*');
        if (subError) throw subError;

        let sentCount = 0;

        // 4. Send Notifications
        for (const reminder of reminders) {
            let title = 'Promemoria UniTracker';
            let body = 'Hai una scadenza in arrivo!';
            let entityName = '';

            if (reminder.entity_type === 'exam') {
                entityName = examsMap[reminder.entity_id];
                if (entityName) {
                    title = `🎓 ${entityName}`;
                    body = `Non dimenticare il tuo esame! In bocca al lupo 🍀`;
                }
            } else if (reminder.entity_type === 'deadline') {
                entityName = deadlinesMap[reminder.entity_id];
                if (entityName) {
                    title = `📅 ${entityName}`;
                    body = `Ricordati di questa scadenza!`;
                }
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
                }
            }

            await supabase.from('reminders').update({ is_sent: true }).eq('id', reminder.id);
        }

        return NextResponse.json({ success: true, sent: sentCount });

    } catch (err: unknown) {
        console.error('Cron job failed:', err);

        let errorMessage = 'Unknown error';
        let errorDetails = {};

        if (err instanceof Error) {
            errorMessage = err.message;
            errorDetails = { stack: err.stack, name: err.name };
        } else if (typeof err === 'object' && err !== null) {
            errorMessage = JSON.stringify(err, Object.getOwnPropertyNames(err));
            errorDetails = err;
        } else {
            errorMessage = String(err);
        }

        return NextResponse.json({
            error: errorMessage,
            details: errorDetails
        }, { status: 500 });
    }
}
