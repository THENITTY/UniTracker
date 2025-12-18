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
    const [reminders, setReminders] = useState<string[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

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
            if (reminders.length > 0) {
                const remindersToInsert = reminders.map(rDate => ({
                    entity_type: 'exam',
                    entity_id: data.id,
                    remind_at: rDate,
                    is_sent: false
                }));
                await supabase.from('reminders').insert(remindersToInsert);
            }

            const savedExam: Exam = {
                id: data.id,
                name: data.name,
                cfu: data.cfu,
                status: data.status,
                grade: data.grade,
                date: data.date,
                location: data.location,
                isPaidLocation: data.is_paid_location
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
                    {/* Selezione Corso */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Corso</label>
                        <select
                            value={selectedCourseId}
                            onChange={(e) => setSelectedCourseId(e.target.value)}
                            required
                            disabled={isSubmitting || !!initialData} // Disabilitiamo cambio corso in modifica per semplicità
                            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white text-slate-900"
                        >
                            <option value="">Seleziona un corso...</option>
                            {[1, 2, 3].map((year) => (
                                <optgroup key={year} label={`Anno ${year}`}>
                                    {coursesByYear[year]?.map((course) => (
                                        <option key={course.id} value={course.id}>
                                            {course.name}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    {/* CFU (Readonly) */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">CFU</label>
                        <input
                            type="number"
                            value={selectedCourse?.cfu || ''}
                            readOnly
                            className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
                        />
                    </div>

                    {/* Location / Sede */}
                    <div className="space-y-3 pt-2 border-t border-slate-50">
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm font-medium text-slate-700">Sede a pagamento/Extra?</span>
                            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPaidLocation ? 'bg-amber-500' : 'bg-slate-200'}`}>
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={isPaidLocation}
                                    onChange={(e) => setIsPaidLocation(e.target.checked)}
                                    disabled={isSubmitting}
                                />
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPaidLocation ? 'translate-x-6' : 'translate-x-1'}`} />
                            </div>
                        </label>

                        {isPaidLocation && (
                            <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                                <label className="text-sm font-medium text-slate-700">Città / Sede</label>
                                <input
                                    type="text"
                                    required={isPaidLocation}
                                    placeholder="Es. Milano, Roma, Sede Esterna..."
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    disabled={isSubmitting}
                                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-slate-900"
                                />
                            </div>
                        )}
                    </div>

                    {/* Status */}
                    <div className="space-y-1 pt-2 border-t border-slate-50">
                        <label className="text-sm font-medium text-slate-700">Stato</label>
                        <div className="flex gap-2 mt-1">
                            {/* Passed */}
                            <label className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${status === 'passed' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}>
                                <input
                                    type="radio"
                                    name="status"
                                    value="passed"
                                    checked={status === 'passed'}
                                    onChange={() => setStatus('passed')}
                                    disabled={isSubmitting}
                                    className="sr-only"
                                />
                                <span className="font-medium text-sm">Superato</span>
                            </label>

                            {/* Planned */}
                            <label className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${status === 'planned' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}>
                                <input
                                    type="radio"
                                    name="status"
                                    value="planned"
                                    checked={status === 'planned'}
                                    onChange={() => setStatus('planned')}
                                    disabled={isSubmitting}
                                    className="sr-only"
                                />
                                <span className="font-medium text-sm">Pianificato</span>
                            </label>

                            {/* Failed */}
                            <label className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${status === 'failed' ? 'bg-red-50 border-red-200 text-red-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}>
                                <input
                                    type="radio"
                                    name="status"
                                    value="failed"
                                    checked={status === 'failed'}
                                    onChange={() => setStatus('failed')}
                                    disabled={isSubmitting}
                                    className="sr-only"
                                />
                                <span className="font-medium text-sm">Non Superato</span>
                            </label>
                        </div>
                    </div>

                    {/* Fields for Passed exams */}
                    {status === 'passed' && (
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">
                                Voto (18-30)
                            </label>
                            <input
                                type="number"
                                min="18"
                                max="31"
                                value={grade}
                                onChange={(e) => setGrade(e.target.value)}
                                required={status === 'passed'}
                                disabled={isSubmitting}
                                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                            />
                            <p className="text-xs text-slate-400">31 per la Lode</p>
                        </div>
                    )}

                    {/* Date Field - Always visible */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">
                            Data {status === 'planned' ? '(Prevista)' : ''}
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required={status === 'passed' || status === 'failed'}
                            disabled={isSubmitting}
                            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                        />
                    </div>



                    {/* Reminders Section */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Promemoria</label>
                        <div className="flex flex-wrap gap-2">
                            {reminders.map((rem, idx) => {
                                const dateObj = new Date(rem);
                                if (isNaN(dateObj.getTime())) return null;
                                return (
                                    <span key={idx} className="bg-indigo-50 text-indigo-700 px-2 py-1.5 rounded-md text-sm flex items-center gap-1.5 border border-indigo-100 shadow-sm">
                                        <span className="text-xs font-medium">{dateObj.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                        <button
                                            type="button"
                                            onClick={() => setReminders(prev => prev.filter((_, i) => i !== idx))}
                                            className="text-indigo-400 hover:text-indigo-600"
                                        >
                                            <X size={14} />
                                        </button>
                                    </span>
                                );
                            })}
                            <input
                                type="datetime-local"
                                className="px-3 py-1.5 border border-slate-200 rounded-md text-sm outline-none focus:border-indigo-500 text-slate-600 bg-white"
                                onChange={(e) => {
                                    if (e.target.value) {
                                        setReminders(prev => [...prev, e.target.value]);
                                        e.target.value = '';
                                    }
                                }}
                            />
                        </div>
                        <p className="text-xs text-slate-400">Seleziona data e ora per ricevere una notifica.</p>
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
