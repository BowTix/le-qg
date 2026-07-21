import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { ArrowLeft, Plus, Trash2, Edit3, Save, X, BookOpen, HelpCircle, Check, Calendar, ChevronLeft, ChevronRight, Search, ClipboardCheck } from 'lucide-react';
import ProposalModeration from './admin/ProposalModeration';

export default function AdminScreen({ onBack }) {
  const [activeTab, setActiveTab] = useState('themes'); // 'themes' | 'daily'

  // Theme & Question States
  const [packs, setPacks] = useState([]);
  const [selectedPackId, setSelectedPackId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [proposals, setProposals] = useState([]);
  const [moderatingId, setModeratingId] = useState(null);

  // Pack Form State
  const [newPackName, setNewPackName] = useState('');
  const [newPackDesc, setNewPackDesc] = useState('');

  // Question Form State
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [questionText, setQuestionText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOpt, setCorrectOpt] = useState('A');
  const [showQuestionForm, setShowQuestionForm] = useState(false);

  // Daily Quiz Calendar States
  const [scheduledQuizzes, setScheduledQuizzes] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Daily Quiz Modal State
  const [selectedDayStr, setSelectedDayStr] = useState(null);
  const [selectedQuizDetails, setSelectedQuizDetails] = useState(null);

  // Daily Quiz Scheduling slots
  const [q1, setQ1] = useState(null);
  const [q2, setQ2] = useState(null);
  const [q3, setQ3] = useState(null);

  // Search dropdown queries & states
  const [searchQuery1, setSearchQuery1] = useState('');
  const [searchQuery2, setSearchQuery2] = useState('');
  const [searchQuery3, setSearchQuery3] = useState('');
  const [showDropdown1, setShowDropdown1] = useState(false);
  const [showDropdown2, setShowDropdown2] = useState(false);
  const [showDropdown3, setShowDropdown3] = useState(false);

  useEffect(() => {
    fetchPacks();
  }, []);

  useEffect(() => {
    if (selectedPackId) {
      fetchQuestions(selectedPackId);
    } else {
      setQuestions([]);
    }
  }, [selectedPackId]);

  useEffect(() => {
    if (activeTab === 'moderation') {
      fetchProposals();
    }
    if (activeTab === 'daily') {
      fetchScheduledQuizzes();
      fetchAllQuestions();
    }
  }, [activeTab]);

  const fetchPacks = async () => {
    try {
      const data = await api.get('/admin/packs');
      setPacks(data);
      if (data.length > 0 && !selectedPackId) {
        setSelectedPackId(data[0].id);
      }
    } catch (err) {
      setError("Impossible de charger les packs.");
    }
  };

  const fetchQuestions = async (packId) => {
    setLoading(true);
    try {
      const data = await api.get('/admin/questions', { pack_id: packId });
      setQuestions(data);
    } catch (err) {
      setError("Impossible de charger les questions du pack.");
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduledQuizzes = async () => {
    try {
      const data = await api.get('/admin/daily-quizzes');
      if (data.success) {
        setScheduledQuizzes(data.quizzes);
      }
    } catch (err) {
      setError("Impossible de charger les quiz planifiés.");
    }
  };

  const fetchAllQuestions = async () => {
    try {
      const data = await api.get('/admin/questions');
      if (data.success) {
        setAllQuestions(data.questions);
      }
    } catch (err) {
      setError("Impossible de charger toutes les questions.");
    }
  };

  // Pack CRUD
  const handleCreatePack = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!newPackName.trim()) return;

    try {
      const res = await api.post('/admin/packs', { name: newPackName, description: newPackDesc });
      setSuccess(res.message);
      setNewPackName('');
      setNewPackDesc('');
      await fetchPacks();
    } catch (err) {
      setError(err.message || "Erreur de création du pack.");
    }
  };

  const handleDeletePack = async (packId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce pack et toutes ses questions ?")) return;
    setError('');
    setSuccess('');
    try {
      const res = await api.delete('/admin/packs', { pack_id: packId });
      setSuccess(res.message);
      if (selectedPackId === packId) {
        setSelectedPackId(null);
      }
      await fetchPacks();
    } catch (err) {
      setError(err.message || "Erreur de suppression du pack.");
    }
  };

  const handleValidatePack = async (packId) => {
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/admin/packs/validate', { pack_id: packId });
      setSuccess(res.message);
      await fetchPacks();
    } catch (err) {
      setError(err.message || "Erreur lors de la validation du pack.");
    }
  };

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/question-proposals');
      setProposals(data.proposals || []);
    } catch (err) {
      setError(err.message || 'Impossible de charger les propositions.');
    } finally {
      setLoading(false);
    }
  };

  const handleModerateProposal = async (id, action) => {
    setModeratingId(id);
    setError('');
    setSuccess('');
    try {
      const result = await api.post('/admin/question-proposals', { id, action });
      setSuccess(result.message);
      setProposals(current => current.filter(proposal => proposal.id !== id));
      if (action === 'approve') {
        fetchPacks();
        if (selectedPackId) fetchQuestions(selectedPackId);
      }
    } catch (err) {
      setError(err.message || 'Impossible de traiter cette proposition.');
    } finally {
      setModeratingId(null);
    }
  };

  // Question CRUD
  const handleOpenQuestionForm = (q = null) => {
    setError('');
    setSuccess('');
    if (q) {
      setEditingQuestionId(q.id);
      setQuestionText(q.question_text);
      setOptA(q.opt_a);
      setOptB(q.opt_b);
      setOptC(q.opt_c);
      setOptD(q.opt_d);
      setCorrectOpt(q.correct_opt);
    } else {
      setEditingQuestionId(null);
      setQuestionText('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      setCorrectOpt('A');
    }
    setShowQuestionForm(true);
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const payload = {
      pack_id: selectedPackId,
      question_text: questionText,
      opt_a: optA,
      opt_b: optB,
      opt_c: optC,
      opt_d: optD,
      correct_opt: correctOpt
    };

    try {
      let res;
      if (editingQuestionId) {
        res = await api.put('/admin/questions', { ...payload, id: editingQuestionId });
      } else {
        res = await api.post('/admin/questions', payload);
      }
      setSuccess(res.message);
      setShowQuestionForm(false);
      fetchQuestions(selectedPackId);
      fetchPacks();
    } catch (err) {
      setError(err.message || "Erreur lors de l'enregistrement de la question.");
    }
  };

  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm("Supprimer cette question ?")) return;
    setError('');
    setSuccess('');
    try {
      const res = await api.delete('/admin/questions', { id: qId });
      setSuccess(res.message);
      fetchQuestions(selectedPackId);
      fetchPacks();
    } catch (err) {
      setError(err.message || "Erreur de suppression.");
    }
  };

  // Calendar helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayIndex = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1; // Adjust Monday to 0
  };

  const nextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const formatDateString = (year, month, day) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  const handleOpenDayModal = (dayStr, existingQuiz) => {
    setSelectedDayStr(dayStr);
    setSelectedQuizDetails(existingQuiz);
    if (existingQuiz) {
      // Load existing
      setQ1(null);
      setQ2(null);
      setQ3(null);
    } else {
      setQ1(null);
      setQ2(null);
      setQ3(null);
      setSearchQuery1('');
      setSearchQuery2('');
      setSearchQuery3('');
    }
  };

  const handleScheduleDailyQuiz = async (e) => {
    e.preventDefault();
    if (!q1 || !q2 || !q3) {
      setError("Veuillez sélectionner les 3 questions.");
      return;
    }
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/admin/daily-quizzes', {
        date: selectedDayStr,
        q1_id: q1.id,
        q2_id: q2.id,
        q3_id: q3.id
      });
      if (res.success) {
        setSuccess(res.message);
        setSelectedDayStr(null);
        fetchScheduledQuizzes();
      }
    } catch (err) {
      setError(err.message || "Erreur de planification.");
    }
  };

  const handleDeleteDailyQuiz = async (dateStr) => {
    if (!window.confirm(`Supprimer la planification du quiz pour le ${dateStr} ?`)) return;
    setError('');
    setSuccess('');
    try {
      const res = await api.delete('/admin/daily-quizzes', { date: dateStr });
      if (res.success) {
        setSuccess(res.message);
        setSelectedDayStr(null);
        fetchScheduledQuizzes();
      }
    } catch (err) {
      setError(err.message || "Erreur de suppression.");
    }
  };

  const getOtherDaysScheduledIds = () => {
    const ids = [];
    scheduledQuizzes.forEach(q => {
      if (q.date !== selectedDayStr) {
        if (q.q1_id) ids.push(parseInt(q.q1_id));
        if (q.q2_id) ids.push(parseInt(q.q2_id));
        if (q.q3_id) ids.push(parseInt(q.q3_id));
      }
    });
    return ids;
  };

  const handleRandomFill = () => {
    const excludedIds = getOtherDaysScheduledIds();
    const available = allQuestions.filter(item => !excludedIds.includes(item.id));

    if (available.length < 3) {
      alert("Il n'y a pas assez de questions disponibles non-planifiées sur d'autres jours (minimum 3).");
      return;
    }
    const shuffled = [...available].sort(() => 0.5 - Math.random());
    setQ1(shuffled[0]);
    setQ2(shuffled[1]);
    setQ3(shuffled[2]);
  };

  const getFilteredQuestions = (query, slotIndex) => {
    const excludedIds = getOtherDaysScheduledIds();
    if (slotIndex !== 1 && q1) excludedIds.push(q1.id);
    if (slotIndex !== 2 && q2) excludedIds.push(q2.id);
    if (slotIndex !== 3 && q3) excludedIds.push(q3.id);

    const available = allQuestions.filter(item => !excludedIds.includes(item.id));

    if (!query) return available;
    const q = query.toLowerCase();
    return available.filter(item =>
      item.question_text.toLowerCase().includes(q) ||
      item.pack_name.toLowerCase().includes(q)
    );
  };

  const renderCalendarCells = () => {
    const daysInMonth = getDaysInMonth(calendarDate);
    const firstDayIdx = getFirstDayIndex(calendarDate);
    const cells = [];

    // Empty cells
    for (let i = 0; i < firstDayIdx; i++) {
      cells.push(<div key={`empty-${i}`} style={{ backgroundColor: 'transparent' }}></div>);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDateString(calendarDate.getFullYear(), calendarDate.getMonth(), day);
      const isToday = dateStr === todayStr;
      const scheduledQuiz = scheduledQuizzes.find(q => q.date === dateStr);

      cells.push(
        <div
          key={`day-${day}`}
          onClick={() => handleOpenDayModal(dateStr, scheduledQuiz)}
          style={{
            minHeight: '100px',
            borderRadius: '12px',
            border: isToday ? '2px solid var(--accent)' : '1px solid var(--border-color)',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer',
            backgroundColor: scheduledQuiz ? 'rgba(0, 255, 157, 0.03)' : 'var(--bg-card)',
            boxShadow: isToday ? '0 0 10px rgba(255, 247, 0, 0.15)' : 'none',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          className="calendar-day-cell"
        >
          <span style={{
            fontSize: '1.05rem',
            fontWeight: isToday ? 'bold' : '600',
            color: isToday ? 'var(--accent)' : 'inherit'
          }}>
            {day}
          </span>
          {scheduledQuiz ? (
            <div style={{
              backgroundColor: 'rgba(0, 255, 157, 0.1)',
              border: '1px solid rgba(0, 255, 157, 0.3)',
              color: 'var(--success)',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              fontWeight: '600',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}>
              <Check size={12} /> Planifié
            </div>
          ) : (
            <div style={{
              color: 'var(--text-secondary)',
              fontSize: '0.7rem',
              textAlign: 'center',
              opacity: 0.6
            }}>
              + Planifier
            </div>
          )}
        </div>
      );
    }

    return cells;
  };

  return (
    <div className="container animate-slide-up" style={{ gap: '32px' }}>

      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Retour Dashboard
        </button>
        <h2 style={{ fontSize: '1.8rem', color: '#fb7185', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.04em' }}>
          🛡️ Espace Administrateur
        </h2>
      </div>

      {/* Tabs navigation - Segmented controller layout */}
      <div style={{
        display: 'flex',
        background: 'rgba(15, 23, 42, 0.35)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '14px',
        padding: '4px',
        gap: '4px',
        width: 'fit-content',
        marginTop: '-10px',
        fontFamily: "'Manrope', sans-serif"
      }}>
        <button
          onClick={() => { setActiveTab('themes'); setError(''); setSuccess(''); }}
          style={{
            padding: '8px 16px',
            backgroundColor: activeTab === 'themes' ? 'rgba(45, 212, 191, 0.15)' : 'transparent',
            border: 'none',
            color: activeTab === 'themes' ? '#2dd4bf' : '#aab7ce',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            borderRadius: '10px',
            transition: 'all 0.2s ease'
          }}
        >
          📚 Gestion des Thèmes
        </button>
        <button className={`admin-moderation-tab ${activeTab === 'moderation' ? 'is-active' : ''}`} onClick={() => { setActiveTab('moderation'); setError(''); setSuccess(''); }}>
          <ClipboardCheck size={16} /> Questions a valider {proposals.length > 0 && <span>{proposals.length}</span>}
        </button>
        <button
          onClick={() => { setActiveTab('daily'); setError(''); setSuccess(''); }}
          style={{
            padding: '8px 16px',
            backgroundColor: activeTab === 'daily' ? 'rgba(45, 212, 191, 0.15)' : 'transparent',
            border: 'none',
            color: activeTab === 'daily' ? '#2dd4bf' : '#aab7ce',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            borderRadius: '10px',
            transition: 'all 0.2s ease'
          }}
        >
          📅 Quiz du Jour (Calendrier)
        </button>
      </div>

      {/* Message alerts */}
      {error && <div style={{ backgroundColor: 'rgba(251,113,133,0.06)', color: '#fb7185', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(251,113,133,0.15)' }}>{error}</div>}
      {success && <div style={{ backgroundColor: 'rgba(45,212,191,0.06)', color: '#2dd4bf', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(45,212,191,0.15)' }}>{success}</div>}

      {/* ACTIVE TAB CONTENT */}
      {activeTab === 'themes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', md: '1fr 2fr', gap: '32px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>

          {/* Left Side: Packs CRUD */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Create Pack Form */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} style={{ color: 'var(--accent)' }} />
                Nouveau Pack
              </h3>
              <form onSubmit={handleCreatePack} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Nom du pack (ex: Cinéma)"
                  value={newPackName}
                  onChange={(e) => setNewPackName(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Description rapide"
                  value={newPackDesc}
                  onChange={(e) => setNewPackDesc(e.target.value)}
                />
                <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                  Créer le Pack
                </button>
              </form>
            </div>

            {/* Packs list */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <BookOpen size={18} style={{ color: 'var(--accent)' }} />
                Packs Existants
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '350px' }}>
                {packs.map(p => {
                  const isValidated = parseInt(p.is_validated) === 1;

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPackId(p.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '16px',
                        backgroundColor: selectedPackId === p.id ? 'rgba(45, 212, 191, 0.08)' : 'var(--bg-input)',
                        border: `1px solid ${selectedPackId === p.id ? '#2dd4bf' : 'var(--border-color)'}`,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'var(--transition-smooth)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.95rem' }}>{p.name}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {p.question_count} questions {p.creator_username && `| par ${p.creator_username}`}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          {!isValidated && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleValidatePack(p.id); }}
                              style={{ background: 'transparent', border: 'none', color: 'var(--success)', cursor: 'pointer', padding: '4px' }}
                              title="Approuver et publier le pack"
                            >
                              <Check size={18} />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeletePack(p.id); }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
                            title="Supprimer le pack"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Status indicator */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                        {isValidated ? (
                          <span style={{ color: 'var(--success)', fontWeight: 600 }}>Validé (Public)</span>
                        ) : (
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>En attente de validation</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Side: Questions CRUD */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '400px' }}>

            {selectedPackId ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HelpCircle size={20} style={{ color: 'var(--accent)' }} />
                    Questions du pack ({questions.length})
                  </h3>
                  <button className="btn-primary" onClick={() => handleOpenQuestionForm(null)} style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
                    <Plus size={16} />
                    Ajouter Question
                  </button>
                </div>

                {/* Questions list */}
                {loading ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flexGrow: 1, maxHeight: '550px', paddingRight: '8px' }}>
                    {questions.map((q, i) => (
                      <div key={q.id} style={{
                        padding: '16px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '16px'
                      }}>
                        <div style={{ flexGrow: 1 }}>
                          <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '8px' }}>{i + 1}. {q.question_text}</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span style={{ color: q.correct_opt === 'A' ? 'var(--success)' : 'inherit' }}>A: {q.opt_a}</span>
                            <span style={{ color: q.correct_opt === 'B' ? 'var(--success)' : 'inherit' }}>B: {q.opt_b}</span>
                            <span style={{ color: q.correct_opt === 'C' ? 'var(--success)' : 'inherit' }}>C: {q.opt_c}</span>
                            <span style={{ color: q.correct_opt === 'D' ? 'var(--success)' : 'inherit' }}>D: {q.opt_d}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                          <button
                            onClick={() => handleOpenQuestionForm(q)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '4px' }}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {questions.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        Aucune question dans ce pack. Cliquez sur "Ajouter Question" pour commencer !
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flex1: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                Sélectionnez ou créez un pack pour gérer ses questions.
              </div>
            )}

          </div>

        </div>
      )}

      {activeTab === 'moderation' && (
        <ProposalModeration proposals={proposals} loading={loading} moderatingId={moderatingId} onModerate={handleModerateProposal} />
      )}

      {activeTab === 'daily' && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Calendar Header Control */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
            <h3 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
              <Calendar size={22} style={{ color: 'var(--accent)' }} />
              Planification des Quiz Quotidiens
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="btn-secondary" onClick={prevMonth} style={{ padding: '8px' }}>
                <ChevronLeft size={18} />
              </button>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', minWidth: '150px', textAlign: 'center' }}>
                {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
              </span>
              <button className="btn-secondary" onClick={nextMonth} style={{ padding: '8px' }}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Monthly Calendar Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Weekdays Labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center' }}>
              {weekDays.map(wd => (
                <div key={wd} style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', padding: '4px 0' }}>
                  {wd}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
              {renderCalendarCells()}
            </div>
          </div>

        </div>
      )}

      {/* QUESTION FORM MODAL */}
      {showQuestionForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 100,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}>
          <div className="glass-card animate-slide-up" style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.04em' }}>
                {editingQuestionId ? "Modifier la Question" : "Ajouter une Question"}
              </h3>
              <button
                onClick={() => setShowQuestionForm(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Texte de la Question
                </label>
                <input
                  type="text"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Quelle est la capitale du..."
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Option A</label>
                  <input type="text" value={optA} onChange={(e) => setOptA(e.target.value)} placeholder="Option A" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Option B</label>
                  <input type="text" value={optB} onChange={(e) => setOptB(e.target.value)} placeholder="Option B" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Option C</label>
                  <input type="text" value={optC} onChange={(e) => setOptC(e.target.value)} placeholder="Option C" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Option D</label>
                  <input type="text" value={optD} onChange={(e) => setOptD(e.target.value)} placeholder="Option D" required />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Bonne Réponse
                </label>
                <select value={correctOpt} onChange={(e) => setCorrectOpt(e.target.value)}>
                  <option value="A">Option A</option>
                  <option value="B">Option B</option>
                  <option value="C">Option C</option>
                  <option value="D">Option D</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowQuestionForm(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  <Save size={18} />
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DAILY QUIZ DAY PLANNING MODAL */}
      {selectedDayStr && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 100,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}>
          <div className="glass-card animate-slide-up" style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.04em' }}>
                📅 Quiz du {selectedDayStr}
              </h3>
              <button
                onClick={() => setSelectedDayStr(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {selectedQuizDetails ? (
              // Quiz déjà planifié
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  backgroundColor: 'rgba(0, 255, 157, 0.05)',
                  border: '1px solid rgba(0, 255, 157, 0.2)',
                  color: 'var(--success)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}>
                  Un Quiz du Jour est déjà planifié pour cette date !
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}>
                    <small style={{ color: 'var(--text-secondary)' }}>Question 1</small>
                    <p style={{ fontWeight: 600, marginTop: '4px' }}>{selectedQuizDetails.q1_text}</p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent)', textTransform: 'uppercase' }}>{selectedQuizDetails.q1_type}</span>
                  </div>
                  <div style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}>
                    <small style={{ color: 'var(--text-secondary)' }}>Question 2</small>
                    <p style={{ fontWeight: 600, marginTop: '4px' }}>{selectedQuizDetails.q2_text}</p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent)', textTransform: 'uppercase' }}>{selectedQuizDetails.q2_type}</span>
                  </div>
                  <div style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}>
                    <small style={{ color: 'var(--text-secondary)' }}>Question 3</small>
                    <p style={{ fontWeight: 600, marginTop: '4px' }}>{selectedQuizDetails.q3_text}</p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent)', textTransform: 'uppercase' }}>{selectedQuizDetails.q3_type}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                  <button className="btn-secondary" onClick={() => setSelectedDayStr(null)}>
                    Fermer
                  </button>
                  <button className="btn-primary" style={{ backgroundColor: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => handleDeleteDailyQuiz(selectedDayStr)}>
                    <Trash2 size={16} /> Supprimer la planification
                  </button>
                </div>
              </div>
            ) : (
              // Planifier un nouveau quiz
              <form onSubmit={handleScheduleDailyQuiz} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Sélectionnez 3 questions pour créer le quiz quotidien. Recherchez par mot-clé ou nom de pack.
                  </p>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleRandomFill}
                    style={{ fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    🎲 Remplir Aléatoirement
                  </button>
                </div>

                {/* SLOT 1 */}
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Question 1</label>
                  {q1 ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--accent)', borderRadius: '8px', backgroundColor: 'rgba(255,247,0,0.03)' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{q1.question_text}</p>
                        <small style={{ color: 'var(--text-secondary)' }}>{q1.pack_name} ({q1.question_type})</small>
                      </div>
                      <button type="button" onClick={() => setQ1(null)} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Rechercher une question..."
                        value={searchQuery1}
                        onChange={(e) => { setSearchQuery1(e.target.value); setShowDropdown1(true); }}
                        onFocus={() => setShowDropdown1(true)}
                        style={{ paddingLeft: '36px' }}
                      />
                      <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />

                      {showDropdown1 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0,
                          backgroundColor: '#1E1E1E', border: '1px solid var(--border-color)', borderRadius: '8px',
                          maxHeight: '180px', overflowY: 'auto', zIndex: 10, marginTop: '4px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}>
                          {getFilteredQuestions(searchQuery1, 1).map(q => (
                            <div
                              key={q.id}
                              onClick={() => { setQ1(q); setShowDropdown1(false); }}
                              style={{ padding: '10px 12px', borderBottom: '1px solid #2A2A2A', cursor: 'pointer', transition: 'background 0.2s' }}
                              className="dropdown-item-hover"
                            >
                              <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0 }}>{q.question_text}</p>
                              <small style={{ color: 'var(--text-secondary)' }}>{q.pack_name} | {q.question_type}</small>
                            </div>
                          ))}
                          {getFilteredQuestions(searchQuery1, 1).length === 0 && (
                            <div style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Aucune question trouvée.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* SLOT 2 */}
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Question 2</label>
                  {q2 ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--accent)', borderRadius: '8px', backgroundColor: 'rgba(255,247,0,0.03)' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{q2.question_text}</p>
                        <small style={{ color: 'var(--text-secondary)' }}>{q2.pack_name} ({q2.question_type})</small>
                      </div>
                      <button type="button" onClick={() => setQ2(null)} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Rechercher une question..."
                        value={searchQuery2}
                        onChange={(e) => { setSearchQuery2(e.target.value); setShowDropdown2(true); }}
                        onFocus={() => setShowDropdown2(true)}
                        style={{ paddingLeft: '36px' }}
                      />
                      <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />

                      {showDropdown2 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0,
                          backgroundColor: '#1E1E1E', border: '1px solid var(--border-color)', borderRadius: '8px',
                          maxHeight: '180px', overflowY: 'auto', zIndex: 10, marginTop: '4px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}>
                          {getFilteredQuestions(searchQuery2, 2).map(q => (
                            <div
                              key={q.id}
                              onClick={() => { setQ2(q); setShowDropdown2(false); }}
                              style={{ padding: '10px 12px', borderBottom: '1px solid #2A2A2A', cursor: 'pointer', transition: 'background 0.2s' }}
                              className="dropdown-item-hover"
                            >
                              <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0 }}>{q.question_text}</p>
                              <small style={{ color: 'var(--text-secondary)' }}>{q.pack_name} | {q.question_type}</small>
                            </div>
                          ))}
                          {getFilteredQuestions(searchQuery2, 2).length === 0 && (
                            <div style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Aucune question trouvée.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* SLOT 3 */}
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Question 3</label>
                  {q3 ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--accent)', borderRadius: '8px', backgroundColor: 'rgba(255,247,0,0.03)' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{q3.question_text}</p>
                        <small style={{ color: 'var(--text-secondary)' }}>{q3.pack_name} ({q3.question_type})</small>
                      </div>
                      <button type="button" onClick={() => setQ3(null)} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Rechercher une question..."
                        value={searchQuery3}
                        onChange={(e) => { setSearchQuery3(e.target.value); setShowDropdown3(true); }}
                        onFocus={() => setShowDropdown3(true)}
                        style={{ paddingLeft: '36px' }}
                      />
                      <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />

                      {showDropdown3 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0,
                          backgroundColor: '#1E1E1E', border: '1px solid var(--border-color)', borderRadius: '8px',
                          maxHeight: '180px', overflowY: 'auto', zIndex: 10, marginTop: '4px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}>
                          {getFilteredQuestions(searchQuery3, 3).map(q => (
                            <div
                              key={q.id}
                              onClick={() => { setQ3(q); setShowDropdown3(false); }}
                              style={{ padding: '10px 12px', borderBottom: '1px solid #2A2A2A', cursor: 'pointer', transition: 'background 0.2s' }}
                              className="dropdown-item-hover"
                            >
                              <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0 }}>{q.question_text}</p>
                              <small style={{ color: 'var(--text-secondary)' }}>{q.pack_name} | {q.question_type}</small>
                            </div>
                          ))}
                          {getFilteredQuestions(searchQuery3, 3).length === 0 && (
                            <div style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Aucune question trouvée.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setSelectedDayStr(null)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn-primary" disabled={!q1 || !q2 || !q3}>
                    Planifier
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

