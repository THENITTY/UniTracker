'use client';

import CategoryManager from './CategoryManager';
import { Deadline, DeadlineCategory, DeadlineItem } from '@/types';
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

interface DraftItem {
    id: string; // temp id for key
    amount: string;
    category: string;
    description: string;
}

export default function AddDeadlineForm({ initialData, categories, onSave, onDelete, onCancel, onCategoriesUpdate }: AddDeadlineFormProps) {
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [items, setItems] = useState<DraftItem[]>([
        { id: '1', amount: '', category: 'tax', description: '' }
    ]);
    const [reminders, setReminders] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showCategoryManager, setShowCategoryManager] = useState(false);

    // Load initial data if editing
    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title);
            setDate(initialData.due_date);

            if (initialData.items && initialData.items.length > 0) {
                setItems(initialData.items.map(i => ({
                    id: i.id,
                    amount: String(i.amount),
                    category: i.category,
                    description: i.description || ''
                })));
            } else {
                // Fallback for legacy single-item deadlines
                setItems([{
                    id: 'legacy',
                    amount: initialData.amount ? String(initialData.amount) : '',
                    category: initialData.category,
                    description: ''
                }]);
            }
        }
    }, [initialData]);

    const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const handleAddItem = () => {
        setItems(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            amount: '',
            category: 'tax',
            description: ''
        }]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length > 1) {
            setItems(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleItemChange = (index: number, field: keyof DraftItem, value: string) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // 1. Upsert Parent Deadline
            const payload = {
                title,
                due_date: date,
                amount: totalAmount,
                category: 'mixed', // Legacy field, now 'mixed' or maybe the first category?
            };

            let deadlineId = initialData?.id;
            let resultData;

            if (deadlineId) {
                // UPDATE Parent
                const res = await supabase
                    .from('deadlines')
                    .update(payload)
                    .eq('id', deadlineId)
                    .select()
                    .single();

                if (res.error) throw res.error;
                resultData = res.data;
            } else {
                // INSERT Parent
                const res = await supabase
                    .from('deadlines')
                    .insert([{ ...payload, is_completed: false }])
                    .select()
                    .single();

                if (res.error) throw res.error;
                deadlineId = res.data.id;
                resultData = res.data;
            }

            // 2. Manage Items (Delete all existing for this deadline and re-insert checks - simplified approach)
            // Ideally we should diff, but re-writing is safer for MVP to avoid sync issues

            // Delete old items
            await supabase.from('deadline_items').delete().eq('deadline_id', deadlineId);

            // Insert new items
            const itemsToInsert = items.map(item => ({
                deadline_id: deadlineId,
                amount: Number(item.amount) || 0,
                category: item.category,
                description: item.description
            }));

            const itemsRes = await supabase.from('deadline_items').insert(itemsToInsert).select();
            if (itemsRes.error) throw itemsRes.error;

            // 3. Manage Reminders
            if (reminders.length > 0) {
                const remindersToInsert = reminders.map(rDate => ({
                    entity_type: 'deadline',
                    entity_id: deadlineId,
                    remind_at: rDate,
                    is_sent: false
                }));
                await supabase.from('reminders').insert(remindersToInsert);
            }

            if (resultData) {
                const completeDeadline: Deadline = {
                    id: resultData.id,
                    title: resultData.title,
                    due_date: resultData.due_date,
                    amount: resultData.amount,
                    is_completed: resultData.is_completed,
                    category: resultData.category,
                    items: itemsRes.data as DeadlineItem[]
                };
                onSave(completeDeadline);
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
            // Items cascade delete usually, but let's be safe
            await supabase.from('deadline_items').delete().eq('deadline_id', initialData.id);

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
            <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
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
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Header Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <div>
                                <label className="text-sm font-medium text-slate-700">Data Scadenza</label>
                                <input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full p-2 border border-slate-200 rounded-lg mt-1 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        {/* Items Section */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium text-slate-700">Voci di Costo ({items.length})</label>
                                <div className="text-sm font-semibold text-slate-900 bg-slate-100 px-2 py-1 rounded">
                                    Totale: € {totalAmount}
                                </div>
                            </div>

                            <div className="space-y-3">
                                {items.map((item, index) => (
                                    <div key={item.id} className="flex gap-2 items-start p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    placeholder="Importo €"
                                                    required
                                                    value={item.amount}
                                                    onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                                                    className="w-24 p-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                                <select
                                                    value={item.category}
                                                    onChange={(e) => handleItemChange(index, 'category', e.target.value)}
                                                    className="flex-1 p-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                                >
                                                    {displayCategories.map(cat => (
                                                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Descrizione (opzionale)"
                                                value={item.description}
                                                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-600"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(index)}
                                            disabled={items.length === 1}
                                            className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-30 mt-1"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between mt-3">
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                >
                                    <Plus size={16} /> Aggiungi voce
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setShowCategoryManager(true)}
                                    className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-700"
                                >
                                    <Settings2 size={14} />
                                    Gestisci Categorie
                                </button>
                            </div>
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
                                <div className="flex items-end gap-2 text-sm w-full">
                                    <div className="flex-1">
                                        <label className="text-xs text-slate-500 mb-1 block">Giorno</label>
                                        <input
                                            type="date"
                                            id="rem-date-input"
                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-md outline-none focus:border-indigo-500 text-slate-600 bg-white"
                                        />
                                    </div>
                                    <div className="w-24">
                                        <label className="text-xs text-slate-500 mb-1 block">Ora (opz)</label>
                                        <input
                                            type="time"
                                            id="rem-time-input"
                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-md outline-none focus:border-indigo-500 text-slate-600 bg-white"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const dateInput = document.getElementById('rem-date-input') as HTMLInputElement;
                                            const timeInput = document.getElementById('rem-time-input') as HTMLInputElement;

                                            if (dateInput.value) {
                                                const time = timeInput.value || '11:30';
                                                const fullDate = `${dateInput.value}T${time}`;
                                                setReminders(prev => [...prev, fullDate]);
                                                dateInput.value = '';
                                                timeInput.value = '';
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-medium rounded-md hover:bg-indigo-100 transition-colors border border-indigo-200"
                                    >
                                        Aggiungi
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-slate-400">Se non imposti l'ora, sarà default 11:30.</p>
                        </div>

                        {/* Actions */}
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
                            <div className="pt-4 flex gap-3 border-t border-slate-100">
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
