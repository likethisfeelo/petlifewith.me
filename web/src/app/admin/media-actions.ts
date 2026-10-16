"use server";

// 미디어 라이브러리 관리자 액션 — 삭제·목록. 업로드(presign·등록)는 관리자·회원 공용 app/upload-actions.ts.
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "@/lib/cdn";
import { redirect } from "next/navigation";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { deleteObject } from "@/lib/storage";

const { mediaAssets, users } = schema;

async function requireDb() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!isDbConfigured()) throw new Error("DATABASE_URL 미설정");
  return getDb();
}

/** 자산 삭제 — DB 행과 S3 오브젝트를 함께 지운다. 본문에서 쓰던 키는 깨진다. */
export async function deleteMediaAction(formData: FormData): Promise<void> {
  const db = await requireDb();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id)) return;

  const row = (await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1))[0];
  if (!row) return;

  await deleteObject(row.objectKey);
  await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  revalidatePath("/admin/media");
}

export async function listMediaAssets(limit = 100) {
  const db = await requireDb();
  const rows = await db
    .select({ asset: mediaAssets, uploaderName: users.displayName })
    .from(mediaAssets)
    .leftJoin(users, eq(mediaAssets.uploaderUserId, users.id))
    .orderBy(desc(mediaAssets.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.asset, uploaderName: r.asset.uploaderUserId ? r.uploaderName : null }));
}
