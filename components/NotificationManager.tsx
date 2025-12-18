'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export default function NotificationManager() {
    const [isSupported, setIsSupported] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            checkSubscription();
        }
    }, []);

    const checkSubscription = async () => {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
    };

    const subscribeUser = async () => {
        setIsLoading(true);
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;

            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidKey) {
                throw new Error('VAPID public key not found');
            }

            const convertedVapidKey = urlBase64ToUint8Array(vapidKey);
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            // Send subscription to server
            const res = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                body: JSON.stringify(subscription),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) throw new Error('Failed to save subscription');

            setIsSubscribed(true);
            alert('Notifiche attivate con successo! 🔔');

            // Send a test notification immediately (optional, or rely on cron)
            // await fetch('/api/cron/reminders'); 

        } catch (error: unknown) {
            console.error('Subscription failed', error);
            const msg = error instanceof Error ? error.message : 'Unknown error';
            alert('Errore attivazione notifiche: ' + msg);
        } finally {
            setIsLoading(false);
        }
    };

    const unsubscribeUser = async () => {
        setIsLoading(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                await subscription.unsubscribe();

                await fetch('/api/notifications/subscribe', {
                    method: 'DELETE',
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                    headers: { 'Content-Type': 'application/json' }
                });

                setIsSubscribed(false);
                alert('Notifiche disattivate.');
            }
        } catch (error: unknown) {
            console.error('Subscription failed', error);
            let msg = error instanceof Error ? error.message : 'Unknown error';

            if (msg.includes('push service error') || msg.includes('Registration failed')) {
                msg += ' (Chiave VAPID non valida o browser incompatibile. Controlla le variabili d\'ambiente su Vercel o prova Chrome).';
            }

            alert('Errore attivazione notifiche: ' + msg);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isSupported) return null; // Don't show if not supported (e.g. some old browsers)

    return (
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isSubscribed ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                    {isSubscribed ? <Bell size={20} /> : <BellOff size={20} />}
                </div>
                <div>
                    <h3 className="font-semibold text-slate-800">Notifiche Push</h3>
                    <p className="text-sm text-slate-500">
                        {isSubscribed ? 'Attive su questo dispositivo' : 'Ricevi avvisi per le scadenze'}
                    </p>
                </div>
            </div>

            <button
                onClick={isSubscribed ? unsubscribeUser : subscribeUser}
                disabled={isLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isSubscribed
                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
            >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> :
                    isSubscribed ? 'Disattiva' : 'Attiva ora'}
            </button>
        </div>
    );
}
