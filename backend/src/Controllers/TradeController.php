<?php
namespace App\Controllers;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use App\Utils\Pusher;
use PDO;
use Throwable;

class TradeController {
    private const RANK = ['common' => 0, 'rare' => 1, 'epic' => 2, 'legendary' => 3];
    private const FEES = ['common_rare' => 100, 'rare_epic' => 250, 'epic_legendary' => 500];

    public function context() {
        $auth = AuthMiddleware::authenticate();
        $me = (int) $auth['user_id'];
        $friendId = (int) ($_GET['friend_id'] ?? 0);
        $db = Database::getConnection();
        if (!$this->areFriends($db, $me, $friendId)) return $this->fail('Vous devez être amis pour proposer un échange.', 403);
        $stmt = $db->prepare("SELECT id, username, discriminator, avatar_url FROM users WHERE id = ?");
        $stmt->execute([$friendId]);
        echo json_encode([
            'success' => true,
            'friend' => $stmt->fetch(PDO::FETCH_ASSOC),
            'my_cards' => $this->cards($db, $me, $me, true),
            'friend_cards' => $this->cards($db, $friendId, $me, false),
            'rarity_fees' => self::FEES
        ]);
    }

    public function friendsForCard() {
        $auth = AuthMiddleware::authenticate();
        $me = (int) $auth['user_id'];
        $cardId = trim($_GET['card_id'] ?? '');
        $db = Database::getConnection();
        $offered = $this->snapshot($db, $me, $cardId, false);
        if (!$offered || $offered['available_quantity'] <= 1) return $this->fail("Cette carte n'est pas disponible en doublon.", 400);
        $stmt = $db->prepare("
            SELECT u.id, u.username, u.discriminator, u.avatar_url, COALESCE(uc.quantity, 0) quantity
            FROM friendships f
            JOIN users u ON u.id = IF(f.user_id = ?, f.friend_id, f.user_id)
            LEFT JOIN user_cards uc ON uc.user_id = u.id AND uc.card_id = ?
            WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
            ORDER BY (COALESCE(uc.quantity, 0) = 0) DESC, u.username
        ");
        $stmt->execute([$me, $cardId, $me, $me]);
        $friends = array_map(static function ($row) {
            $row['id'] = (int) $row['id']; $row['quantity'] = (int) $row['quantity'];
            $row['needs_card'] = $row['quantity'] === 0;
            return $row;
        }, $stmt->fetchAll(PDO::FETCH_ASSOC));
        echo json_encode(['success' => true, 'card' => $offered['card'], 'friends' => $friends]);
    }

    public function index() {
        $auth = AuthMiddleware::authenticate();
        $me = (int) $auth['user_id'];
        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT t.*, p.username proposer_username, p.discriminator proposer_discriminator,
                   r.username recipient_username, r.discriminator recipient_discriminator,
                   oc.name offered_name, oc.rarity offered_rarity, oc.card_set offered_set,
                   rc.name requested_name, rc.rarity requested_rarity, rc.card_set requested_set
            FROM card_trades t
            JOIN users p ON p.id=t.proposer_id JOIN users r ON r.id=t.recipient_id
            JOIN cards oc ON oc.id=t.offered_card_id JOIN cards rc ON rc.id=t.requested_card_id
            WHERE t.proposer_id=? OR t.recipient_id=?
            ORDER BY (t.status='pending') DESC, t.created_at DESC LIMIT 100
        ");
        $stmt->execute([$me, $me]);
        $incoming=[]; $outgoing=[];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $item = $this->format($row, $me);
            if ((int) $row['recipient_id'] === $me) $incoming[] = $item;
            else $outgoing[] = $item;
        }
        echo json_encode([
            'success'=>true, 'incoming'=>$incoming, 'outgoing'=>$outgoing,
            'pending_count'=>count(array_filter($incoming, static fn($t)=>$t['status']==='pending')),
            'pusher_key'=>getenv('PUSHER_KEY') ?: ($_ENV['PUSHER_KEY'] ?? null),
            'pusher_cluster'=>getenv('PUSHER_CLUSTER') ?: ($_ENV['PUSHER_CLUSTER'] ?? 'eu')
        ]);
    }

