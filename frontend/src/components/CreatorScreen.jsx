import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { ArrowLeft, Plus, Trash2, Edit3, Save, X, BookOpen, HelpCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function CreatorScreen({ onBack }) {
  const [packs, setPacks] = useState([]);
  const [selectedPackId, setSelectedPackId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
  const [questionType, setQuestionType] = useState('multiple_choice');
  const [showQuestionForm, setShowQuestionForm] = useState(false);

  useEffect(() => {
    fetchMyPacks();
  }, []);

  useEffect(() => {
    if (selectedPackId) {
      fetchQuestions(selectedPackId);
    } else {
      setQuestions([]);
    }
  }, [selectedPackId]);

  const fetchMyPacks = async () => {
    try {
      // getPacks returns both validated packs AND custom packs created by current user
      const data = await api.get('/quiz/packs');
      
      // Filter packs to show ONLY the ones created by the current user
      const currentUser = JSON.parse(localStorage.getItem('quiz_user'));
      const myCustomPacks = data.filter(p => p.creator_id === currentUser.id);
      
      setPacks(myCustomPacks);
      if (myCustomPacks.length > 0 && !selectedPackId) {
        setSelectedPackId(myCustomPacks[0].id);
      }
    } catch (err) {
      setError("Impossible de charger vos thèmes.");
    }
  };

  const fetchQuestions = async (packId) => {
    setLoading(true);
    try {
      const data = await api.get('/quiz/questions', { pack_id: packId });
      setQuestions(data);
    } catch (err) {
      setError("Impossible de charger les questions.");
    } finally {
      setLoading(false);
    }
  };

  // Pack Actions
  const handleCreatePack = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!newPackName.trim()) return;

    try {
      const res = await api.post('/quiz/packs', { name: newPackName, description: newPackDesc });
      setSuccess(res.message);
      setNewPackName('');
      setNewPackDesc('');
      await fetchMyPacks();
    } catch (err) {
      setError(err.message || "Erreur de création.");
    }
  };

  const handleDeletePack = async (packId) => {
    if (!window.confirm("Supprimer ce thème ? Cela effacera également toutes ses questions.")) return;
    setError('');
    setSuccess('');
    try {
      const res = await api.delete('/quiz/packs', { pack_id: packId });
      setSuccess(res.message);
      if (selectedPackId === packId) {
        setSelectedPackId(null);
      }
      await fetchMyPacks();
    } catch (err) {
      setError(err.message || "Erreur de suppression.");
    }
  };

  // Question Actions
  const handleOpenQuestionForm = (q = null) => {
    setError('');
    setSuccess('');
    if (q) {
      setEditingQuestionId(q.id);
      setQuestionText(q.question_text);
      setQuestionType(q.question_type || 'multiple_choice');
      setOptA(q.opt_a);
      setOptB(q.opt_b);
      setOptC(q.opt_c);
      setOptD(q.opt_d);
      setCorrectOpt(q.correct_opt);
    } else {
      setEditingQuestionId(null);
      setQuestionText('');
      setQuestionType('multiple_choice');
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
      question_type: questionType,
      opt_a: optA,
      opt_b: questionType === 'open' ? '' : optB,
      opt_c: questionType === 'open' ? '' : optC,
      opt_d: questionType === 'open' ? '' : optD,
      correct_opt: questionType === 'open' ? 'A' : correctOpt
    };

    try {
      let res;
      if (editingQuestionId) {
        res = await api.put('/quiz/questions', { ...payload, id: editingQuestionId });
      } else {
        res = await api.post('/quiz/questions', payload);
      }
      setSuccess(res.message);
      setShowQuestionForm(false);
      fetchQuestions(selectedPackId);
      fetchMyPacks(); // Refresh counts
    } catch (err) {
      setError(err.message || "Erreur lors de la sauvegarde.");
    }
  };

  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm("Supprimer cette question ?")) return;
    setError('');
    setSuccess('');
    try {
      const res = await api.delete('/quiz/questions', { id: qId });
      setSuccess(res.message);
      fetchQuestions(selectedPackId);
      fetchMyPacks(); // Refresh counts
    } catch (err) {
      setError(err.message || "Erreur de suppression.");
    }
  };

  const activePack = packs.find(p => p.id === selectedPackId);

  return (
    <div className="container animate-slide-up" style={{ gap: '32px' }}>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Retour Dashboard
        </button>
        <h2 style={{ fontSize: '1.8rem', color: 'var(--accent)' }}>
          ✏️ Créateur de Thèmes
        </h2>
      </div>

      {/* Message alerts */}
      {error && <div style={{ backgroundColor: 'var(--error-glow)', color: 'var(--error)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255, 59, 105, 0.2)' }}>{error}</div>}
      {success && <div style={{ backgroundColor: 'var(--success-glow)', color: 'var(--success)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(0, 255, 157, 0.2)' }}>{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', md: '1fr 2fr', gap: '32px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        
        {/* Left Card: Create pack & List packs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Create pack form */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} style={{ color: 'var(--accent)' }} />
              Nouveau Thème
            </h3>
            <form onSubmit={handleCreatePack} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="Nom du pack (ex: Séries TV)"
                value={newPackName}
                onChange={(e) => setNewPackName(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Description du thème"
                value={newPackDesc}
                onChange={(e) => setNewPackDesc(e.target.value)}
              />
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                Créer le Thème
              </button>
            </form>
          </div>

          {/* User Packs List */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <BookOpen size={18} style={{ color: 'var(--accent)' }} />
              Mes Thèmes Créés
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
                      backgroundColor: selectedPackId === p.id ? 'rgba(255,247,0,0.03)' : 'var(--bg-input)',
                      border: `1px solid ${selectedPackId === p.id ? 'var(--accent)' : 'var(--border-color)'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <strong style={{ fontSize: '1rem', color: '#fff' }}>{p.name}</strong>
                        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {p.question_count} questions
                        </span>
                      </div>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeletePack(p.id); }} 
                        style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Validation Status Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', marginTop: '4px' }}>
                      {isValidated ? (
                        <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <CheckCircle2 size={14} />
                          Validé (Public)
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <AlertCircle size={14} style={{ color: 'var(--accent)' }} />
                          En attente de validation admin
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {packs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Vous n'avez pas encore créé de thème.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Card: Pack questions CRUD */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '400px' }}>
          
          {selectedPackId ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HelpCircle size={20} style={{ color: 'var(--accent)' }} />
                    Questions du thème ({questions.length})
                  </h3>
                  {activePack && parseInt(activePack.is_validated) === 1 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                      Note : Ce thème est public. Les modifications s'appliquent immédiatement.
                    </span>
                  )}
                </div>
                
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
                        <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '8px' }}>
                          {i + 1}. {q.question_text}
                          <span style={{ marginLeft: '8px', fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--border-color)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {q.question_type === 'open' ? 'Ouverte' : 'Choix Multiples'}
                          </span>
                        </p>
                        {q.question_type === 'open' ? (
                          <div style={{ fontSize: '0.85rem' }}>
                            Réponse correcte : <span style={{ color: 'var(--success)', fontWeight: 500 }}>{q.opt_a}</span>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span style={{ color: q.correct_opt === 'A' ? 'var(--success)' : 'inherit' }}>A: {q.opt_a}</span>
                            <span style={{ color: q.correct_opt === 'B' ? 'var(--success)' : 'inherit' }}>B: {q.opt_b}</span>
                            <span style={{ color: q.correct_opt === 'C' ? 'var(--success)' : 'inherit' }}>C: {q.opt_c}</span>
                            <span style={{ color: q.correct_opt === 'D' ? 'var(--success)' : 'inherit' }}>D: {q.opt_d}</span>
                          </div>
                        )}
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
                      Aucune question dans ce thème. Ajoutez au moins 10 questions pour que la validation puisse être effectuée !
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flex1: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              Sélectionnez ou créez un thème pour gérer ses questions.
            </div>
          )}

        </div>

      </div>

      {/* QUESTION FORM DIALOG */}
      {showQuestionForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 100
        }}>
          <div className="glass-card animate-slide-up" style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>
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
                  Type de Question
                </label>
                <select value={questionType} onChange={(e) => setQuestionType(e.target.value)} style={{ width: '100%' }}>
                  <option value="multiple_choice">Choix Multiples (A, B, C, D)</option>
                  <option value="open">Question Ouverte (Saisie Libre)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Texte de la Question
                </label>
                <input
                  type="text"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Écrivez la question..."
                  required
                />
              </div>

              {questionType === 'open' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Réponse attendue (exacte)</label>
                  <input type="text" value={optA} onChange={(e) => setOptA(e.target.value)} placeholder="Ex: Paris" required />
                </div>
              ) : (
                <>
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
                    <select value={correctOpt} onChange={(e) => setCorrectOpt(e.target.value)} style={{ width: '100%' }}>
                      <option value="A">Option A</option>
                      <option value="B">Option B</option>
                      <option value="C">Option C</option>
                      <option value="D">Option D</option>
                    </select>
                  </div>
                </>
              )}

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
    </div>
  );
}
