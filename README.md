# Shikakuno (シカクノ) - IPA Exam Prep Platform

[![Azure Static Web Apps CI/CD](https://github.com/hayato-git/IpaLab/actions/workflows/azure-static-web-apps.yml/badge.svg)](https://github.com/hayato-git/IpaLab/actions/workflows/azure-static-web-apps.yml)

**Shikakuno (シカクノ)** is an intelligent learning platform for IPA (Information-technology Promotion Agency) certification exams in Japan. It features a cutting-edge **AI Descriptive Scoring System** that provides instant, analytical feedback for case study questions, helping learners overcome the challenge of self-grading descriptive answers.

## Table of Contents

- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Available Scripts](#-available-scripts)

## ✨ Key Features

- **AI-Powered Scoring**: Utilizes Google's Gemini Pro models to provide instant, multi-faceted feedback on descriptive answers for afternoon (PM) exams.
- **CLKS Analysis**: Grades answers based on four axes: **C**ontext, **L**ogic, **K**eyword, and **S**pecificity, visualized with a radar chart.
- **Interactive Practice**: Supports multiple-choice questions for morning (AM) exams with instant answer explanations.
- **Progress Tracking**: Offers detailed statistics, charts, and history to monitor learning progress and accuracy rates.
- **Modern UI/UX**: Fully responsive design optimized for both desktop and mobile, complete with a dark mode.

## 🛠️ Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Monorepo**: Turborepo & npm Workspaces
- **Database**: Azure Cosmos DB (NoSQL)
- **AI Model**: Google Gemini Pro family
- **Authentication**: NextAuth.js (Google, GitHub)
- **Hosting**: Azure Static Web Apps
- **Styling**: CSS Modules

## 📂 Project Structure

This project is a monorepo managed with Turborepo.

- `apps/web`: The main Next.js application. It contains all UI pages, API routes, and frontend logic.
- `apps/api`: **(Legacy)** A legacy Azure Functions API. Its functionality has been migrated into `apps/web` as Next.js API Routes.
- `packages/data`: Contains scripts and tools for data scraping, processing, and synchronization with the database.
- `packages/shared`: Shared TypeScript types, interfaces, and utility functions used across the monorepo.
- `packages/config`: Shared configurations for tools like ESLint and TypeScript.

## 🚀 Getting Started

### 1. Prerequisites

- Node.js v20 or later
- npm v9 or later

### 2. Installation

Clone the repository and install the dependencies from the root directory:

```bash
git clone https://github.com/hayato-git/IpaLab.git
cd IpaLab
npm install
```

### 3. Environment Variables

The web application requires environment variables for API keys and database connections.

1.  Navigate to the web app directory: `cd apps/web`
2.  Create a local environment file by copying the template:
    ```bash
    cp .env.template .env.local
    ```
3.  Fill in the variables in `.env.local`. You will need credentials for:
    - **Authentication (NextAuth.js)**: `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, etc.
    - **Database (Azure Cosmos DB)**: `COSMOS_DB_ENDPOINT`, `COSMOS_DB_KEY`
    - **AI (Google Gemini)**: `GEMINI_API_KEY`

    Your completed `.env.local` should look something like this:
    ```env
    # Auth.js
    AUTH_SECRET="..."
    AUTH_GITHUB_ID="..."
    AUTH_GITHUB_SECRET="..."
    AUTH_GOOGLE_ID="..."
    AUTH_GOOGLE_SECRET="..."

    # Database
    COSMOS_DB_ENDPOINT="..."
    COSMOS_DB_KEY="..."
    
    # AI
    GEMINI_API_KEY="..."

    # This is for local dev, pointing to the Azure Functions emulator or a running instance.
    # When running the Next.js app alone, this can be ignored as API routes are served from the same domain.
    NEXT_PUBLIC_API_BASE=http://localhost:7074/api
    ```

### 4. Run the Development Server

Return to the root directory and run the development script:

```bash
# From the project root
npm run dev
```

This will start the Next.js development server, typically available at `http://localhost:3000`.

## 📜 Available Scripts

The following scripts can be run from the root of the monorepo:

- `npm run dev`: Starts the development server for all apps.
- `npm run build`: Builds all apps for production.
- `npm run test`: Runs tests across the project.
- `npm run lint`: Lints all the code in the project.
- `npm run format`: Formats all code using Prettier.
