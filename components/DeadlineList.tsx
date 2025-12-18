'use client';

import { Deadline } from '@/types';
import { CalendarClock, CheckCircle2, Circle, Euro, FileText } from 'lucide-react';

interface DeadlineListProps {
    deadlines: Deadline[];
    onToggle: (id: string, currentStatus: boolean) => void;
    onEdit: (deadline: Deadline) => void;
}

export default function DeadlineList({ deadlines, onToggle, onEdit }: DeadlineListProps) {
    if (deadlines.length === 0) {
        return (
            <div className="text-center py-8 text-slate-500 border border-dashed border-slate-200 rounded-xl">
                Nessuna scadenza in programma 🎉
            </div>
        );
    }

    // Sort: Pending first (ordered by date asc), then Completed (ordered by date desc)
    const sorted = [...deadlines].sort((a, b) => {
        if (a.is_completed === b.is_completed) {
            const dateA = new Date(a.due_date).getTime();
            const dateB = new Date(b.due_date).getTime();
            return a.is_completed ? dateB - dateA : dateA - dateB;
        }
        return a.is_completed ? 1 : -1;
    });

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
            {sorted.map((item) => {
                const daysLeft = Math.ceil((new Date(item.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                const isUrgent = !item.is_completed && daysLeft >= 0 && daysLeft <= 7;
                const isLate = !item.is_completed && daysLeft < 0;

                return (
                    <div
                        key={item.id}
                        onClick={() => onEdit(item)}
                        className={`p-4 flex items-center justify-between group transition-colors cursor-pointer ${item.is_completed ? 'bg-slate-50 opacity-75' : 'hover:bg-slate-50/50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggle(item.id, item.is_completed);
                                }}
                                className={`text-slate-400 hover:text-emerald-500 transition-colors ${item.is_completed ? 'text-emerald-500' : ''}`}
                            >
                                {item.is_completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                            </button>

                            <div>
                                <h3 className={`font-semibold ${item.is_completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                                    {item.title}
                                </h3>
                                <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                    <span className="flex items-center gap-1">
                                        <CalendarClock size={14} />
                                        {new Date(item.due_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                                    </span>
                                    {item.amount && (
                                        <span className="flex items-center gap-1 font-medium text-slate-700">
                                            <Euro size={14} />
                                            {item.amount}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <FileText size={14} />
                                        Dettagli
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="text-right">
                            {item.is_completed ? (
                                <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                                    Pagato
                                </span>
                            ) : isLate ? (
                                <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                                    Scaduto!
                                </span>
                            ) : isUrgent ? (
                                <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                                    - {daysLeft} gg
                                </span>
                            ) : null}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
