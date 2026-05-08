# Exam Data Management Dry-run Example

## Local Audit

```powershell
node .github/skills/exam-data-management/scripts/local-exam-data-audit.mjs --json
```

期待する完了条件:

```json
{
  "status": "LOCAL_EXAM_DATA_AUDIT_OK",
  "blockingIssueCount": 0,
  "missingPublishedExamCount": 0
}
```

## Cosmos Dry-run

```powershell
$env:COSMOS_DB_CONNECTION = "<Azure CLI や Key Vault から取得した値。出力しない>"
node .github/skills/exam-data-management/scripts/cosmos-questions-sync-plan.mjs --dry-run --json
Remove-Item Env:COSMOS_DB_CONNECTION
```

期待する観点:

```json
{
  "status": "COSMOS_QUESTIONS_SYNC_DRY_RUN",
  "placeholderDeleteCount": 102,
  "upsertCount": 3304,
  "missingExpectedCount": 320
}
```

`--apply` はユーザー承認後のみ実行する。

```powershell
node .github/skills/exam-data-management/scripts/cosmos-questions-sync-plan.mjs --apply --confirm-production-write --json
```