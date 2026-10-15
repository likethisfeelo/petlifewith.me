// 배포 — GitHub Actions deploy 워크플로를 관리자 화면에서 실행하고 최근 기록을 본다.
import Link from "next/link";
import { type DeployRun, deployActionsUrl, deployConfig, listDeployRuns } from "@/lib/deploy";
import { AdminPageHeader } from "../../_components/fields";
import { DeployForm } from "./deploy-form";

export const dynamic = "force-dynamic";

function runLabel(r: DeployRun): { text: string; className: string } {
  if (r.status !== "completed") return { text: r.status === "queued" ? "대기" : "진행 중", className: "bg-honey-soft text-honey" };
  if (r.conclusion === "success") return { text: "성공", className: "bg-sand text-sea" };
  if (r.conclusion === "cancelled") return { text: "취소", className: "bg-sand text-ink-faint" };
  return { text: "실패", className: "bg-accent-soft text-accent-deep" };
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function AdminDeployPage() {
  const cfg = deployConfig();
  const runs = cfg ? await listDeployRuns(cfg) : [];

  return (
    <div>
      <AdminPageHeader
        title="배포"
        description="GitHub Actions 의 deploy 워크플로를 실행합니다. 코드 변경을 사이트에 반영할 때만 씁니다 — 글·이미지 수정은 저장하면 바로 반영되니 배포가 필요 없습니다."
      />

      {!cfg ? (
        <div className="mt-5 rounded-xl border border-dashed border-line p-5 text-sm text-ink-soft">
          <p className="font-medium text-ink">GITHUB_DEPLOY_TOKEN 이 설정되지 않았습니다.</p>
          <p className="mt-2">
            GitHub 에서 이 저장소만, <b>Actions: Read and write</b> 권한의 fine-grained 토큰을 만들어 <code>.env.deploy.&lt;stage&gt;</code>{" "}
            에 <code>GITHUB_DEPLOY_TOKEN=</code> 으로 넣고 한 번 배포하면 이 버튼이 켜집니다. 자세한 절차는 docs/배포.md.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <DeployForm branch={cfg.ref} />
          </div>

          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">최근 배포</h2>
              <Link href={deployActionsUrl(cfg.repo)} target="_blank" rel="noreferrer" className="text-xs font-medium text-sea hover:underline">
                GitHub 에서 보기 →
              </Link>
            </div>
            {runs.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">기록이 없거나 불러오지 못했습니다.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
                {runs.map((r) => {
                  const label = runLabel(r);
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${label.className}`}>{label.text}</span>
                      <a href={r.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-ink hover:underline">
                        {r.title}
                      </a>
                      <span className="text-xs text-ink-faint">
                        {r.branch} · {r.actor ?? "-"} · {when(r.createdAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
