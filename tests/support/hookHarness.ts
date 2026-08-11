// Roda um hook de dados de verdade — useQuery/useMutation com um QueryClient
// real — e registra quais queryKeys foram invalidadas.
//
// A invalidação é o que estes testes mais precisam observar: é a 1ª das três
// camadas de frescura e a que já saiu incompleta duas vezes. Espionar
// `invalidateQueries` no cliente pega isso sem depender de tela.
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createSupabaseMock, type MockConfig } from './supabaseMock';
import { setSupabaseMock } from '../stubs/supabase';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { LanguageProvider } from '@/hooks/useLanguage';

export type Harness = ReturnType<typeof createHarness>;

export function createHarness(config: MockConfig = {}) {
  const mock = createSupabaseMock(config);
  setSupabaseMock(mock.client);

  const queryClient = new QueryClient({
    defaultOptions: {
      // Sem retry: um erro esperado no teste não pode virar 3 tentativas e
      // timeout.
      //
      // gcTime infinito porque os testes de efeito otimista SEMEIAM o cache
      // (setQueryData) sem nenhum observador montado. Com gcTime 0 a entrada
      // vira lixo no primeiro await — o `cancelQueries` do onMutate basta —, e
      // aí `previousExpenses`/`previousBalances` chegam undefined e o efeito
      // otimista é simplesmente pulado. Dava falha por CORRIDA, não por regra.
      // Não vaza entre testes: cada um monta o seu QueryClient.
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

  const invalidated: string[][] = [];
  const original = queryClient.invalidateQueries.bind(queryClient);
  queryClient.invalidateQueries = (filters?: Parameters<typeof original>[0]) => {
    const key = (filters as { queryKey?: unknown } | undefined)?.queryKey;
    if (Array.isArray(key)) invalidated.push(key.map(String));
    return original(filters);
  };

  // Providers de verdade, não mock de contexto: o AuthProvider lê a sessão pelo
  // `supabase.auth.getSession` mockado, então passar `session` na config já
  // deixa o hook "logado". Ordem importa — AuthProvider usa useQueryClient, e
  // por isso precisa ficar DENTRO do QueryClientProvider.
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(AuthProvider, null, children),
      ),
    );

  return {
    mock,
    queryClient,
    wrapper,
    /** Primeiro elemento de cada queryKey invalidada — é o nome da família. */
    invalidatedNames: () => [...new Set(invalidated.map(k => k[0]))].sort(),
    /** As queryKeys completas, na ordem em que foram invalidadas. */
    invalidatedKeys: () => invalidated.map(k => k.join('/')),
    run: <T,>(hook: () => T) => renderHook(hook, { wrapper }),

    /**
     * Igual a `run`, mas só devolve depois que o AuthProvider resolveu a sessão.
     *
     * O provider lê `supabase.auth.getSession()` dentro de um efeito, então no
     * primeiro render `session` ainda é null. Toda mutação que exige sessão
     * (criar e editar despesa, sair da resenha) estoura "Sessão inválida" se for
     * chamada nesse instante — falha de CORRIDA do teste, não da regra.
     */
    runReady: async <T,>(hook: () => T) => {
      const rendered = renderHook(() => ({ value: hook(), auth: useAuth() }), { wrapper });
      await waitFor(() => {
        if (rendered.result.current.auth.loading) throw new Error('sessão ainda carregando');
      });
      return {
        get result() {
          return { get current() { return rendered.result.current.value; } };
        },
        rerender: rendered.rerender,
        unmount: rendered.unmount,
      };
    },
    dispose: () => {
      queryClient.clear();
      setSupabaseMock(null);
    },
  };
}

export { waitFor, act };
