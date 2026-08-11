import type { WalletTx } from '@/hooks/useWallet';
import type { PixKeyType } from '@/lib/pix';

export type PersonGroup = {
  personId: string; personName: string; personWhatsapp: string | null; personPhotoUrl: string | null;
  /** Dado de perfil, igual a nome e whatsapp: vale pra pessoa, não pra resenha. */
  personPixKey: string | null; personPixKeyType: PixKeyType | null;
  net: number; items: WalletTx[];
};

// Uma pessoa pode aparecer em resenhas de moedas diferentes — soma sempre
// convertendo cada lançamento com `convert` primeiro (os `items` guardados
// continuam com o valor cru na moeda de cada resenha, pra quem precisar montar
// mensagem/acerto com o valor real, ex. BatchSettleSheet). `convert` deve
// ser a mesma função usada pra exibir cada lançamento na lista (ex.
// `toMineAtTxRate`), senão a lista "por movimentação" e "por pessoa" podem
// divergir em 1 centavo quando um lançamento resolvido usa taxa histórica.
export function groupByPerson(items: WalletTx[], convert: (tx: WalletTx) => number): PersonGroup[] {
  const map = new Map<string, PersonGroup>();
  for (const tx of items) {
    const g = map.get(tx.personId) ?? {
      personId: tx.personId, personName: tx.personName, personWhatsapp: tx.personWhatsapp, personPhotoUrl: tx.personPhotoUrl,
      personPixKey: tx.personPixKey, personPixKeyType: tx.personPixKeyType, net: 0, items: [],
    };
    const converted = convert(tx);
    g.net += tx.direction === 'in' ? converted : -converted;
    g.items.push(tx);
    map.set(tx.personId, g);
  }
  return Array.from(map.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

export type GroupBucket = { groupId: string; groupName: string; net: number; items: WalletTx[] };

// Cada bucket é sempre 1 resenha só — soma direto, e toda resenha é em reais.
export function groupByGroup(items: WalletTx[]): GroupBucket[] {
  const map = new Map<string, GroupBucket>();
  for (const tx of items) {
    const g = map.get(tx.groupId) ?? { groupId: tx.groupId, groupName: tx.groupName, net: 0, items: [] };
    g.net += tx.direction === 'in' ? tx.amount : -tx.amount;
    g.items.push(tx);
    map.set(tx.groupId, g);
  }
  return Array.from(map.values());
}
