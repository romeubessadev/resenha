import { translate, type Language, type TranslationKey } from '@/lib/i18n';

// O app é exclusivo do Brasil: idioma único, sem seleção e sem persistência.
//
// O hook CONTINUA existindo, com a mesma forma de antes (`language` e `t`),
// porque é ele que 76 arquivos chamam. Trocá-lo por importar `translate`
// direto seria um diff enorme em troca de nada — e este arquivo é o único
// lugar que precisaria mudar se um dia voltar a ter escolha de idioma.
//
// `language` segue exposto porque várias telas o passam pra
// `toLocaleDateString` e afins, que recebem locale.
const LANGUAGE: Language = 'pt-BR';

// `t` e o objeto devolvido são MÓDULO, não criados por render.
//
// Não é micro-otimização: várias telas usam `t` como dependência de useMemo
// (useCategories, insight, o filtro de busca da resenha). Na versão de contexto
// isso era inofensivo, porque `t` nascia uma vez no provider, lá em cima, e
// sobrevivia aos re-renders dos filhos. Um `t` novo a cada chamada faria esses
// useMemo recalcularem sempre, devolvendo array novo toda vez — e quem depende
// desse array re-renderiza em loop.
const t = (key: TranslationKey, params?: Record<string, string | number>) => translate(LANGUAGE, key, params);

const VALUE = { language: LANGUAGE, t } as const;

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useLanguage() {
  return VALUE;
}