    public function propose(array $data) {
        $auth=AuthMiddleware::authenticate(); $me=(int)$auth['user_id'];
        $to=(int)($data['recipient_id']??0); $offeredId=trim($data['offered_card_id']??''); $requestedId=trim($data['requested_card_id']??'');
        if ($to<=0 || $to===$me || !$offeredId || !$requestedId) return $this->fail('Proposition invalide.',400);
        $db=Database::getConnection();
        try {
            $db->beginTransaction();
            if (!$this->areFriends($db,$me,$to)) throw new \DomainException('Vous devez être amis pour échanger.');
            $offered=$this->snapshot($db,$me,$offeredId,true); $requested=$this->snapshot($db,$to,$requestedId,true);
            if (!$offered || $offered['available_quantity']<=1) throw new \DomainException("La carte offerte n'est plus disponible en doublon.");
            if (!$requested || $requested['available_quantity']<=1) throw new \DomainException("La carte demandée n'est plus disponible en doublon.");
            [$fee,$payer]=$this->fee($offered['card']['rarity'],$requested['card']['rarity']);
            if ($payer==='proposer' && $fee>0) $this->charge($db,$me,$fee);
            $stmt=$db->prepare("INSERT INTO card_trades (proposer_id,recipient_id,offered_card_id,requested_card_id,coin_fee,fee_payer,status) VALUES (?,?,?,?,?,?,'pending')");
            $stmt->execute([$me,$to,$offeredId,$requestedId,$fee,$payer]);
            $id=(int)$db->lastInsertId(); $db->commit();
            echo json_encode(['success'=>true,'trade_id'=>$id,'message'=>"Proposition d'échange envoyée.",'reserved_fee'=>$payer==='proposer'?$fee:0]);
            Pusher::finishResponse(); $this->notify($to,'trade_created',$id);
        } catch (\DomainException $e) {
            if ($db->inTransaction()) $db->rollBack(); $this->fail($e->getMessage(),400);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack(); $this->fail("Impossible d'envoyer la proposition.",500);
        }
    }

    public function respond(array $data) {
        $auth=AuthMiddleware::authenticate(); $me=(int)$auth['user_id'];
        $id=(int)($data['trade_id']??0); $action=trim($data['action']??'');
        if ($id<=0 || !in_array($action,['accept','decline'],true)) return $this->fail('Réponse invalide.',400);
        $db=Database::getConnection();
        try {
            $db->beginTransaction();
            $stmt=$db->prepare("SELECT * FROM card_trades WHERE id=? FOR UPDATE"); $stmt->execute([$id]); $trade=$stmt->fetch(PDO::FETCH_ASSOC);
            if (!$trade || $trade['status']!=='pending') throw new \DomainException('Cette proposition a déjà été traitée.');
            if ((int)$trade['recipient_id']!==$me) throw new \DomainException("Action non autorisée.");
            if ($action==='decline') {
                $this->refund($db,$trade);
                $db->prepare("UPDATE card_trades SET status='declined',responded_at=CURRENT_TIMESTAMP WHERE id=?")->execute([$id]);
                $db->commit(); echo json_encode(['success'=>true,'message'=>'Proposition refusée.']);
                Pusher::finishResponse(); $this->notify((int)$trade['proposer_id'],'trade_declined',$id); return;
            }
            $offered=$this->snapshot($db,(int)$trade['proposer_id'],$trade['offered_card_id'],true,$id);
            $requested=$this->snapshot($db,$me,$trade['requested_card_id'],true);
            if (!$this->areFriends($db,(int)$trade['proposer_id'],$me)) throw new \DomainException("Vous n'êtes plus amis.");
            if (!$offered || $offered['available_quantity']<=1) throw new \DomainException("La carte offerte n'est plus échangeable.");
            if (!$requested || $requested['available_quantity']<=1) throw new \DomainException("Votre carte n'est plus disponible en doublon.");
            if ($trade['fee_payer']==='recipient' && (int)$trade['coin_fee']>0) $this->charge($db,$me,(int)$trade['coin_fee']);
            $this->transfer($db,(int)$trade['proposer_id'],$me,$trade['offered_card_id']);
            $this->transfer($db,$me,(int)$trade['proposer_id'],$trade['requested_card_id']);
            $db->prepare("UPDATE card_trades SET status='accepted',responded_at=CURRENT_TIMESTAMP WHERE id=?")->execute([$id]);
            $db->commit(); echo json_encode(['success'=>true,'message'=>'Échange accepté : les cartes ont été transférées.']);
            Pusher::finishResponse(); $this->notify((int)$trade['proposer_id'],'trade_accepted',$id);
        } catch (\DomainException $e) {
            if ($db->inTransaction()) $db->rollBack(); $this->fail($e->getMessage(),400);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack(); $this->fail("Impossible de traiter l'échange.",500);
        }
    }

