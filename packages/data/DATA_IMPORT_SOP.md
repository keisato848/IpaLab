# Data Import & Verification SOP

## 1. Overview
This document outlines the standard procedure for importing exam data, generating explanations, and ensuring data integrity (preventing duplicates and missing data).

## 2. Pre-Requisites
-   Ensure `.env` contains valid `COSMOS_DB_CONNECTION`.
-   Ensure `GEMINI_API_KEY` (or `GEMINI_API_KEY_2` etc.) is set if using AI generation.

## 3. Data Extraction & processing
### A. Extraction
When adding new exams (PDFs), run the extraction script.
```bash
npm run extract -w packages/data
```

### B. AI Explanation Generation (AP Exams)
For exams missing explanations (AP Morning):
```bash
# Verify settings in src/scripts/fill-missing-explanations.ts (Key selection, Parallelism)
npx ts-node src/scripts/fill-missing-explanations.ts
```

### C. Answer Key Fixing
If `correctOption` is missing:
```bash
npx ts-node src/scripts/fix-answers.ts
```

## 4. Pre-Sync Verification (CRITICAL)
Before syncing to the database, verify the JSON data integrity.

### Check for Duplicates
Run the duplicate checker **before** syncing to ensure the source is clean (though duplications usually occur during the sync/upsert process if IDs change).
```bash
npx ts-node src/scripts/check-duplicates.ts
```

## 5. Database Synchronization
Push the local JSON data to Cosmos DB.
**Note:** The sync script performs an upsert. If the ID logic changes, it may create duplicates.
```bash
npm run sync-db -w packages/data
```

## 6. Post-Sync Verification (MANDATORY)
After `sync-db` completes, **ALWAYS** run the duplicate checker to ensure no duplicates were created.

```bash
npx ts-node src/scripts/check-all-duplicates.ts
```

### If Duplicates are Found:
1.  **Do NOT** ignore them.
2.  Run the fix script immediately:
    ```bash
    npx ts-node src/scripts/fix-all-duplicates.ts
    ```
3.  Re-run `check-all-duplicates.ts` to confirm "No duplicates found".

## 7. Frontend Verification
1.  Launch the Web App (`npm run dev -w apps/web`).
2.  Check the "Exam List" page.
3.  Verify the newly added/updated exams load correctly.
