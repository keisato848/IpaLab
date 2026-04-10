import { LoginForm } from '@/components/features/auth/LoginForm';
import { Suspense } from 'react';
import styles from './page.module.css';

export default function LoginPage() {
    // STAGING_BYPASS_TOKEN の有無で Staging 专用ログインUIを切り替える（本番ビルドには影響しない）
    const isStagingMode = !!process.env.STAGING_BYPASS_TOKEN;
    return (
        <div className={styles.page}>
            <Suspense fallback={<div>Loading...</div>}>
                <LoginForm isStagingMode={isStagingMode} />
            </Suspense>
        </div>
    );
}
