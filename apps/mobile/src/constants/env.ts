/**
 * 環境設定（詳細設計§9: dev/beta/prod 分離）
 * APP_ENV は EAS ビルド時に注入される。
 */
import Constants from 'expo-constants';

const ENV = (Constants.expoConfig?.extra?.APP_ENV as string | undefined) ?? 'dev';

const API_BASES: Record<string, string> = {
    dev: 'http://localhost:3000',
    beta: 'https://staging.shikakuno.app',
    prod: 'https://shikakuno.app',
};

export const API_BASE_URL = API_BASES[ENV] ?? API_BASES['dev'];

/** OAuth コールバック用アプリスキーム（詳細設計§5.1） */
export const APP_SCHEME = 'shikakuno';

/** OAuth リダイレクト URI（開発: custom scheme、本番: App Links） */
export const OAUTH_REDIRECT_URI =
    ENV === 'prod'
        ? 'https://shikakuno.app/auth/callback'
        : `${APP_SCHEME}://auth/oauth-result`;
