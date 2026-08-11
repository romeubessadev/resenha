import { Receipt, type LucideIcon } from 'lucide-react-native';

// O rosto da despesa na lista, no detalhe, no seletor e no Insight: o ícone da
// categoria. Duas despesas do mesmo balde mostram o mesmo desenho — é o ponto,
// não uma limitação.
//
// Já existiu emoji por despesa aqui (o "churrasco → 🥩"), e ele saiu por
// densidade visual: numa lista de vinte lançamentos, vinte glifos multicoloridos
// disputam atenção sem hierarquia e o olho não consegue passar por cima. Traço
// monocromático vira textura calma e devolve o trabalho de distinguir pra COR
// da categoria. Quem individualiza a despesa é o título, que é o que se lê.
//
// Sem categoria (a janela até a IA responder, ou uma descrição que falhou de
// vez) cai no Receipt, que é neutro e não finge ser uma categoria.

type Props = {
  /** Ícone da categoria. Ausente = despesa ainda sem categoria. */
  icon?: LucideIcon | null;
  size?: number;
  /** Cor da categoria. Deve vir com a bolinha em volta na variante pálida
   *  (getCategoryChipColor), senão o traço some no fundo cheio. */
  color: string;
};

// ~80% do círculo que abriga (16px na lista, 26px no hero de 64px). Os 16px da
// lista batem com o ícone do HistoryFeed, que usa o mesmo círculo de 40px na
// aba ao lado — duas abas da mesma tela com glifos de tamanhos diferentes lia
// como descuido.
const ICON_SCALE = 0.8;

export function CategoryIcon({ icon, size = 20, color }: Props) {
  const Icon = icon ?? Receipt;
  return <Icon size={Math.round(size * ICON_SCALE)} color={color} strokeWidth={2.2} />;
}
