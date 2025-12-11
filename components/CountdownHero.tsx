import { Exam } from '@/types';
import { AlertCircle, CalendarClock, Euro, Timer } from 'lucide-react';

interface CountdownHeroProps {
    title: string;
    date: string;
    type: 'exam' | 'deadline';
    daysRemaining: number;
}

export default function CountdownHero({ title, date, type, daysRemaining }: CountdownHeroProps) {
    if (daysRemaining < 0) return null;

    const isToday = daysRemaining === 0;
    const isTomorrow = daysRemaining === 1;

    // Urgency-based Color Logic
    let bgColor, accentColor, iconColor, textColor;

    // Common text styles for consistent high contrast on vivid backgrounds
    const baseIconColor = 'text-white/90';
    const baseTextColor = 'text-white';

    if (daysRemaining <= 7) {
        // Urgent: Vivid Red/Rose
        bgColor = 'bg-rose-600';
        accentColor = 'bg-rose-700';
    } else if (daysRemaining <= 15) {
        // Warning: Vivid Orange
        bgColor = 'bg-orange-500';
        accentColor = 'bg-orange-600';
    } else if (daysRemaining <= 30) {
        // Approaching: Vivid Indigo
        bgColor = 'bg-indigo-600';
        accentColor = 'bg-indigo-700';
    } else {
        // Safe: Vivid Emerald
        bgColor = 'bg-emerald-600';
        accentColor = 'bg-emerald-700';
    }

    iconColor = baseIconColor;
    textColor = baseTextColor;

    // Type-based Icon Selection (kept for distinction)
    const isExam = type === 'exam';
    // Icon Selection
    const MainIcon = isExam ? Timer : AlertCircle;
    const SecondaryIcon = isExam ? CalendarClock : Euro;

    // Dynamic Label Logic
    const isUrgent = daysRemaining <= 7;
    let labelText = '';

    if (isExam) {
        labelText = isUrgent ? 'Esame Imminente' : 'Prossimo Esame';
    } else {
        labelText = isUrgent ? 'Scadenza Imminente' : 'Prossima Scadenza';
    }

    return (
        <div className={`relative overflow-hidden ${bgColor} rounded-2xl p-6 md:p-8 text-white shadow-xl transition-colors duration-500`}>
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className={`absolute bottom-0 left-0 -mb-8 -ml-8 w-24 h-24 ${accentColor} rounded-full blur-xl`} />

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                    <div className={`flex items-center gap-2 ${iconColor} mb-2 font-medium`}>
                        <MainIcon size={20} />
                        <span>{labelText}</span>
                    </div>
                    <h2 className={`text-2xl md:text-4xl font-bold tracking-tight mb-2 ${textColor}`}>
                        {title}
                    </h2>
                    <div className="flex items-center gap-2 text-white/80 text-sm md:text-base font-medium">
                        <SecondaryIcon size={16} />
                        <span>
                            {new Date(date).toLocaleDateString('it-IT', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </span>
                    </div>
                </div>

                <div className="flex-shrink-0 bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-[140px] text-center border border-white/20 shadow-inner">
                    {isToday ? (
                        <div className="animate-pulse">
                            <div className="text-3xl font-bold text-white drop-shadow-md">OGGI</div>
                            <div className={`text-xs ${iconColor} mt-1`}>
                                {isExam ? 'In bocca al lupo! 🍀' : 'Da pagare subito! 💸'}
                            </div>
                        </div>
                    ) : isTomorrow ? (
                        <div>
                            <div className="text-3xl font-bold text-white drop-shadow-md">DOMANI</div>
                            <div className={`text-xs ${iconColor} mt-1 font-medium`}>Forza! 💪</div>
                        </div>
                    ) : (
                        <div>
                            <div className="text-4xl font-bold font-mono tracking-tighter text-white drop-shadow-md">
                                {daysRemaining}
                            </div>
                            <div className={`text-xs ${iconColor} font-medium uppercase tracking-wider mt-1`}>
                                Giorni Mancanti
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
