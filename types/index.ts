export interface Exam {
    id: string;
    name: string;
    cfu: number;
    grade?: number; // Opzionale perché potrebbe non essere ancora dato
    date?: string; // Opzionale
    status: 'passed' | 'planned' | 'failed';
    location?: string; // Sede d'esame
    isPaidLocation?: boolean; // Se la sede comporta costi extra
}

export interface Deadline {
    id: string;
    title: string;
    due_date: string;
    amount: number;
    is_completed: boolean;
    category: string;
}

export interface DeadlineCategory {
    id: string;
    name: string;
    sort_order?: number;
}
