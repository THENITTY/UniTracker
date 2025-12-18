import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import webpush from 'web-push';

// Requires service role to read all subscriptions and reminders securely
// For this MVP we act with user's keys but Cron usually runs server-side trusted.
// We'll use env vars.

// Supabase client will be initialized inside the handler to catch config errors



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

        // ... (rest of logic)

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
