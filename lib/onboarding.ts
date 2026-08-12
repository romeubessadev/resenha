import AsyncStorage from '@react-native-async-storage/async-storage';

const DONE_KEY = 'resenha:onboarding-done';
const ANSWERS_KEY = 'resenha:onboarding-answers';

export type OnboardingGroupType = 'viagem' | 'republica' | 'galera' | 'outro';
/** Mesmos valores de `expenses.split_type` — o que a pessoa escolhe aqui vira
 *  o padrão da primeira resenha, então guardar já no vocabulário do banco evita
 *  uma tradução a mais depois. */
export type OnboardingSplit = 'equal' | 'exact' | 'shares';
export type OnboardingAnswers = {
  groupType: OnboardingGroupType | null;
  split: OnboardingSplit | null;
  /** Nome que a pessoa deu à resenha na prévia — é o nome da resenha que nasce
   *  depois do cadastro. Nulo enquanto ela não chegou lá. */
  name: string | null;
};

export const EMPTY_ANSWERS: OnboardingAnswers = { groupType: null, split: null, name: null };

/** Respondeu as duas perguntas e chegou na prévia — só quem viu a tela que
 *  promete "Sua resenha tá montado" ganha a resenha criada no cadastro. */
export function isReadyToCreateGroup(a: OnboardingAnswers): boolean {
  return !!(a.groupType && a.split && a.name?.trim());
}

export async function getOnboardingAnswers(): Promise<OnboardingAnswers> {
  try {
    const raw = await AsyncStorage.getItem(ANSWERS_KEY);
    if (!raw) return EMPTY_ANSWERS;
    return { ...EMPTY_ANSWERS, ...JSON.parse(raw) };
  } catch {
    return EMPTY_ANSWERS;
  }
}

export async function saveOnboardingAnswers(answers: OnboardingAnswers): Promise<void> {
  try {
    await AsyncStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
  } catch {
    // Não é crítico — no pior caso a primeira resenha nasce sem os padrões.
  }
}

/** O tour só roda na primeira abertura. Vale pra qualquer saída dele —
 *  terminar, pular ou ir direto pro "já tenho conta" —, senão quem só quer
 *  entrar na conta reencontraria o tour a cada abertura. */
export async function isOnboardingDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DONE_KEY)) === '1';
  } catch {
    // Falha de leitura conta como "já viu": melhor pular o tour do que
    // prender a pessoa nele por causa de um erro de storage.
    return true;
  }
}

export async function markOnboardingDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(DONE_KEY, '1');
  } catch {
    // Não é crítico — no pior caso o tour aparece de novo na próxima abertura.
  }
}

/** Chamado depois que a resenha configurada no tour foi criada de verdade — daí
 *  em diante as respostas não têm mais uso. A flag de "já viu o tour" fica. */
export async function clearOnboardingAnswers(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ANSWERS_KEY);
  } catch {
    // Ignorado: no pior caso a próxima abertura tenta criar de novo e a guarda
    // de "conta sem nenhuma resenha" barra.
  }
}

/** Só pra desenvolvimento: devolve o app ao estado de quem nunca viu o tour,
 *  sem precisar reinstalar. Chamado apenas de dentro de um `__DEV__`. */
export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([DONE_KEY, ANSWERS_KEY]);
  } catch {
    // Idem — é ferramenta de teste, não vale derrubar nada por causa dela.
  }
}
