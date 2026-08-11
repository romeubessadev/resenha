// `hooks/useRefreshOnFocus.ts` é o único a usar isto, e o pacote real arrasta o
// react-native (Flow, que o node não parseia) por ser externalizado.
//
// `useEffect` no lugar de `useFocusEffect` equivale ao PRIMEIRO foco — que é
// justamente o que useRefreshOnFocus pula de propósito, pra não duplicar o fetch
// inicial. Ou seja: em teste, montar o hook não dispara refetch, que é o
// comportamento real de montar uma tela.
import { useEffect } from 'react';

export function useFocusEffect(effect: () => void | (() => void)): void {
  useEffect(effect, [effect]);
}
