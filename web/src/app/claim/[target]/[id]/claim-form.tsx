"use client";

// 정보 관리 요청 — 요청함(spot_claim / maker_claim). 확인 뒤 운영자가 편집기에서 반영한다.
import Link from "next/link";
import { RequestForm } from "@/components/requests/request-form";

export function ClaimForm({ targetType, targetId, backPath }: { targetType: "spot" | "maker"; targetId: number; backPath: string }) {
  return (
    <RequestForm
      kind={targetType === "spot" ? "spot_claim" : "maker_claim"}
      hidden={{ targetId }}
      submitLabel="무료로 요청하기"
      requesterLabel="성함 (담당자명)"
      doneBody={
        <>
          <p>남겨주신 연락처로 확인 후 반영해 드립니다. 기본 등록과 정보 관리는 무료입니다.</p>
          <p className="mt-2">
            <Link href={backPath} className="font-medium underline">
              페이지로 돌아가기
            </Link>
          </p>
        </>
      }
      messagePlaceholder="수정할 정보(운영시간·요금·예약 링크 등)나 요청 사항을 적어주세요."
    >
      {() => null}
    </RequestForm>
  );
}
