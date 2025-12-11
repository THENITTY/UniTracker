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
