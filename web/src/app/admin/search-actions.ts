"use server";

// 관리자 "지금 가져오기" — 검색 유입 보관 함수(SST CronV2 "GscSync")를 비동기로 호출한다.
// 서비스 계정 키는 그 함수에만 있다 (sst.config.ts). 받는 데 몇 분 걸릴 수 있어 기다리지 않는다.
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getOptionalEnv } from "@/lib/config";

export interface SearchSyncState {
  error?: string;
  started?: boolean;
}

export async function startSearchSyncAction(): Promise<SearchSyncState> {
  if (!(await getSession())) redirect("/admin/login");
  const fn = getOptionalEnv("GSC_SYNC_FUNCTION");
  if (!fn) return { error: "아직 연결되지 않았습니다. 배포 환경에 GSC_CLIENT_EMAIL·GSC_PRIVATE_KEY 를 넣고 다시 배포하세요 (docs/운영.md 4-5)." };
  try {
    await new LambdaClient({ region: getOptionalEnv("STORAGE_REGION") ?? "ap-northeast-2" }).send(
      new InvokeCommand({ FunctionName: fn, InvocationType: "Event" }),
    );
    return { started: true };
  } catch (e) {
    return { error: `가져오기를 시작하지 못했습니다: ${e instanceof Error ? e.message : String(e)}` };
  }
}
