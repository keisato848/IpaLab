import { Octokit } from 'octokit';

interface CreateBugReportParams {
    description: string;
    pageUrl: string;
    userAgent: string;
    errorLogs?: string;
    screenshotUrl?: string;
}

export async function createBugReportIssue(params: CreateBugReportParams): Promise<{ number: number; html_url: string }> {
    const token = process.env.GITHUB_ISSUES_TOKEN;
    const repo = process.env.GITHUB_ISSUES_REPO;

    if (!token || !repo) {
        throw new Error('GITHUB_ISSUES_TOKEN or GITHUB_ISSUES_REPO is not configured');
    }

    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) {
        throw new Error('GITHUB_ISSUES_REPO must be in owner/repo format');
    }

    const octokit = new Octokit({ auth: token });

    const titleSuffix = params.description.length > 50
        ? params.description.substring(0, 50) + '...'
        : params.description;

    const body = `## 障害報告 (AI Assistant)

### 報告内容
${params.description}

### ページ URL
${params.pageUrl}

### User Agent
${params.userAgent}

${params.errorLogs ? `### エラーログ\n\`\`\`json\n${params.errorLogs}\n\`\`\`\n` : ''}
${params.screenshotUrl ? `### スクリーンショット\n![screenshot](${params.screenshotUrl})\n` : ''}

---
*この Issue は AI アシスタントの障害報告機能から自動起票されました。*
`;

    const response = await octokit.rest.issues.create({
        owner,
        repo: repoName,
        title: `[AI Assistant] ${titleSuffix}`,
        body,
        labels: ['bug', 'ai-assistant-report'],
    });

    return {
        number: response.data.number,
        html_url: response.data.html_url,
    };
}
