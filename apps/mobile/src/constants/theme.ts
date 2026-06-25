/**
 * シカクノ デザインカラートークン（モバイル）
 *
 * 出典: apps/web の globals.css（shikakuno Web版のブランドカラー）。
 * Web版とUI/UXの一貫性を保つため、モバイルもこのトークンを正とする。
 * （和風の金茶パレットは daidoko のものであり、shikakuno では使用しない）
 *
 * モバイルはダークテーマを基調とする（Web版ダークモードに対応）。
 */
export const colors = {
    // 背景
    bgPrimary: '#0F1117', // 画面背景（Web --bg-primary dark）
    bgSecondary: '#1A202C', // カード・セクション（Web --bg-secondary dark）
    bgElevated: '#252D3D', // 浮き上がり要素

    // テキスト
    textPrimary: '#F7FAFC', // 主要テキスト
    textSecondary: '#CBD5E0', // 副次テキスト
    textMuted: '#94A3B8', // 控えめなメタ情報
    textTertiary: '#718096', // 補助・キャプション

    // アクセント（shikakuno のブランドカラー = 青）
    accent: '#0070F3',
    accentHover: '#0060DF',
    accentAlpha: 'rgba(0, 112, 243, 0.2)',

    // 境界
    border: '#2D3748',

    // ステータス
    success: '#34D399',
    successText: '#047857',
    error: '#F87171',
    errorText: '#B91C1C',
    warning: '#FBBF24',

    // OAuth プロバイダー（各社ブランド色：変更しない）
    google: '#4285F4',
    github: '#24292F',

    // 共通
    white: '#FFFFFF',
} as const;

export type AppColors = typeof colors;
