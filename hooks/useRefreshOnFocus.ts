import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

type RefreshableQuery = { refetch: () => void; isStale: boolean };

// expo-router mantém a tela anterior montada ao navegar (stack nativo), então
// o refetchOnMount do TanStack Query sozinho não recarrega ao voltar pra ela.
// Pula o refetch no primeiro foco pra não duplicar o fetch inicial do useQuery.
// Só refaz o fetch se a query já passou do staleTime — senão cada troca de
// aba/voltar da tela dispararia rede de novo mesmo com nada mudado.
export function useRefreshOnFocus(query: RefreshableQuery) {
  const enabledRef = useRef(false);
  // Ref em vez de dep do useCallback: garante que o valor de isStale lido
  // seja sempre o mais atual no momento do foco, sem recriar o callback
  // (e reacionar o useFocusEffect) a cada render por causa dele mudar.
  const queryRef = useRef(query);
  queryRef.current = query;

  useFocusEffect(
    useCallback(() => {
      if (enabledRef.current) {
        if (queryRef.current.isStale) queryRef.current.refetch();
      } else {
        enabledRef.current = true;
      }
    }, []),
  );
}
