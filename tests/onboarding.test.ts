// O tour roda ANTES do cadastro, então tudo que a pessoa responde vive no
// AsyncStorage até existir conta pra migrar (decisão de arquitetura no
// CLAUDE.md). Estes testes cobrem esse guarda-e-entrega e, principalmente, o
// que acontece quando o storage falha — o fallback de cada caminho é uma
// decisão de produto diferente, não um `catch` genérico.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  EMPTY_ANSWERS,
  isReadyToCreateGroup,
  getOnboardingAnswers,
  saveOnboardingAnswers,
  isOnboardingDone,
  markOnboardingDone,
  clearOnboardingAnswers,
  resetOnboarding,
  type OnboardingAnswers,
} from '@/lib/onboarding';
import { resetStorage, setStorageFailing } from './stubs/async-storage';

const completo: OnboardingAnswers = { groupType: 'viagem', split: 'equal', name: 'Praia' };

beforeEach(() => resetStorage());

describe('isReadyToCreateGroup — quem ganha resenha criada no cadastro', () => {
  it('só quem respondeu tudo E nomeou a resenha', () => {
    expect(isReadyToCreateGroup(completo)).toBe(true);
  });

  it('faltando qualquer resposta, não cria', () => {
    expect(isReadyToCreateGroup(EMPTY_ANSWERS)).toBe(false);
    expect(isReadyToCreateGroup({ ...completo, groupType: null })).toBe(false);
    expect(isReadyToCreateGroup({ ...completo, split: null })).toBe(false);
    expect(isReadyToCreateGroup({ ...completo, name: null })).toBe(false);
  });

  it('nome só de espaço não conta como nome', () => {
    expect(isReadyToCreateGroup({ ...completo, name: '   ' })).toBe(false);
  });
});

describe('as respostas do tour', () => {
  it('o que foi salvo é o que volta', async () => {
    await saveOnboardingAnswers(completo);
    expect(await getOnboardingAnswers()).toEqual(completo);
  });

  it('sem nada salvo, volta o vazio — não undefined', async () => {
    expect(await getOnboardingAnswers()).toEqual(EMPTY_ANSWERS);
  });

  it('resposta gravada por uma versão ANTIGA ganha os campos que faltam', async () => {
    // O merge com EMPTY_ANSWERS existe pra isso: sem ele, `name` viria
    // undefined e `isReadyToCreateGroup` estouraria no `.trim()`.
    await saveOnboardingAnswers({ groupType: 'republica' } as OnboardingAnswers);
    const lidas = await getOnboardingAnswers();

    expect(lidas).toEqual({ groupType: 'republica', split: null, name: null });
    expect(() => isReadyToCreateGroup(lidas)).not.toThrow();
  });

  it('JSON corrompido não derruba o tour — volta o vazio', async () => {
    await saveOnboardingAnswers(completo);
    setStorageFailing(true);

    expect(await getOnboardingAnswers()).toEqual(EMPTY_ANSWERS);
  });

  it('falha ao salvar é engolida: no pior caso a resenha nasce sem os padrões', async () => {
    setStorageFailing(true);
    await expect(saveOnboardingAnswers(completo)).resolves.toBeUndefined();
  });

  it('limpar tira as respostas e MANTÉM a marca de tour visto', async () => {
    await saveOnboardingAnswers(completo);
    await markOnboardingDone();

    await clearOnboardingAnswers();

    expect(await getOnboardingAnswers()).toEqual(EMPTY_ANSWERS);
    expect(await isOnboardingDone()).toBe(true);
  });
});

describe('a marca de "já viu o tour"', () => {
  it('primeira abertura: ainda não viu', async () => {
    expect(await isOnboardingDone()).toBe(false);
  });

  it('depois de marcar, não roda de novo', async () => {
    await markOnboardingDone();
    expect(await isOnboardingDone()).toBe(true);
  });

  it('falha de LEITURA conta como "já viu" — melhor pular do que prender', async () => {
    // O fallback é o contrário do de salvar, de propósito: prender a pessoa no
    // tour por causa de um erro de storage é pior do que pulá-lo.
    setStorageFailing(true);
    expect(await isOnboardingDone()).toBe(true);
  });

  it('resetOnboarding devolve o app ao estado de quem nunca viu', async () => {
    await saveOnboardingAnswers(completo);
    await markOnboardingDone();

    await resetOnboarding();

    expect(await isOnboardingDone()).toBe(false);
    expect(await getOnboardingAnswers()).toEqual(EMPTY_ANSWERS);
  });
});
