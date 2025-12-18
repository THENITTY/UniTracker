'use client';

import { ALL_COURSES } from '@/lib/courses-data';
import { supabase } from '@/lib/supabase';
import { Exam } from '@/types';
import { Trash2, X } from 'lucide-react';
import { useState } from 'react';

interface AddExamFormProps {
    initialData?: Exam; // Se presente, siamo in modalità modifica
    onSave: (exam: Exam) => void;
    onDelete?: (examId: string) => void; // Callback per eliminazione
    onCancel: () => void;
}

export default function AddExamForm({ initialData, onSave, onDelete, onCancel }: AddExamFormProps) {
    // Se c'è initialData, pre-popoliamo. Per il courseId dobbiamo trovarlo dal nome o averlo salvato.
    // Dato che Supabase salva 'course_id', potremmo non averlo nel dominio Exam se non lo aggiungiamo.
    // Ma `name` è univoco nel nostro mock/DB solitamente. Per semplicità qui cerchiamo per nome
    // se non abbiamo l'ID del corso esplicito.
    const initialCourse = ALL_COURSES.find(c => c.name === initialData?.name);

    const [selectedCourseId, setSelectedCourseId] = useState(initialCourse?.id || '');
    const [status, setStatus] = useState<'passed' | 'planned' | 'failed'>(initialData?.status || 'passed');
    const [grade, setGrade] = useState<string>(initialData?.grade?.toString() || '');
    const [date, setDate] = useState(initialData?.date || '');

    // Location state
    const [isPaidLocation, setIsPaidLocation] = useState(initialData?.isPaidLocation || false);
    const [location, setLocation] = useState(initialData?.location || '');
    const [reminders, setReminders] = useState<{ id?: string, remind_at: string }[]>([]);
    const [remindersToDelete, setRemindersToDelete] = useState<string[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Fetch reminders if editing
    useState(() => {
        if (initialData?.id) {
            supabase
                .from('reminders')
                .select('*')
                .eq('entity_type', 'exam')
                .eq('entity_id', initialData.id)
                .eq('is_sent', false)
                .then(({ data }) => {
                    if (data) {
                        setReminders(data.map(r => ({ id: r.id, remind_at: r.remind_at })));
                    }
                });
        }
    });

    // Trova il corso selezionato
    const selectedCourse = ALL_COURSES.find((c) => c.id === selectedCourseId);

    // Raggruppa i corsi per anno
    const coursesByYear = ALL_COURSES.reduce((acc, course) => {
        if (!acc[course.year]) {
            acc[course.year] = [];
        }
        acc[course.year].push(course);
        return acc;
    }, {} as Record<number, typeof ALL_COURSES>);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCourse || isSubmitting) return;

        setIsSubmitting(true);

        const examPayload = {
            course_id: selectedCourse.id,
            name: selectedCourse.name,
            cfu: selectedCourse.cfu,
            status: status,
            grade: status === 'passed' && grade ? Number(grade) : null,
            date: date || null,
            location: location || null,
            is_paid_location: isPaidLocation
        };

        let data, error;

        if (initialData?.id) {
            // UPDATE
            const res = await supabase
                .from('exams')
                .update(examPayload)
                .eq('id', initialData.id)
                .select()
                .single();
            data = res.data;
            error = res.error;
        } else {
            // INSERT
            const res = await supabase
                .from('exams')
                .insert([examPayload])
                .select()
                .single();
            data = res.data;
            error = res.error;
        }

        if (error) {
            console.error('Error saving exam:', error);
            alert('Errore durante il salvataggio: ' + error.message);
            setIsSubmitting(false);
            return;
        }

        if (data) {
            // 3. Manage Reminders

            // Delete removed reminders
            if (remindersToDelete.length > 0) {
                await supabase.from('reminders').delete().in('id', remindersToDelete);
            }

            // Insert new reminders
            const newReminders = reminders.filter(r => !r.id);
            if (newReminders.length > 0) {
                const remindersToInsert = newReminders.map(r => ({
                    entity_type: 'exam',
                    entity_id: data.id,
                    remind_at: r.remind_at,
                    is_sent: false
                }));
                await supabase.from('reminders').insert(remindersToInsert);
            }

            // Refetch all reminders
            const { data: allReminders } = await supabase.from('reminders').select('*').eq('entity_id', data.id).eq('entity_type', 'exam').eq('is_sent', false);

            const savedExam: Exam = {
                id: data.id,
                name: data.name,
                cfu: data.cfu,
                status: data.status,
                grade: data.grade,
                date: data.date,
                location: data.location,
                isPaidLocation: data.is_paid_location,
                reminders: allReminders as import('@/types').Reminder[]
            };
            onSave(savedExam); // Chiude il form passando l'esame aggiornato
        }
        setIsSubmitting(false);
    };

    const handleDelete = async () => {
        if (!initialData?.id || !onDelete) return;
        if (!confirm('Sei sicuro di voler eliminare questo esame?')) return;

        setIsDeleting(true);
        const { error } = await supabase
            .from('exams')
            .delete()
            .eq('id', initialData.id);

        if (error) {
            alert('Errore eliminazione: ' + error.message);
            setIsDeleting(false);
            return;
        }

        onDelete(initialData.id);
        setIsDeleting(false);
    }

    // ... render return ...

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 sticky top-0">
                    <h2 className="text-lg font-semibold text-slate-800">
                        {initialData ? 'Modifica Esame' : 'Aggiungi Esame'}
                    </h2>
                    <div className="flex items-center gap-2">
                        {initialData && onDelete && (
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting || isSubmitting}
                                className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-50 mr-2"
                                title="Elimina"
                            >
                                <Trash2 size={20} />
                            </button>
                        )}
                        <button
                            onClick={onCancel}
                            disabled={isSubmitting || isDeleting}
                            className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Course Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Materia</label>
                        <select
                            value={selectedCourseId}
                            onChange={(e) => setSelectedCourseId(e.target.value)}
                            disabled={!!initialData} // Disabilita modifica corso se siamo in edit
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-900 transition-all font-medium text-slate-800"
                        >
                            <option value="">Seleziona un esame...</option>
                            {Object.entries(coursesByYear).map(([year, courses]) => (
                                <optgroup label={`${year}° Anno`} key={year}>
                                    {courses.map((course) => (
                                        <option key={course.id} value={course.id}>
                                            {course.name} ({course.cfu} CFU)
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    {/* Status Selection */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {(['planned', 'passed', 'failed'] as const).map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setStatus(s)}
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${status === s
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {s === 'planned' ? 'Pianificato' : s === 'passed' ? 'Superato' : 'Non Superato'}
                            </button>
                        ))}
                    </div>

                    {/* Grade & Date Row */}
                    <div className="flex gap-4">
                        {status === 'passed' && (
                            <div className="w-24 animate-in slide-in-from-left-2 fade-in">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Voto</label>
                                <input
                                    type="number"
                                    min="18"
                                    max="31"
                                    placeholder="18-30"
                                    value={grade}
                                    onChange={(e) => setGrade(e.target.value)}
                                    className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-center text-emerald-600"
                                />
                            </div>
                        )}
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Data Appello</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-900"
                            />
                        </div>
                    </div>

                    {/* Location fields */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="block text-xs font-medium text-slate-500">Luogo / Sede</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Es. Aula T1, Via Roma..."
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="flex-1 p-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-900"
                            />
                            <button
                                type="button"
                                onClick={() => setIsPaidLocation(!isPaidLocation)}
                                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${isPaidLocation
                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                € Sede Extra
                            </button>
                        </div>
                    </div>

                    {/* Reminders Section */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Promemoria</label>
                        <div className="flex flex-wrap gap-2">
                            {reminders.map((rem, idx) => {
                                const dateObj = new Date(rem.remind_at);
                                if (isNaN(dateObj.getTime())) return null;
                                return (
                                    <span key={idx} className="bg-indigo-50 text-indigo-700 px-2 py-1.5 rounded-md text-sm flex items-center gap-1.5 border border-indigo-100 shadow-sm animate-in fade-in zoom-in-95">
                                        <span className="text-xs font-medium">{dateObj.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (rem.id) {
                                                    setRemindersToDelete(prev => [...prev, rem.id!]);
                                                }
                                                setReminders(prev => prev.filter((_, i) => i !== idx));
                                            }}
                                            className="text-indigo-400 hover:text-indigo-600"
                                            title="Rimuovi"
                                        >
                                            <X size={14} />
                                        </button>
                                    </span>
                                );
                            })}
                            <div className="flex items-end gap-2 text-sm w-full">
                                <div className="flex-1">
                                    <label className="text-xs text-slate-500 mb-1 block">Giorno</label>
                                    <input
                                        type="date"
                                        id="exam-rem-date-input"
                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-md outline-none focus:border-indigo-500 text-slate-600 bg-white"
                                    />
                                </div>
                                <div className="w-24">
                                    <label className="text-xs text-slate-500 mb-1 block">Ora (default 09:00)</label>
                                    <input
                                        type="time"
                                        id="exam-rem-time-input"
                                        defaultValue="09:00"
                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-md outline-none focus:border-indigo-500 text-slate-600 bg-white"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const dateInput = document.getElementById('exam-rem-date-input') as HTMLInputElement;
                                        const timeInput = document.getElementById('exam-rem-time-input') as HTMLInputElement;

                                        if (dateInput.value) {
                                            const time = timeInput.value || '09:00';
                                            // Create Date from local components (YYYY-MM-DDTHH:mm is treated as local)
                                            // then convert to ISO UTC string for DB consistency
                                            const localDate = new Date(`${dateInput.value}T${time}`);
                                            const isoDate = localDate.toISOString();

                                            setReminders(prev => [...prev, { remind_at: isoDate }]);
                                            dateInput.value = '';
                                            timeInput.value = '09:00';
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-medium rounded-md hover:bg-indigo-100 transition-colors border border-indigo-200"
                                >
                                    Aggiungi
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
                        >
                            Annulla
                        </button>
                        <button
                            type="submit"
                            disabled={!selectedCourse || isSubmitting}
                            className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                        >
                            {isSubmitting ? (
                                <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                'Salva'
                            )}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}
