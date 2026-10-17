// 요청 보낸 곳(IP)의 해시 — 시간당 요청 수 제한용. IP 를 그대로 저장하지 않는다.
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { authSecret } from "./config";

export async function requesterHash(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${ip}|${authSecret() ?? ""}`).digest("hex").slice(0, 32);
}
