import { LoginForm } from '@/components/features/auth/LoginForm';
import { Suspense } from 'react';
import styles from './page.module.css';

export default function LoginPage() {
    return (
        <div className={styles.page}>
            <Suspense fallback={<div>Loading...</div>}>
                <LoginForm />
            </Suspense>
        </div>
    );
}