    public function cancel(array $data) {
        $auth=AuthMiddleware::authenticate(); $me=(int)$auth['user_id']; $id=(int)($data['trade_id']??0);
        $db=Database::getConnection();
        try {
            $db->beginTransaction();
            $stmt=$db->prepare("SELECT * FROM card_trades WHERE id=? FOR UPDATE"); $stmt->execute([$id]); $trade=$stmt->fetch(PDO::FETCH_ASSOC);
            if (!$trade || $trade['status']!=='pending') throw new \DomainException('Cette proposition a déjà été traitée.');
            if ((int)$trade['proposer_id']!==$me) throw new \DomainException('Action non autorisée.');
            $this->refund($db,$trade);
            $db->prepare("UPDATE card_trades SET status='cancelled',responded_at=CURRENT_TIMESTAMP WHERE id=?")->execute([$id]);
            $db->commit(); echo json_encode(['success'=>true,'message'=>'Proposition annulée.']);
            Pusher::finishResponse(); $this->notify((int)$trade['recipient_id'],'trade_cancelled',$id);
        } catch (\DomainException $e) {
            if ($db->inTransaction()) $db->rollBack(); $this->fail($e->getMessage(),400);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack(); $this->fail("Impossible d'annuler l'échange.",500);
        }
    }

