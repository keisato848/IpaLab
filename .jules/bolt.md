## 2026-01-21 - Heavy Library Main Thread Blocking
**Learning:** Static imports of large visualization libraries (like `mermaid.js`) inside client components cause synchronous evaluation of the library code when the chunk loads, even if the component is dynamically imported. This blocks the main thread and can trigger browser "timeout" warnings or unresponsive pages.
**Action:** Always use `import('library')` inside `useEffect` for heavy, client-side-only libraries to ensure they load asynchronously and don't block the UI thread during hydration or navigation.
