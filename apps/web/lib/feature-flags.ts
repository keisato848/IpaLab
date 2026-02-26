import { getContainer } from './cosmos';

/**
 * フィーチャーフラグのデータ型
 */
export interface FeatureFlag {
    /** フラグID（例: "ads_enabled", "rewarded_ad_enabled"） */
    id: string;
    /** 有効/無効 */
    enabled: boolean;
    /** フラグの説明 */
    description: string;
    /** 更新日時（ISO 8601） */
    updatedAt: string;
    /** 更新者のユーザーID */
    updatedBy: string;
}

/** デフォルトのフィーチャーフラグ定義 */
const DEFAULT_FLAGS: Omit<FeatureFlag, 'updatedAt' | 'updatedBy'>[] = [
    {
        id: 'ads_enabled',
        enabled: false,
        description: '広告表示の有効化（全体制御）',
    },
    {
        id: 'rewarded_ad_enabled',
        enabled: false,
        description: 'リワード広告の有効化（試験開始時）',
    },
    {
        id: 'ai_plan_enabled',
        enabled: true,
        description: 'AI学習計画機能の有効化',
    },
];

/**
 * 全フィーチャーフラグを取得する
 */
export async function getAllFeatureFlags(): Promise<FeatureFlag[]> {
    const container = await getContainer('FeatureFlags');
    if (!container) return getDefaultFlags();

    try {
        const { resources } = await container.items
            .query<FeatureFlag>('SELECT * FROM c ORDER BY c.id')
            .fetchAll();

        if (resources.length === 0) {
            return getDefaultFlags();
        }

        return resources;
    } catch {
        return getDefaultFlags();
    }
}

/**
 * 指定したフィーチャーフラグを取得する
 */
export async function getFeatureFlag(id: string): Promise<FeatureFlag | null> {
    const container = await getContainer('FeatureFlags');
    if (!container) {
        const defaultFlag = DEFAULT_FLAGS.find(f => f.id === id);
        return defaultFlag
            ? { ...defaultFlag, updatedAt: new Date().toISOString(), updatedBy: 'system' }
            : null;
    }

    try {
        const { resource } = await container.item(id, id).read<FeatureFlag>();
        return resource || null;
    } catch {
        return null;
    }
}

/**
 * フィーチャーフラグの有効状態を簡易取得する
 */
export async function isFeatureEnabled(id: string): Promise<boolean> {
    const flag = await getFeatureFlag(id);
    if (!flag) {
        // デフォルト定義から取得
        const defaultFlag = DEFAULT_FLAGS.find(f => f.id === id);
        return defaultFlag?.enabled ?? false;
    }
    return flag.enabled;
}

/**
 * フィーチャーフラグを更新する
 */
export async function updateFeatureFlag(
    id: string,
    enabled: boolean,
    updatedBy: string
): Promise<FeatureFlag | null> {
    const container = await getContainer('FeatureFlags');
    if (!container) return null;

    try {
        const existing = await getFeatureFlag(id);
        const defaultDef = DEFAULT_FLAGS.find(f => f.id === id);

        const flagData: FeatureFlag = {
            id,
            enabled,
            description: existing?.description || defaultDef?.description || '',
            updatedAt: new Date().toISOString(),
            updatedBy,
        };

        await container.items.upsert(flagData);
        return flagData;
    } catch (error) {
        console.error('[FeatureFlags] フラグ更新エラー (%s):', id, error);
        return null;
    }
}

/**
 * フィーチャーフラグを初期化する（存在しないフラグのみ作成）
 */
export async function initializeFeatureFlags(): Promise<void> {
    const container = await getContainer('FeatureFlags');
    if (!container) return;

    for (const defaultFlag of DEFAULT_FLAGS) {
        try {
            const { resource } = await container.item(defaultFlag.id, defaultFlag.id).read();
            if (!resource) {
                await container.items.create({
                    ...defaultFlag,
                    updatedAt: new Date().toISOString(),
                    updatedBy: 'system',
                });
            }
        } catch {
            // 404 の場合は作成
            try {
                await container.items.create({
                    ...defaultFlag,
                    updatedAt: new Date().toISOString(),
                    updatedBy: 'system',
                });
            } catch {
                // 重複エラー等は無視
            }
        }
    }
}

/** デフォルトフラグの一覧を返す */
function getDefaultFlags(): FeatureFlag[] {
    return DEFAULT_FLAGS.map(f => ({
        ...f,
        updatedAt: new Date().toISOString(),
        updatedBy: 'system',
    }));
}
