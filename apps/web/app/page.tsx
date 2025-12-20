import styles from "./page.module.css";
import { sharedTest } from "@ipa-lab/shared";

export default function Home() {
    const sharedMessage = sharedTest();

    return (
        <main className={styles.main}>
            <h1 className={styles.title}>PM Exam DX Dashboard</h1>
            <p className={styles.description}>
                Status: Active
                <br />
                Shared Logic: {sharedMessage}
            </p>
        </main>
    );
}
