import React from 'react';
import { Coins, CreditCard, PackageOpen, ShieldCheck, Sparkles } from 'lucide-react';

export default function BoosterOffer({ coins, opening, onBuy }) {
  const canBuy = coins >= 250 && !opening;

  return (
    <section className="booster-offer">
      <div className="booster-offer__visual" aria-hidden="true">
        <span className="booster-offer__halo" />
        <button className="booster-pack" type="button" onClick={onBuy} disabled={!canBuy} tabIndex={-1}>
          <span className="booster-pack__seal"><Sparkles size={30} /></span>
          <span className="booster-pack__brand">LE QG</span>
          <strong>Booster</strong>
          <small>3 cartes · 1 surprise</small>
        </button>
      </div>

      <div className="booster-offer__copy">
        <span className="kicker">Booster officiel</span>
        <h2>Trois cartes.<br />Une nouvelle histoire.</h2>
        <p>Complète tes sets, découvre de nouvelles raretés et débloque des récompenses exclusives.</p>
        <div className="booster-benefits">
          <span><PackageOpen size={16} /> 3 cartes garanties</span>
          <span><ShieldCheck size={16} /> Une offre simple et unique</span>
        </div>
        <button className="booster-buy" type="button" onClick={onBuy} disabled={!canBuy}>
          <span><CreditCard size={18} /> {opening ? 'Ouverture en cours…' : 'Ouvrir le booster'}</span>
          <strong><Coins size={17} /> 250</strong>
        </button>
        {coins < 250 && <p className="booster-offer__error">Il te manque {(250 - coins).toLocaleString('fr-FR')} coins pour ouvrir ce booster.</p>}
      </div>
    </section>
  );
}
