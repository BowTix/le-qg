import React from 'react';
import { CheckCircle2, ClipboardCheck, Loader2, User, XCircle } from 'lucide-react';

export default function ProposalModeration({ proposals, loading, moderatingId, onModerate }) {
  if (loading) return <div className="proposal-moderation proposal-moderation--empty"><Loader2 className="animate-spin" /> Chargement des propositions...</div>;

  return (
    <section className="proposal-moderation">
      <header className="proposal-moderation__header">
        <div><span>Moderation communautaire</span><h2>Questions a valider</h2><p>Verifie la question et sa reponse avant de la publier dans le pack.</p></div>
        <strong>{proposals.length}<small>en attente</small></strong>
      </header>
      {proposals.length === 0 ? <div className="proposal-moderation__empty"><ClipboardCheck size={30} /><h3>Tout est a jour</h3><p>Aucune question ne demande de validation.</p></div> : <div className="proposal-list">
        {proposals.map(proposal => {
          const isOpen = proposal.question_type === 'open';
          return <article className="proposal-card" key={proposal.id}>
            <div className="proposal-card__meta"><span className="proposal-card__pack">{proposal.pack_name}</span><span><User size={14} /> {proposal.contributor_username || 'Utilisateur supprime'}{proposal.contributor_discriminator ? `#${proposal.contributor_discriminator}` : ''}</span><time>{new Date(proposal.created_at).toLocaleDateString('fr-FR')}</time></div>
            <h3>{proposal.question_text}</h3>
            {isOpen ? <div className="proposal-open-answer"><CheckCircle2 size={16} /> Reponse attendue : <strong>{proposal.opt_a}</strong></div> : <div className="proposal-options">{['A', 'B', 'C', 'D'].map(letter => <div className={proposal.correct_opt === letter ? 'is-correct' : ''} key={letter}><b>{letter}</b><span>{proposal[`opt_${letter.toLowerCase()}`]}</span>{proposal.correct_opt === letter && <CheckCircle2 size={16} />}</div>)}</div>}
            <footer><button className="proposal-reject" disabled={moderatingId === proposal.id} onClick={() => onModerate(proposal.id, 'reject')}><XCircle size={17} /> Refuser</button><button className="proposal-approve" disabled={moderatingId === proposal.id} onClick={() => onModerate(proposal.id, 'approve')}>{moderatingId === proposal.id ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />} Valider et publier</button></footer>
          </article>;
        })}
      </div>}
    </section>
  );
}
