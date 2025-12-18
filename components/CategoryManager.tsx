'use client';

import { supabase } from '@/lib/supabase';
import { DeadlineCategory } from '@/types';
import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

interface CategoryManagerProps {
    categories: DeadlineCategory[];
    onClose: () => void;
    onUpdate: (newCategories: DeadlineCategory[]) => void;
}

export default function CategoryManager({ categories, onClose, onUpdate }: CategoryManagerProps) {
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;
        setIsSubmitting(true);

        try {
            const { data, error } = await supabase
                .from('deadline_categories')
                .insert([{ name: newCategoryName.trim() }])
                .select()
                .single();

            if (error) throw error;

            if (data) {
                onUpdate([...categories, data]);
                setNewCategoryName('');
            }
        } catch (error: any) {
            console.error('Error adding category:', error);
            alert('Errore aggiunta categoria: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Sei sicuro di voler eliminare questa categoria?')) return;

        try {
            const { error } = await supabase
                .from('deadline_categories')
                .delete()
                .eq('id', id);

            if (error) throw error;

            onUpdate(categories.filter(c => c.id !== id));
        } catch (error: any) {
            console.error('Error deleting category:', error);
            alert('Errore eliminazione: ' + error.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-semibold text-slate-800">Gestisci Categorie</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Add Form */}
                    <form onSubmit={handleAdd} className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Nuova categoria..."
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="flex-1 p-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                            type="submit"
                            disabled={isSubmitting || !newCategoryName.trim()}
                            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            <Plus size={20} />
                        </button>
                    </form>

                    {/* List */}
                    <div className="max-h-[300px] overflow-y-auto space-y-2">
                        {categories.length === 0 && (
                            <p className="text-center text-sm text-slate-400 py-4">Nessuna categoria personalizzata.</p>
                        )}
                        {categories.map((cat) => (
                            <div key={cat.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                                <button
                                    onClick={() => handleDelete(cat.id)}
                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
