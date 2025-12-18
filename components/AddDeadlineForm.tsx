'use client';

import CategoryManager from './CategoryManager';
import { Deadline, DeadlineCategory } from '@/types';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Trash2, X, Plus, Settings2 } from 'lucide-react';

interface AddDeadlineFormProps {
    initialData?: Deadline;
    categories: DeadlineCategory[];
    onSave: (deadline: Deadline) => void;
    onDelete?: (id: string) => void;
    onCancel: () => void;
    onCategoriesUpdate: (newCats: DeadlineCategory[]) => void;
}

export default function AddDeadlineForm({ initialData, categories, onSave, onDelete, onCancel, onCategoriesUpdate }: AddDeadlineFormProps) {
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<string>('tax');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showCategoryManager, setShowCategoryManager] = useState(false);

    // Load initial data if editing
    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title);
            setDate(initialData.due_date);
            setAmount(initialData.amount ? String(initialData.amount) : '');
            setCategory(initialData.category);
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                title,
                due_date: date,
                amount: amount ? Number(amount) : null,
                category,
            };

            let data, error;

            if (initialData?.id) {
                // UPDATE
                const res = await supabase
                    .from('deadlines')
                    .update(payload)
                    .eq('id', initialData.id)
                    .select()
                    .single();
                data = res.data;
                error = res.error;
            } else {
                // INSERT
                const res = await supabase
                    .from('deadlines')
                    .insert([{ ...payload, is_completed: false }])
                    .select()
                    .single();
                data = res.data;
                error = res.error;
            }

            if (error) throw error;

            if (data) {
                onSave({
                    id: data.id,
                    title: data.title,
                    due_date: data.due_date,
                    amount: data.amount,
                    is_completed: data.is_completed,
                    category: data.category
                });
            }
        } catch (error: any) {
            console.error(error);
            alert('Errore nel salvataggio: ' + (error.message || 'Errore sconosciuto'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!initialData?.id || !onDelete) return;
        setIsSubmitting(true);

        try {
            const { error } = await supabase
                .from('deadlines')
                .delete()
                .eq('id', initialData.id);

            if (error) throw error;

            onDelete(initialData.id);
        } catch (error: any) {
            console.error(error);
            alert('Errore eliminazione: ' + error.message);
            setIsSubmitting(false);
        }
    };

    // Default categories if list is empty (fallback)
    const displayCategories = categories.length > 0 ? categories : [
        { id: 'tax', name: 'Tassa Universitaria' },
        { id: 'other', name: 'Altro / Varie' }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 shrink-0">
                    <h2 className="text-lg font-semibold text-slate-800">
                        {initialData ? 'Modifica Scadenza' : 'Aggiungi Scadenza'}
                    </h2>
                    <button
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto">
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">Titolo</label>
                            <input
                                type="text"
                                required
                                placeholder="Es. Seconda Rata"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full p-2 border border-slate-200 rounded-lg mt-1 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-sm font-medium text-slate-700">Data Scadenza</label>
                                <input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full p-2 border border-slate-200 rounded-lg mt-1 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-sm font-medium text-slate-700">Importo (€)</label>
                                <input
                                    type="number"
                                    placeholder="Opzionale"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full p-2 border border-slate-200 rounded-lg mt-1 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium text-slate-700">Categoria</label>
                                <button
                                    type="button"
                                    onClick={() => setShowCategoryManager(true)}
                                    className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium"
                                >
                                    <Settings2 size={12} />
                                    Gestisci
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                                {displayCategories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setCategory(cat.name)} // Saving the NAME as the key for simplicity as per requirement
                                        className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors text-left truncate ${category === cat.name ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        title={cat.name}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Delete Confirmation or Buttons */}
                        {showDeleteConfirm ? (
                            <div className="p-3 bg-red-50 rounded-lg border border-red-100 flex items-center justify-between">
                                <span className="text-sm text-red-700 font-medium">Sicuro di voler eliminare?</span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="px-3 py-1 text-xs font-medium text-slate-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-colors"
                                    >
                                        Annulla
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                    >
                                        Elimina
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="pt-4 flex gap-3">
                                {initialData && (
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="p-2 text-red-400 border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                                        title="Elimina"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    className="flex-1 py-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                                >
                                    Annulla
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Salvataggio...' : 'Salva'}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>

            {showCategoryManager && (
                <CategoryManager
                    categories={categories}
                    onClose={() => setShowCategoryManager(false)}
                    onUpdate={onCategoriesUpdate}
                />
            )}
        </div>
    );
}
