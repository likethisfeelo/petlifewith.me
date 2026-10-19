import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/config";

// link.<apex>/ 자체는 보여 줄 것이 없다 — 지역별 스팟으로
export default function LinkHome() {
  redirect(`${siteUrl()}/spot`);
}
