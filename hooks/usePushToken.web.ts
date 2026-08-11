// Versão web — expo-notifications não suporta getExpoPushTokenAsync nem
// useLastNotificationResponse nessa plataforma (o app roda em web só pra
// preview, nunca vai receber push de verdade por aqui). Mesmos exports da
// versão nativa (usePushToken.ts), pra quem importa não precisar checar
// plataforma — o bundler escolhe o arquivo certo sozinho pela extensão.

export const NOTIF_PREF_KEY = 'resenha:notif';

export async function registerPushToken(_userId: string): Promise<void> {}

export async function unregisterPushToken(_userId: string): Promise<void> {}

export function usePushToken(): void {}
