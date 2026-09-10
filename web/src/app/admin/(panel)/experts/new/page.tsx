import Link from "next/link";
import { getServiceRequest } from "@/lib/queries/requests";
import type { ExpertPartnerPayload } from "@/lib/requests";
import { AdminPageHeader } from "../../../_components/fields";
import { ExpertEditor, type ExpertFormValues } from "../[id]/expert-editor";

const EMPTY: ExpertFormValues = { kind: "trainer", displayName: "", introMd: null, credentialsText: null, credentialsVerifiedAt: null, topics: [], modes: ["video"], priceText: null, heroImageKey: null, userEmail: "", contact: null, status: "draft", sortOrder: 0 };

export default async function AdminExpertNewPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const fromId = Number(from);
  const request = Number.isSafeInteger(fromId) && fromId > 0 ? await getServiceRequest(fromId) : null;
  let initial = EMPTY;
  let email = "";
  if (request && request.kind === "expert_partner") {
    const p = request.payload as ExpertPartnerPayload;
    // 로그인 회원의 요청이면 계정 이메일을 채워 바로 연결한다
    if (request.userId) {
      const { getDb, schema } = await import("@/lib/db");
      const { eq } = await import("drizzle-orm");
      const u = (await getDb().select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, request.userId)).limit(1))[0];
      email = u?.email ?? "";
    }
    initial = { ...EMPTY, kind: p.kind, displayName: p.displayName, introMd: p.intro, credentialsText: p.credentialsText, topics: p.topics, modes: p.modes, priceText: p.priceText, contact: request.contact, userEmail: email };
  }
  return (
    <div>
      <AdminPageHeader title="전문가 등록" description="자격·경력은 확인한 사실만, 확인 기준일과 함께. 공개는 문구를 검토한 뒤 켭니다." />
      {request && initial !== EMPTY && (
        <p className="mt-4 rounded-lg border border-sea/30 bg-sea-soft px-3 py-2 text-sm text-sea">
          요청함 #{request.id} 의 내용으로 채웠습니다. 등록하면 요청이 &quot;처리 중&quot;이 됩니다.{" "}
          <Link href={`/admin/requests#request-${request.id}`} className="underline">
            요청 보기
          </Link>
        </p>
      )}
      <div className="mt-5">
        <ExpertEditor mode="create" expert={initial} slots={[]} fromRequestId={request && initial !== EMPTY ? request.id : undefined} />
      </div>
    </div>
  );
}
