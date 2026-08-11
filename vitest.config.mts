import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Barras pra frente: o alias do Vite compara e substitui id de módulo, que nunca
// usa a barra invertida do Windows.
const root = fileURLToPath(new URL('.', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const stub = (name: string) => `${root}/tests/stubs/${name}`;

export default defineConfig({
  plugins: [
    {
      // Todo import de `lib/supabase` cai no stub, venha ele como
      // `@/lib/supabase` ou como `./supabase` (é assim que settlementProof,
      // receipt e os avatares o importam). Alias resolve especificador, não
      // caminho — só um plugin alcança as duas formas.
      name: 'bros:stub-supabase-client',
      enforce: 'pre',
      async resolveId(source, importer, options) {
        if (!/supabase/.test(source)) return null;
        const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
        if (!resolved) return null;
        return resolved.id.replace(/\\/g, '/').endsWith('/lib/supabase.ts')
          ? stub('supabase.ts')
          : null;
      },
    },
  ],
  // `__DEV__` é global do React Native. Vários hooks logam avisos sob ele —
  // sem definir aqui, tocar nesses caminhos estoura ReferenceError no node.
  define: { __DEV__: 'false' },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Só código do app. `database.types.ts` é tipo gerado, sem execução.
      include: ['app/**', 'components/**', 'hooks/**', 'lib/**'],
      exclude: ['lib/database.types.ts', '**/*.d.ts'],
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
  resolve: {
    // Só lógica pura é testada aqui — nada renderiza. Os stubs existem porque
    // `lib/recurrence.ts` importa o helper puro `nextOccurrenceAfter` de
    // `hooks/useExpenseForm.ts`, e esse arquivo arrasta react-native,
    // expo-image-picker e (via lib/receipt) o client do Supabase só por ser um
    // arquivo de hook. Nenhum teste exercita esses módulos.
    alias: [
      // Inclui import profundo (`react-native/Libraries/...`): o RN de verdade
      // é Flow e o node não parseia. Não casa com `react-native-svg` — depois
      // de "react-native" só aceita "/" ou fim.
      { find: /^react-native(\/.*)?$/, replacement: stub('react-native.ts') },
      { find: /^lucide-react-native$/, replacement: stub('lucide-react-native.ts') },
      { find: /^@react-navigation\/native$/, replacement: stub('react-navigation-native.ts') },
      { find: /^react-native-url-polyfill\/auto$/, replacement: stub('empty.ts') },
      // Storage de verdade (em memória): lib/onboarding.ts é testado por ele.
      { find: /^@react-native-async-storage\/async-storage$/, replacement: stub('async-storage.ts') },
      { find: /^expo-image-picker$/, replacement: stub('empty.ts') },
      // Id gerado no client — o teste precisa saber qual saiu (ver o stub).
      { find: /^expo-crypto$/, replacement: stub('expo-crypto.ts') },
      // Só pra `lib/insightsExport.ts` carregar: o que se testa nele é puro.
      { find: /^expo-(file-system|print|sharing)$/, replacement: stub('expo-io.ts') },
      // Especificador que só o Deno resolve — usado pelas Edge Functions, que
      // rodam no vitest pelo harness de tests/edge/.
      { find: /^jsr:@supabase\/supabase-js@2$/, replacement: stub('jsr-supabase.ts') },
      { find: /^npm:standardwebhooks@1\.0\.0$/, replacement: stub('standardwebhooks.ts') },
      // `lib/receipt` não precisa mais de stub: com o client mockado pelo
      // plugin acima, o código real dele roda contra o mock.
      // Depois dos específicos: este casa qualquer outro '@/...' no caminho real.
      { find: /^@\//, replacement: `${root}/` },
    ],
  },
});
