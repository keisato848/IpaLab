# Shikakuno (シカクノ) - IPA Exam Prep Platform

**Shikakuno** (シカクノ) is an intelligent learning platform designed for IPA (Information-technology Promotion Agency) exams, specifically targeting the **Applied Information Technology Engineer Examination (AP)**.

It features a cutting-edge **AI Descriptive Scoring System** that provides instant, analytical feedback for afternoon (PM) case study questions, helping leaners overcome the difficulty of self-grading descriptive answers.

## 🚀 Key Features

### **【New!】AI Descriptive Scoring (PM Exam Support)**
Unlock the power of **Google Gemini 1.5 Pro** to grade your AP afternoon exams instantly.
*   **Instant Feedback**: Get scores and logic analysis for descriptive answers in seconds.
*   **CLKS Analysis**: Visualize your answer quality based on 4 axes:
    *   **Context (文脈)**: Adherence to the case study scenario.
    *   **Logic (論理)**: Logical flow and reasoning.
    *   **Keyword (KW)**: Usage of critical technical terms.
    *   **Specificity (具体性)**: Clarity and detail of the explanation.
*   **Radar Chart**: Track your strengths and weaknesses visually.

### Other Features
*   **Morning Exam (AM) Support**: Interactive multiple-choice practice with instant explanations.
*   **Learning Statistics**: Track your progress with detailed charts, history, and accuracy rates (Overall / Session / Per-Exam).
*   **Responsive Design**: Optimized for both Desktop (Split View) and Mobile learning.
*   **Dark Mode**: Comfortable learning environment for night owls.

## 🛠️ Technology Stack
*   **Framework**: Next.js 14 (App Router)
*   **Database**: Azure Cosmos DB (NoSQL)
*   **AI Model**: Google Gemini 1.5 Pro
*   **Authentication**: NextAuth.js (Google / GitHub)
*   **Hosting**: Azure Static Web Apps
*   **Styling**: CSS Modules (Zero-runtime overhead)

## 📂 Project Structure
*   `apps/web`: Next.js Frontend Application.
*   `apps/api`: (Legacy) Azure Functions API (Migrated to Next.js API Routes).
*   `packages/data`: Data management tools (Scrapers, OCR, Sync scripts).
*   `packages/shared`: Shared TypeScript types and utilities.

## 🚀 Getting Started

### Prerequisites
*   Node.js 18+
*   npm 9+

### Installation
```bash
npm install
```

### Development
```bash
npm run dev -w apps/web
```

### Environment Variables
See `.env.example` (if available) or configure:
*   `GEMINI_API_KEY`
*   `COSMOS_DB_ENDPOINT`
*   `COSMOS_DB_KEY`
*   `NEXTAUTH_SECRET`
