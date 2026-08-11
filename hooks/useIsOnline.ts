import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';

/**
 * Se o app considera que há internet agora.
 *
 * Lê do onlineManager, e não do NetInfo direto, de propósito: é ele quem
 * decide se uma mutação sai ou fica pausada na fila (ver app/_layout.tsx, onde
 * os dois são ligados). Consultar o NetInfo por fora abriria espaço pra tela e
 * fila discordarem — um botão dizendo "sem internet" enquanto o envio de fato
 * aconteceria, ou o contrário.
 */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(() => onlineManager.isOnline());

  useEffect(() => onlineManager.subscribe(setOnline), []);

  return online;
}
