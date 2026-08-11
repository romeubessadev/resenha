import { useMyProfile } from './useProfile';

/** Único ponto de leitura de "é Bros+?" no app — nenhum componente deve ler
 *  profiles.is_premium direto. */
export function useIsPremium(): boolean {
  const { data } = useMyProfile();
  return data?.is_premium ?? false;
}
