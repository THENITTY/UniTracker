'use client';

import AddDeadlineForm from '@/components/AddDeadlineForm';
import AddExamForm from '@/components/AddExamForm';
import CountdownHero from '@/components/CountdownHero';
import DeadlineList from '@/components/DeadlineList';
import NotificationManager from '@/components/NotificationManager';
import { supabase } from '@/lib/supabase';
import { Deadline, Exam } from '@/types';
import { BookOpen, Calendar, Coins, Euro, GraduationCap, MapPin, Plus, Trophy, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export default function Home() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [categories, setCategories] = useState<import('@/types').DeadlineCategory[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeadlineFormOpen, setIsDeadlineFormOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // Simulation State
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [simulatedGrades, setSimulatedGrades] = useState<Record<string, number>>({});

  // Fetch Data from Supabase
  const fetchData = async () => {
    setIsLoading(true);

    // 1. Fetch Exams
    const examsReq = supabase
      .from('exams')
      .select('*')
      .order('date', { ascending: false });

    // 2. Fetch Deadlines
    const deadlinesReq = supabase
      .from('deadlines')
      .select('*, deadline_items(*)')
      .order('due_date', { ascending: true });

    // 3. Fetch Categories
    const categoriesReq = supabase
      .from('deadline_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    const [examsRes, deadlinesRes, categoriesRes] = await Promise.all([examsReq, deadlinesReq, categoriesReq]);

    // Handle Exams
    if (examsRes.data) {
      const mappedExams: Exam[] = examsRes.data.map((e: any) => ({
        id: e.id,
        name: e.name,
        cfu: e.cfu,
        grade: e.grade,
        date: e.date,
        status: e.status,
        location: e.location,
        isPaidLocation: e.is_paid_location,
      }));
      setExams(mappedExams);
    }

    // Handle Deadlines
    if (deadlinesRes.data) {
      setDeadlines(deadlinesRes.data as Deadline[]);
    }

    // Handle Categories
    if (categoriesRes.data) {
      setCategories(categoriesRes.data);
    }

    if (examsRes.error) console.error(examsRes.error);
    if (deadlinesRes.error) console.error(deadlinesRes.error);
    if (categoriesRes.error) console.error(categoriesRes.error);

    setIsLoading(false);
  };

  // Initial Load
  useEffect(() => {
    fetchData();
  }, []);

  // 1. Calcolo Prossimo Esame
  const nextExamData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureExams = exams
      .filter(e => e.status === 'planned' && e.date)
      .map(e => {
        const date = new Date(e.date!);
        date.setHours(0, 0, 0, 0);
        return {
          title: e.name,
          date: date,
          daysRemaining: Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        };
      })
      .filter(e => e.date.getTime() >= today.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return futureExams.length > 0 ? futureExams[0] : null;
  }, [exams]);

  // 2. Calcolo Prossima Scadenza
  const nextDeadlineData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDeadlines = deadlines
      .filter(d => !d.is_completed)
      .map(d => {
        const date = new Date(d.due_date);
        date.setHours(0, 0, 0, 0);
        return {
          title: d.title,
          date: date,
          daysRemaining: Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        };
      })
      .filter(d => d.date.getTime() >= today.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return futureDeadlines.length > 0 ? futureDeadlines[0] : null;
  }, [deadlines]);

  // Calcoli Statistiche (con supporto Simulazione)
  const stats = useMemo(() => {
    // Esami realmente passati
    const passedExams = exams.filter((e) => e.status === 'passed' && e.grade);

    // Se siamo in simulazione, aggiungiamo quelli pianificati che hanno un voto simulato
    let examsToCalculate = [...passedExams];

    if (isSimulationMode) {
      const simulatedExams = exams.filter(e => e.status === 'planned' && simulatedGrades[e.id]);
      // Creiamo versioni "fittizie" degli esami con il voto simulato
      const mappedSimulated = simulatedExams.map(e => ({
        ...e,
        grade: simulatedGrades[e.id]
      }));
      examsToCalculate = [...examsToCalculate, ...mappedSimulated];
    }

    const totalCFU = 180; // Target standard
    const earnedCFU = examsToCalculate.reduce((acc, curr) => acc + curr.cfu, 0);

    const weightedSum = examsToCalculate.reduce(
      (acc, curr) => acc + (curr.grade || 0) * curr.cfu,
      0
    );
    const weightedAverage =
      earnedCFU > 0 ? weightedSum / earnedCFU : 0;

    const graduationProjection = (weightedAverage * 110) / 30;

    return {
      average: weightedAverage.toFixed(2),
      cfuProgress: earnedCFU,
      totalCFU,
      projection: graduationProjection.toFixed(1),
    };
  }, [exams, isSimulationMode, simulatedGrades]);

  // Logica Liste Esami
  const { plannedByMonth, passedExamsSorted } = useMemo(() => {
    // 1. Esami Passati o Falliti
    const history = exams
      .filter((e) => e.status === 'passed' || e.status === 'failed')
      .sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

    // 2. Esami Pianificati
    const planned = exams
      .filter((e) => e.status === 'planned')
      .sort((a, b) => {
        // Se uno non ha data, va in fondo
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

    // Raggruppamento per Mese
    const groupedPlanned: Record<string, Exam[]> = {};
    const monthFormatter = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });

    planned.forEach((exam) => {
      let key = 'Data da definire';
      if (exam.date) {
        const date = new Date(exam.date);
        key = monthFormatter.format(date);
        key = key.charAt(0).toUpperCase() + key.slice(1);
      }

      if (!groupedPlanned[key]) {
        groupedPlanned[key] = [];
      }
      groupedPlanned[key].push(exam);
    });

    return {
      passedExamsSorted: history,
      plannedByMonth: groupedPlanned,
    };
  }, [exams]);

  // HANDLERS
  const handleSaveExam = (savedExam: Exam) => {
    setExams((prev) => {
      const exists = prev.some(e => e.id === savedExam.id);
      if (exists) {
        return prev.map(e => e.id === savedExam.id ? savedExam : e);
      }
      return [savedExam, ...prev];
    });
    setIsFormOpen(false);
    setEditingExam(null);
  };

  const handleDeleteExam = (examId: string) => {
    setExams((prev) => prev.filter(e => e.id !== examId));
    setIsFormOpen(false);
    setEditingExam(null);
  };

  const handleSaveDeadline = (savedDeadline: Deadline) => {
    setDeadlines((prev) => {
      const exists = prev.some(d => d.id === savedDeadline.id);
      if (exists) {
        return prev.map(d => d.id === savedDeadline.id ? savedDeadline : d);
      }
      return [...prev, savedDeadline];
    });
    setIsDeadlineFormOpen(false);
    setEditingDeadline(null);
  };

  const handleDeleteDeadline = (id: string) => {
    setDeadlines((prev) => prev.filter(d => d.id !== id));
    setIsDeadlineFormOpen(false);
    setEditingDeadline(null);
  };

  const handleToggleDeadline = async (id: string, currentStatus: boolean) => {
    // Optimistic Update
    setDeadlines(prev => prev.map(d => d.id === id ? { ...d, is_completed: !currentStatus } : d));

    const { error } = await supabase
      .from('deadlines')
      .update({ is_completed: !currentStatus })
      .eq('id', id);

    if (error) {
      // Revert on error
      console.error("Error updating deadline", error);
      setDeadlines(prev => prev.map(d => d.id === id ? { ...d, is_completed: currentStatus } : d));
    }
  };

  const openEdit = (exam: Exam) => {
    setEditingExam(exam);
    setIsFormOpen(true);
  };

  return (
    <main className={`min-h-screen p-6 md:p-12 font-sans text-slate-900 transition-colors duration-500 ${isSimulationMode ? 'bg-indigo-50/50' : 'bg-slate-50'}`}>
      <div className="max-w-5xl mx-auto space-y-12 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              UniTracker
              {isSimulationMode && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">Simulatore Attivo</span>}
            </h1>
            <p className="text-slate-500 mt-1">
              La tua carriera universitaria sotto controllo
            </p>
            <div className="mt-4">
              <NotificationManager />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Simulation Toggle */}
            <div className="flex items-center gap-2 bg-white/50 p-1 rounded-lg border border-slate-200/60">
              <button
                onClick={() => {
                  setIsSimulationMode(false);
                  setSimulatedGrades({});
                }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${!isSimulationMode ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Reale
              </button>
              <button
                onClick={() => setIsSimulationMode(true)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${isSimulationMode ? 'bg-indigo-500 shadow-sm text-white' : 'text-slate-500 hover:text-indigo-600'}`}
              >
                <Wand2 size={14} />
                Simulatore
              </button>
            </div>

            <button
              onClick={() => {
                setEditingExam(null);
                setIsFormOpen(true);
              }}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-sm ml-2"
            >
              <Plus size={20} />
              <span className="font-medium hidden md:inline">Esame</span>
            </button>
          </div>
        </header>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12 text-slate-500">
            Caricamento dati...
          </div>
        )}

        {!isLoading && (
          <>
            {/* Countdown Widgets Stack */}
            <div className="space-y-4">
              {nextExamData && !isSimulationMode && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-700">
                  <CountdownHero
                    title={nextExamData.title}
                    date={nextExamData.date.toISOString()}
                    type="exam"
                    daysRemaining={nextExamData.daysRemaining}
                  />
                </div>
              )}
              {nextDeadlineData && !isSimulationMode && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-700">
                  <CountdownHero
                    title={nextDeadlineData.title}
                    date={nextDeadlineData.date.toISOString()}
                    type="deadline"
                    daysRemaining={nextDeadlineData.daysRemaining}
                  />
                </div>
              )}
            </div>


            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                icon={<BookOpen className={isSimulationMode ? "text-indigo-600" : "text-indigo-600"} />}
                label="Media Ponderata"
                value={stats.average}
                subtext={isSimulationMode ? "Media simulata" : "Su 30"}
                highlight={isSimulationMode}
              />
              <StatCard
                icon={<Trophy className="text-emerald-600" />}
                label="Progresso CFU"
                value={`${stats.cfuProgress} / ${stats.totalCFU}`}
                subtext={isSimulationMode ? "CFU simulati incl." : "Crediti acquisiti"}
                highlight={isSimulationMode}
              >
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-3">
                  <div
                    className={`${isSimulationMode ? 'bg-indigo-500' : 'bg-emerald-500'} h-1.5 rounded-full transition-colors duration-500`}
                    style={{ width: `${Math.min((stats.cfuProgress / stats.totalCFU) * 100, 100)}%` }}
                  />
                </div>
              </StatCard>
              <StatCard
                icon={<GraduationCap className="text-violet-600" />}
                label="Previsione Laurea"
                value={stats.projection}
                subtext="Base 110"
                highlight={isSimulationMode}
              />
            </div>

            {/* SEZIONE 1: DEADLINES / TASSE */}
            {!isSimulationMode && (
              <section className="space-y-4">
                <div className="flex justify-between items-end">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Euro className="text-slate-400" />
                    Scadenze e Tasse
                  </h2>
                  <button
                    onClick={() => setIsDeadlineFormOpen(true)}
                    className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    + Aggiungi
                  </button>
                </div>

                <DeadlineList
                  deadlines={deadlines}
                  onToggle={handleToggleDeadline}
                  onEdit={(deadline) => {
                    setEditingDeadline(deadline);
                    setIsDeadlineFormOpen(true);
                  }}
                />
              </section>
            )}

            {/* SEZIONE 2: In Arrivo (Pianificati) */}
            <section className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="text-slate-400" />
                Appelli in Arrivo
              </h2>

              {Object.keys(plannedByMonth).length === 0 && (
                <div className="bg-white rounded-xl p-8 text-center border border-slate-100 text-slate-500">
                  Nessun esame in programma. Pianificane uno!
                </div>
              )}

              {Object.entries(plannedByMonth).map(([month, exams]) => (
                <div key={month} className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider ml-1">
                    {month}
                  </h3>
                  <div className={`bg-white rounded-xl shadow-sm border overflow-hidden divide-y divide-slate-100 ${isSimulationMode ? 'border-indigo-200 ring-4 ring-indigo-50/50' : 'border-slate-100'}`}>
                    {exams.map((exam) => (
                      <ExamListItem
                        key={exam.id}
                        exam={exam}
                        onClick={() => openEdit(exam)}
                        isSimulationMode={isSimulationMode}
                        simulatedGrade={simulatedGrades[exam.id]}
                        onSimulate={(grade) => setSimulatedGrades(prev => ({ ...prev, [exam.id]: grade }))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {/* SEZIONE 3: Storico (Passati & Falliti) */}
            {passedExamsSorted.length > 0 && (
              <section className="space-y-4 pt-4 border-t border-slate-200">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="text-slate-400" />
                  Storico Esami
                </h2>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
                  {passedExamsSorted.map((exam) => (
                    <ExamListItem key={exam.id} exam={exam} onClick={() => openEdit(exam)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

      </div>

      {isFormOpen && (
        <AddExamForm
          initialData={editingExam || undefined}
          onSave={handleSaveExam}
          onDelete={handleDeleteExam}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingExam(null);
          }}
        />
      )}

      {isDeadlineFormOpen && (
        <AddDeadlineForm
          initialData={editingDeadline || undefined}
          categories={categories}
          onSave={handleSaveDeadline}
          onDelete={handleDeleteDeadline}
          onCategoriesUpdate={setCategories}
          onCancel={() => {
            setIsDeadlineFormOpen(false);
            setEditingDeadline(null);
          }}
        />
      )}
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtext,
  children,
  highlight = false
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  children?: React.ReactNode;
  highlight?: boolean
}) {
  return (
    <div className={`p-6 rounded-xl shadow-sm border transition-all duration-300 ${highlight ? 'bg-white border-indigo-200 shadow-md ring-1 ring-indigo-100 transform scale-[1.02]' : 'bg-white border-slate-100 hover:shadow-md'}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2 rounded-lg ${highlight ? 'bg-indigo-50' : 'bg-slate-50'}`}>{icon}</div>
      </div>
      <div>
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${highlight ? 'text-indigo-600' : 'text-slate-900'}`}>{value}</div>
        <div className="text-xs text-slate-400 mt-1">{subtext}</div>
        {children}
      </div>
    </div>
  );
}

interface ExamListItemProps {
  exam: Exam;
  onClick: () => void;
  isSimulationMode?: boolean;
  simulatedGrade?: number;
  onSimulate?: (grade: number) => void;
}

function ExamListItem({ exam, onClick, isSimulationMode, simulatedGrade, onSimulate }: ExamListItemProps) {
  return (
    <div
      onClick={!isSimulationMode ? onClick : undefined} // Disabilita click in simulazione per evitare conflitti con input
      className={`p-6 flex items-center justify-between transition-colors group ${!isSimulationMode ? 'hover:bg-slate-50/80 cursor-pointer' : ''}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`p-2 rounded-lg ${exam.status === 'passed'
            ? 'bg-emerald-100 text-emerald-700'
            : exam.status === 'failed'
              ? 'bg-red-100 text-red-700'
              : 'bg-slate-100 text-slate-400'
            }`}
        >
          <BookOpen size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">
              {exam.name}
            </h3>
            {exam.isPaidLocation && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                <Coins size={10} />
                Sede Extra
              </span>
            )}
          </div>
          <div className="flex gap-3 text-sm text-slate-500 mt-1">
            <span className="flex items-center gap-1">
              CFU: {exam.cfu}
            </span>
            {exam.date && <span>• {new Date(exam.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</span>}
            {exam.location && (
              <span className="flex items-center gap-1">
                • <MapPin size={12} /> {exam.location}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="text-right">
        {isSimulationMode && exam.status === 'planned' ? (
          <div className="flex flex-col items-end gap-1 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Voto ipotetico</span>
              <input
                type="number"
                min="18"
                max="30"
                placeholder="-"
                onClick={(e) => e.stopPropagation()}
                value={simulatedGrade || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && onSimulate) {
                    // Allow input of any number, validation happens on calculation/blur if needed
                    // We only cap at 33 just to prevent absurd numbers, but allowing 1-30 is consistent
                    if (val <= 33) {
                      onSimulate(val);
                    }
                  } else if (e.target.value === '' && onSimulate) {
                    // @ts-ignore
                    onSimulate(undefined);
                  }
                }}
                className="w-16 p-1 text-center font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        ) : (
          <>
            {exam.status === 'passed' ? (
              <>
                <div className="text-2xl font-bold text-indigo-600">
                  {exam.grade}
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Superato
                </span>
              </>
            ) : exam.status === 'failed' ? (
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                Non Superato
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                Pianificato
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
