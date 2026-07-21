import React,{useEffect,useMemo,useState}from'react';
import{ArrowLeftRight,Coins,Filter,Loader2,Search,X}from'lucide-react';
import{api,PUBLIC_BASE}from'../../utils/api';
import GameCard from'../GameCard';

const RANK={common:0,rare:1,epic:2,legendary:3};

function Avatar({user}){
 const value=user?.avatar_url;
 if(value?.startsWith('/uploads/'))return <img src={`${PUBLIC_BASE}${value}`} alt=""/>;
 if(value?.startsWith('http'))return <img src={value} alt=""/>;
 return <span>{user?.username?.[0]?.toUpperCase()||'?'}</span>;
}
function CardChoice({card,selected,disabled,onClick}){
 return <button className={`trade-card-choice${selected?' is-selected':''}`} disabled={disabled} onClick={onClick} type="button">
  <GameCard card={card} quantity={1} width="112px" height="165px" isFoil/>
  <span className="trade-card-choice__quantity">×{card.available_quantity}</span>
 </button>;
}
export default function TradeModal({friendId,initialOfferedCardId=null,onClose,onSent}){
 const[data,setData]=useState(null),[offeredId,setOfferedId]=useState(initialOfferedCardId),[requestedId,setRequestedId]=useState(null);
 const[onlyDuplicates,setOnlyDuplicates]=useState(true),[onlyMissing,setOnlyMissing]=useState(false),[query,setQuery]=useState('');
 const[submitting,setSubmitting]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;api.get('/trades/context',{friend_id:friendId}).then(res=>{if(!active)return;setData(res);if(initialOfferedCardId&&!res.my_cards.some(c=>c.id===initialOfferedCardId)){setOfferedId(null);setError("Cette carte n'est plus disponible en doublon.");}}).catch(err=>active&&setError(err.message));return()=>{active=false};},[friendId,initialOfferedCardId]);
 const offered=data?.my_cards.find(c=>c.id===offeredId),requested=data?.friend_cards.find(c=>c.id===requestedId);
 const friendCards=useMemo(()=>{let cards=data?.friend_cards||[];if(onlyDuplicates)cards=cards.filter(c=>c.tradeable);if(onlyMissing)cards=cards.filter(c=>c.missing_for_viewer);if(query.trim()){const q=query.trim().toLowerCase();cards=cards.filter(c=>c.name.toLowerCase().includes(q)||c.set.toLowerCase().includes(q));}return cards;},[data,onlyDuplicates,onlyMissing,query]);
 useEffect(()=>{if(requested&&offered&&(!requested.tradeable||Math.abs(RANK[offered.rarity]-RANK[requested.rarity])>1))setRequestedId(null);},[offered,requested]);
 const fee=useMemo(()=>{if(!offered||!requested||!data)return null;const a=RANK[offered.rarity],b=RANK[requested.rarity];if(a===b)return{amount:0,payer:null};const low=a<b?offered.rarity:requested.rarity,high=a<b?requested.rarity:offered.rarity;return{amount:data.rarity_fees[`${low}_${high}`],payer:a<b?'Vous':data.friend.username};},[offered,requested,data]);
 const submit=async()=>{if(!offered||!requested||submitting)return;setSubmitting(true);setError('');try{const res=await api.post('/trades/propose',{recipient_id:friendId,offered_card_id:offered.id,requested_card_id:requested.id});window.dispatchEvent(new Event('trade_inventory_changed'));onSent?.(res);onClose();}catch(err){setError(err.message)}finally{setSubmitting(false)}};
 return <div className="trade-overlay" onMouseDown={onClose}><section className="trade-modal" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true">
  <header className="trade-modal__header"><div><span className="kicker">Échange asynchrone</span><h2>Proposer un échange</h2>{data?.friend&&<p><Avatar user={data.friend}/><strong>{data.friend.username}<small>#{data.friend.discriminator}</small></strong></p>}</div><button className="trade-close" onClick={onClose}><X size={20}/></button></header>
  {!data&&!error?<div className="trade-loading"><Loader2 className="animate-spin"/>Chargement des collections&</div>:<>
   <div className="trade-columns">
    <section className="trade-column"><div className="trade-column__heading"><div><span>1</span><h3>Ce que j'offre</h3></div><small>Doublons disponibles uniquement</small></div><div className="trade-card-grid">{data?.my_cards.map(c=><CardChoice key={c.id} card={c} selected={c.id===offeredId} onClick={()=>setOfferedId(c.id)}/>)}{data?.my_cards.length===0&&<p className="trade-empty">Vous navez aucun doublon disponible.</p>}</div></section>
    <div className="trade-swap-mark"><ArrowLeftRight size={20}/></div>
    <section className="trade-column"><div className="trade-column__heading"><div><span>2</span><h3>Ce que je demande</h3></div><small>Même rareté ou rareté voisine</small></div>
     <div className="trade-filters"><label><Filter size={13}/><input type="checkbox" checked={onlyDuplicates} onChange={e=>setOnlyDuplicates(e.target.checked)}/> Doublons</label><label><input type="checkbox" checked={onlyMissing} onChange={e=>setOnlyMissing(e.target.checked)}/> Il me manque</label><div><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher&"/></div></div>
     <div className="trade-card-grid">{friendCards.map(c=>{const incompatible=offered&&Math.abs(RANK[offered.rarity]-RANK[c.rarity])>1;return <CardChoice key={c.id} card={c} selected={c.id===requestedId} disabled={!c.tradeable||!offered||incompatible} onClick={()=>setRequestedId(c.id)}/>})}{friendCards.length===0&&<p className="trade-empty">Aucune carte ne correspond aux filtres.</p>}</div>
    </section>
   </div>
   <footer className="trade-modal__footer"><div>{fee?(fee.amount>0?<p className="trade-fee"><Coins size={16}/><strong>{fee.payer}</strong> paiera {fee.amount} pièces.</p>:<p className="trade-fee">Même rareté : aucun supplément.</p>):<p>Sélectionnez deux cartes compatibles.</p>}{error&&<p className="trade-error">{error}</p>}</div><button className="btn-primary" disabled={!offered||!requested||submitting} onClick={submit}>{submitting?<Loader2 size={16} className="animate-spin"/>:<ArrowLeftRight size={16}/>}Envoyer la proposition</button></footer>
  </>}</section></div>;
}
export function FriendPicker({card,onSelect,onClose}){
 const[friends,setFriends]=useState(null),[error,setError]=useState('');
 useEffect(()=>{api.get('/trades/friends-for-card',{card_id:card.id}).then(r=>setFriends(r.friends)).catch(e=>setError(e.message));},[card.id]);
 return <div className="trade-overlay" onMouseDown={onClose}><section className="friend-picker" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true"><header><div><span className="kicker">Choisir un destinataire</span><h2>Qui recevra {card.name} ?</h2></div><button className="trade-close" onClick={onClose}><X size={20}/></button></header>{!friends&&!error&&<div className="trade-loading"><Loader2 className="animate-spin"/>Chargement des amis&</div>}{error&&<p className="trade-error">{error}</p>}<div className="friend-picker__list">{friends?.map(f=><button key={f.id} onClick={()=>onSelect(f)}><Avatar user={f}/><span><strong>{f.username}<small>#{f.discriminator}</small></strong><small>{f.quantity?`Possède déjà ×${f.quantity}`:'Ne possède pas cette carte'}</small></span><em className={f.needs_card?'needs':''}>{f.needs_card?'En a besoin':'Déjà obtenue'}</em></button>)}{friends?.length===0&&<p className="trade-empty">Ajoutez des amis pour échanger.</p>}</div></section></div>;
}
