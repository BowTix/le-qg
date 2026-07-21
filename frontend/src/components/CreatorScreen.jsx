import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, Lightbulb,
  Loader2, Plus, Search, Send, Sparkles, X
} from 'lucide-react';

const EMPTY_QUESTION = {
  question_text: '', question_type: 'multiple_choice',
  opt_a: '', opt_b: '', opt_c: '', opt_d: '', correct_opt: 'A'
};

export default function CreatorScreen({ onBack }) {
  const [packs, setPacks] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedPack, setSelectedPack] = useState(null);
  const [view, setView] = useState('packs');
  const [question, setQuestion] = useState(EMPTY_QUESTION);
  const [theme, setTheme] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadPacks = async () => {
    setLoading(true);
    try {
      const data = await api.get('/quiz/packs');
      setPacks(data.filter(pack => Number(pack.id) !== 0));
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Impossible de charger les packs.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPacks(); }, []);

  const visiblePacks = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fr');
    return packs.filter(pack => Number(pack.is_validated) === 1 && (!term ||
      pack.name.toLocaleLowerCase('fr').includes(term) ||
      (pack.description || '').toLocaleLowerCase('fr').includes(term)));
  }, [packs, query]);

  const pendingPacks = packs.filter(pack => Number(pack.is_validated) !== 1);

  const openQuestion = (pack) => {
    setSelectedPack(pack);
    setQuestion(EMPTY_QUESTION);
    setNotice(null);
    setView('question');
  };

  const updateQuestion = (field, value) => setQuestion(current => ({ ...current, [field]: value }));

  const submitQuestion = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    try {
      const payload = {
        ...question,
        pack_id: selectedPack.id,
        opt_b: question.question_type === 'open' ? '' : question.opt_b,
        opt_c: question.question_type === 'open' ? '' : question.opt_c,
        opt_d: question.question_type === 'open' ? '' : question.opt_d,
        correct_opt: question.question_type === 'open' ? 'A' : question.correct_opt
      };
      const result = await api.post('/quiz/questions', payload);
      setQuestion(EMPTY_QUESTION);
      setNotice({ type: 'success', text: `Question ajoutée au pack « ${selectedPack.name} ».` });
      setNotice({ type: 'success', text: result.message || 'Question envoyee pour validation.' });
      await loadPacks();
      setView('packs');
    } catch (error) {
      setNotice({ type: 'error', text: error.message || "Impossible d'ajouter la question." });
    } finally {
      setSubmitting(false);
    }
  };

  const submitTheme = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    try {
      await api.post('/quiz/packs', theme);
      setTheme({ name: '', description: '' });
      setNotice({ type: 'success', text: 'Votre thème a été proposé. Il sera visible après validation.' });
      await loadPacks();
      setView('packs');
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Impossible de proposer ce thème.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="creator-page container animate-slide-up">
      <header className="creator-hero">
        <button className="creator-back" type="button" onClick={onBack}><ArrowLeft size={18} /> Retour</button>
        <div className="creator-hero__copy">
          <span className="creator-kicker"><Sparkles size={15} /> Mode création</span>
          <h1>Fais grandir le quiz.</h1>
          <p>Choisis un pack et ajoute ta meilleure question, ou propose un tout nouveau thème à la communauté.</p>
        </div>
        <div className="creator-hero__stat"><strong>{packs.filter(p => Number(p.is_validated) === 1).length}</strong><span>packs disponibles</span></div>
      </header>

      {notice && <div className={`creator-notice creator-notice--${notice.type}`}><Check size={18} /><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Fermer"><X size={16} /></button></div>}

      {view === 'packs' && (
        <section className="creator-content">
          <div className="creator-toolbar">
            <div><span className="creator-kicker">Contribuer</span><h2>Choisis un pack</h2><p>Ta question sera ajoutée au thème sélectionné.</p></div>
            <button className="creator-propose" type="button" onClick={() => { setView('theme'); setNotice(null); }}><Plus size={18} /><span><strong>Proposer un thème</strong><small>Il sera étudié avant publication</small></span><ArrowRight size={18} /></button>
          </div>

          <label className="creator-search"><Search size={19} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un thème…" /></label>

          {loading ? <div className="creator-empty"><Loader2 className="animate-spin" /> Chargement des packs…</div> : (
            <div className="creator-pack-grid">
              {visiblePacks.map((pack, index) => (
                <button className="creator-pack" type="button" key={pack.id} onClick={() => openQuestion(pack)}>
                  <span className={`creator-pack__icon creator-pack__icon--${index % 4}`}><BookOpen size={23} /></span>
                  <span className="creator-pack__body"><strong>{pack.name}</strong><small>{pack.description || 'Un pack de la communauté.'}</small><em>{pack.question_count || 0} questions</em></span>
                  <span className="creator-pack__action"><Plus size={17} /> Ajouter une question</span>
                </button>
              ))}
              {visiblePacks.length === 0 && <div className="creator-empty"><Search size={24} /><strong>Aucun pack trouvé</strong><span>Essaie une autre recherche ou propose ce thème.</span></div>}
            </div>
          )}

          {pendingPacks.length > 0 && <div className="creator-pending"><Lightbulb size={18} /><div><strong>Mes propositions en attente</strong><p>{pendingPacks.map(pack => pack.name).join(' · ')}</p></div></div>}
        </section>
      )}

      {view === 'question' && selectedPack && (
        <section className="creator-form-card">
          <button className="creator-step-back" type="button" onClick={() => setView('packs')}><ChevronLeft size={17} /> Tous les packs</button>
          <div className="creator-form-heading"><span className="creator-pack__icon creator-pack__icon--1"><BookOpen size={23} /></span><div><span className="creator-kicker">Nouvelle question</span><h2>{selectedPack.name}</h2><p>Rédige une question claire et indique la bonne réponse.</p></div></div>
          <form onSubmit={submitQuestion} className="creator-form">
            <label><span>Type de question</span><select value={question.question_type} onChange={e => updateQuestion('question_type', e.target.value)}><option value="multiple_choice">Choix multiples</option><option value="open">Réponse libre</option></select></label>
            <label className="creator-form__wide"><span>Question</span><textarea value={question.question_text} onChange={e => updateQuestion('question_text', e.target.value)} placeholder="Ex. Quelle planète est surnommée la planète rouge ?" rows="3" required /></label>
            {question.question_type === 'open' ? (
              <label className="creator-form__wide"><span>Réponse attendue</span><input value={question.opt_a} onChange={e => updateQuestion('opt_a', e.target.value)} placeholder="La réponse exacte" required /></label>
            ) : <div className="creator-answers creator-form__wide">{['A', 'B', 'C', 'D'].map(letter => <label key={letter} className={question.correct_opt === letter ? 'is-correct' : ''}><button type="button" onClick={() => updateQuestion('correct_opt', letter)} aria-label={`Choisir la réponse ${letter}`}>{question.correct_opt === letter ? <Check size={15} /> : letter}</button><input value={question[`opt_${letter.toLowerCase()}`]} onChange={e => updateQuestion(`opt_${letter.toLowerCase()}`, e.target.value)} placeholder={`Réponse ${letter}`} required /></label>)}</div>}
            <p className="creator-hint creator-form__wide"><Lightbulb size={16} /> {question.question_type === 'open' ? 'La réponse devra correspondre au texte saisi.' : 'Clique sur la lettre pour marquer la bonne réponse.'}</p>
            <div className="creator-form__actions creator-form__wide"><button type="button" className="btn-secondary" onClick={() => setView('packs')}>Annuler</button><button type="submit" className="btn-primary" disabled={submitting}>{submitting ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} Ajouter au pack</button></div>
          </form>
        </section>
      )}

      {view === 'theme' && (
        <section className="creator-form-card creator-form-card--theme">
          <button className="creator-step-back" type="button" onClick={() => setView('packs')}><ChevronLeft size={17} /> Tous les packs</button>
          <div className="creator-form-heading"><span className="creator-pack__icon creator-pack__icon--3"><Sparkles size={23} /></span><div><span className="creator-kicker">Proposition</span><h2>Créer un nouveau thème</h2><p>Donne-nous une idée précise. L’équipe la vérifiera avant de la publier.</p></div></div>
          <form onSubmit={submitTheme} className="creator-form">
            <label className="creator-form__wide"><span>Nom du thème</span><input value={theme.name} onChange={e => setTheme({ ...theme, name: e.target.value })} placeholder="Ex. Cinéma d'animation" maxLength="80" required /></label>
            <label className="creator-form__wide"><span>Description</span><textarea value={theme.description} onChange={e => setTheme({ ...theme, description: e.target.value })} placeholder="Quels sujets et quel niveau de difficulté imagines-tu ?" rows="5" maxLength="300" /></label>
            <div className="creator-review creator-form__wide"><Check size={18} /><span><strong>Validation avant publication</strong><small>Le thème n’apparaîtra dans la liste qu’après vérification par un administrateur.</small></span></div>
            <div className="creator-form__actions creator-form__wide"><button type="button" className="btn-secondary" onClick={() => setView('packs')}>Annuler</button><button type="submit" className="btn-primary" disabled={submitting}>{submitting ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} Envoyer la proposition</button></div>
          </form>
        </section>
      )}
    </main>
  );
}