    private function cards(PDO $db,int $owner,int $viewer,bool $duplicatesOnly): array {
        $sql="SELECT c.id,c.name,c.rarity,c.card_set `set`,c.description,c.image_url,uc.quantity,
          uc.quantity-(SELECT COUNT(*) FROM card_trades t WHERE t.proposer_id=uc.user_id AND t.offered_card_id=uc.card_id AND t.status='pending') available_quantity,
          NOT EXISTS(SELECT 1 FROM user_cards mine WHERE mine.user_id=? AND mine.card_id=c.id AND mine.quantity>0) missing_for_viewer
          FROM user_cards uc JOIN cards c ON c.id=uc.card_id WHERE uc.user_id=? AND uc.quantity>0";
        if($duplicatesOnly)$sql.=" HAVING available_quantity>1";
        $sql.=" ORDER BY FIELD(c.rarity,'legendary','epic','rare','common'),c.name";
        $stmt=$db->prepare($sql);$stmt->execute([$viewer,$owner]);
        return array_map(static function($c){$c['quantity']=(int)$c['quantity'];$c['available_quantity']=(int)$c['available_quantity'];$c['missing_for_viewer']=(bool)$c['missing_for_viewer'];$c['tradeable']=$c['available_quantity']>1;return $c;},$stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    private function snapshot(PDO $db,int $owner,string $cardId,bool $lock,?int $exclude=null): ?array {
        $stmt=$db->prepare("SELECT uc.quantity,c.id,c.name,c.rarity,c.card_set,c.description,c.image_url FROM user_cards uc JOIN cards c ON c.id=uc.card_id WHERE uc.user_id=? AND uc.card_id=?".($lock?' FOR UPDATE':''));
        $stmt->execute([$owner,$cardId]);$row=$stmt->fetch(PDO::FETCH_ASSOC);if(!$row)return null;
        $sql="SELECT COUNT(*) FROM card_trades WHERE proposer_id=? AND offered_card_id=? AND status='pending'";$params=[$owner,$cardId];
        if($exclude){$sql.=" AND id!=?";$params[]=$exclude;}
        $q=$db->prepare($sql);$q->execute($params);$reserved=(int)$q->fetchColumn();
        return ['quantity'=>(int)$row['quantity'],'available_quantity'=>(int)$row['quantity']-$reserved,'card'=>['id'=>$row['id'],'name'=>$row['name'],'rarity'=>$row['rarity'],'set'=>$row['card_set'],'description'=>$row['description'],'image_url'=>$row['image_url']]];
    }

    private function fee(string $a,string $b): array {
        $ra=self::RANK[$a]??-10;$rb=self::RANK[$b]??-10;
        if(abs($ra-$rb)>1)throw new \DomainException('Les cartes doivent être de même rareté ou de raretés voisines.');
        if($ra===$rb)return [0,'proposer'];
        $low=$ra<$rb?$a:$b;$high=$ra<$rb?$b:$a;
        return [self::FEES["{$low}_{$high}"],$ra<$rb?'proposer':'recipient'];
    }
    private function charge(PDO $db,int $user,int $fee): void {
        $stmt=$db->prepare("SELECT coins FROM users WHERE id=? FOR UPDATE");$stmt->execute([$user]);
        if((int)$stmt->fetchColumn()<$fee)throw new \DomainException("Il faut {$fee} pièces pour compenser l'écart de rareté.");
        $db->prepare("UPDATE users SET coins=coins-? WHERE id=?")->execute([$fee,$user]);
    }
    private function refund(PDO $db,array $t): void {
        if($t['fee_payer']==='proposer'&&(int)$t['coin_fee']>0)$db->prepare("UPDATE users SET coins=coins+? WHERE id=?")->execute([(int)$t['coin_fee'],(int)$t['proposer_id']]);
    }
    private function transfer(PDO $db,int $from,int $to,string $card): void {
        $db->prepare("UPDATE user_cards SET quantity=quantity-1 WHERE user_id=? AND card_id=?")->execute([$from,$card]);
        $db->prepare("INSERT INTO user_cards(user_id,card_id,quantity)VALUES(?,?,1) ON DUPLICATE KEY UPDATE quantity=quantity+1")->execute([$to,$card]);
    }
    private function areFriends(PDO $db,int $a,int $b): bool {
        if($a<=0||$b<=0)return false;
        $s=$db->prepare("SELECT 1 FROM friendships WHERE status='accepted' AND ((user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)) LIMIT 1");$s->execute([$a,$b,$b,$a]);return(bool)$s->fetchColumn();
    }
    private function format(array $r,int $me): array {
        return ['id'=>(int)$r['id'],'status'=>$r['status'],'direction'=>(int)$r['recipient_id']===$me?'incoming':'outgoing','created_at'=>$r['created_at'],'coin_fee'=>(int)$r['coin_fee'],'fee_payer'=>$r['fee_payer'],
          'viewer_pays_fee'=>($r['fee_payer']==='proposer'&&(int)$r['proposer_id']===$me)||($r['fee_payer']==='recipient'&&(int)$r['recipient_id']===$me),
          'proposer'=>['id'=>(int)$r['proposer_id'],'username'=>$r['proposer_username'],'discriminator'=>$r['proposer_discriminator']],
          'recipient'=>['id'=>(int)$r['recipient_id'],'username'=>$r['recipient_username'],'discriminator'=>$r['recipient_discriminator']],
          'offered_card'=>['id'=>$r['offered_card_id'],'name'=>$r['offered_name'],'rarity'=>$r['offered_rarity'],'set'=>$r['offered_set']],
          'requested_card'=>['id'=>$r['requested_card_id'],'name'=>$r['requested_name'],'rarity'=>$r['requested_rarity'],'set'=>$r['requested_set']]];
    }
    private function notify(int $user,string $event,int $id): void {Pusher::triggerAsync("user-{$user}",$event,['trade_id'=>$id]);}
    private function fail(string $message,int $status) {http_response_code($status);echo json_encode(['error'=>$message]);}
}
