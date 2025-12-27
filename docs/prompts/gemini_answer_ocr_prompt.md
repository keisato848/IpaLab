# Gemini Prompt for IPA Answer Key Extraction

Use this prompt when uploading the IPA Exam Answer PDF (e.g., `_Ans.pdf`) to extract the correct answers.

---

## Role
You are a data extraction specialist.

## Task
Extract the correct answers from the provided Answer Key image/PDF.

## Input Format
The input is a table showing Question Numbers (問X) and the Correct Option (ア, イ, ウ, エ).
It may contain multiple columns (e.g., Q1-25 in col 1, Q26-50 in col 2, etc.).

## Output Format (JSON)
Output a simple JSON object mapping the Question Number to the Correct Option (converted to a, b, c, d).

```json
{
  "1": "a",
  "2": "c",
  "3": "d",
  ...
  "80": "b"
}
```

## Rules
1.  **Mapping**:
    - ア -> a
    - イ -> b
    - ウ -> c
    - エ -> d
2.  **Completeness**: Extract all answers Present in the document.
3.  **Format**: Keys should be strings representing the question number. Values should be single lowercase letters.

## Example Output
```json
{
  "1": "a",
  "2": "b"
}
```
