"use server";

// 배포 실행 — /admin/deploy. GitHub Actions deploy 워크플로를 부르는 것은 lib/deploy.ts.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DEPLOY_STAGES, type DeployStage, deployConfig, dispatchDeploy } from "@/lib/deploy";

export interface DeployActionState {
  error?: string;
  started?: DeployStage;
}

export async function startDeployAction(_prev: DeployActionState, formData: FormData): Promise<DeployActionState> {
  if (!(await getSession())) redirect("/admin/login");
  const stage = String(formData.get("stage") ?? "") as DeployStage;
  if (!DEPLOY_STAGES.includes(stage)) return { error: "배포 스테이지는 dev / prod 중 하나입니다." };
  // 운영은 실수로 누르지 않게 확인 문구를 직접 입력해야 한다
  if (stage === "prod" && String(formData.get("confirm") ?? "").trim() !== "prod") {
    return { error: "운영 배포는 확인 칸에 prod 를 입력해야 합니다." };
  }
  const cfg = deployConfig();
  if (!cfg) return { error: "GITHUB_DEPLOY_TOKEN 이 설정되지 않았습니다 (docs/배포.md)." };
  const error = await dispatchDeploy(cfg, stage);
  if (error) return { error };
  revalidatePath("/admin/deploy");
  return { started: stage };
}
