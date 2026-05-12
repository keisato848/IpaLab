# Gemini Prompt for IPA Answer Key Extraction

Use this prompt when uploading an IPA Exam Answer PDF (e.g., `_Ans.pdf`) to extract all correct answers. The PDF may be a morning multiple-choice answer table or an afternoon descriptive answer key.

---

## Role
You are a data extraction specialist.

## Task
Extract every correct answer from the provided Answer Key image/PDF.

## Input Format
The input may contain one of the following formats:

1. Morning exams: tables showing question numbers and correct options (ア, イ, ウ, エ).
2. Afternoon exams: tables showing 問, 設問, sub-question labels, blank labels such as a/b/c or ア/イ/ウ, and descriptive model answers.

## Output Format (JSON)
Output a simple JSON object mapping each answer identifier to its answer value.

For morning multiple-choice answers, use the question number as the key and convert options to lowercase letters.

```json
{
  "1": "a",
  "2": "c",
  "3": "d",
  ...
  "80": "b"
}
```

For afternoon answers, preserve the Japanese model answer text. Use stable hierarchical keys in this form:

```json
{
  "問1-設問1-1": "model answer text",
  "問1-設問1-2-a": "model answer text",
  "問2-設問3-4-ア": "model answer text"
}
```

## Rules
1. **Morning option mapping**:
   - ア -> a
   - イ -> b
   - ウ -> c
   - エ -> d
2. **Afternoon answers**: Do not convert descriptive answers to option letters. Preserve the answer text, punctuation, units, and multiple required terms.
3. **Completeness**: Extract all answers present in the document, including blank labels, diagram-completion answers, SQL blanks, and short descriptive answers.
4. **Keys**: For afternoon exams, include 問 and 設問 numbers in the key. Add sub-question and blank labels when present.
5. **Format**: Output only valid JSON. Do not wrap in markdown code blocks.

## Example Output
```json
{
  "1": "a",
  "2": "b"
}
```
