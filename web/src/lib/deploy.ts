// ============================================================
// 관리자 "배포" 버튼 — GitHub Actions 의 deploy 워크플로(.github/workflows/deploy.yml)를
// workflow_dispatch 로 실행하고 최근 실행 기록을 읽는다. 실제 빌드·마이그레이션·sst deploy 는
// 전부 워크플로가 한다 (OpenNext 는 리눅스 러너에서만 빌드된다 — docs/배포.md).
//
// 필요한 설정 (.env.deploy.<stage>):
//   GITHUB_DEPLOY_TOKEN  이 저장소 하나만, Actions 읽기·쓰기 권한의 fine-grained PAT
//   GITHUB_DEPLOY_REPO   (선택) owner/repo — 기본 likethisfeelo/petlifewith.me
//   GITHUB_DEPLOY_REF    (선택) 배포할 브랜치 — 기본 main
// ============================================================
import { getOptionalEnv } from "./config";

export type DeployStage = "dev" | "prod";
export const DEPLOY_STAGES: readonly DeployStage[] = ["dev", "prod"];

const WORKFLOW_FILE = "deploy.yml";
const API = "https://api.github.com";

export interface DeployConfig {
  token: string;
  repo: string;
  ref: string;
}

export function deployConfig(): DeployConfig | null {
  const token = getOptionalEnv("GITHUB_DEPLOY_TOKEN");
  if (!token) return null;
  return {
    token,
    repo: getOptionalEnv("GITHUB_DEPLOY_REPO") ?? "likethisfeelo/petlifewith.me",
    ref: getOptionalEnv("GITHUB_DEPLOY_REF") ?? "main",
  };
}

export function deployActionsUrl(repo: string): string {
  return `https://github.com/${repo}/actions/workflows/${WORKFLOW_FILE}`;
}

function headers(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "petlifewith.me-admin",
  };
}

/** 워크플로 실행 요청. 성공하면 null, 실패하면 화면에 보여 줄 문구 */
export async function dispatchDeploy(cfg: DeployConfig, stage: DeployStage): Promise<string | null> {
  const res = await fetch(`${API}/repos/${cfg.repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: "POST",
    headers: { ...headers(cfg.token), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: cfg.ref, inputs: { stage } }),
    cache: "no-store",
  });
  if (res.status === 204) return null;
  if (res.status === 401) return "GitHub 토큰이 만료됐거나 올바르지 않습니다 (GITHUB_DEPLOY_TOKEN).";
  if (res.status === 403 || res.status === 404) return "GitHub 토큰에 이 저장소의 Actions 쓰기 권한이 없습니다.";
  if (res.status === 422) return `브랜치 "${cfg.ref}" 를 찾을 수 없거나 워크플로 입력이 맞지 않습니다.`;
  return `GitHub 응답 오류 (${res.status}).`;
}

export interface DeployRun {
  id: number;
  title: string;
  branch: string;
  status: string; // queued | in_progress | completed ...
  conclusion: string | null; // success | failure | cancelled ...
  actor: string | null;
  createdAt: string;
  url: string;
}

interface RunsResponse {
  workflow_runs?: Array<{
    id: number;
    display_title: string;
    head_branch: string;
    status: string;
    conclusion: string | null;
    actor?: { login: string } | null;
    created_at: string;
    html_url: string;
  }>;
}

/** 최근 실행 — 읽기 실패는 배포 버튼을 막지 않게 빈 목록으로 돌린다 */
export async function listDeployRuns(cfg: DeployConfig, limit = 8): Promise<DeployRun[]> {
  try {
    const res = await fetch(`${API}/repos/${cfg.repo}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=${limit}`, {
      headers: headers(cfg.token),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as RunsResponse;
    return (data.workflow_runs ?? []).map((r) => ({
      id: r.id,
      title: r.display_title,
      branch: r.head_branch,
      status: r.status,
      conclusion: r.conclusion,
      actor: r.actor?.login ?? null,
      createdAt: r.created_at,
      url: r.html_url,
    }));
  } catch {
    return [];
  }
}
