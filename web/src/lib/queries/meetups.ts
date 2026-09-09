// 펫모임 조회 — meetups / meetup_members / meetup_posts / user_regions.
// 공개 집계(비회원)는 열림·숨김 아님 모임만 센다. 목록·상세는 회원 화면에서만 부른다.
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import type { RegionOption } from "./requests";

const { meetups, meetupMembers, meetupPosts, userRegions, regions, users } = schema;

export interface RegionMeetupCounts {
  meetups: number;
  participants: number;
}

const visible = () => and(eq(meetups.status, "open"), isNull(meetups.hiddenAt));

/** 지역별 열린 모임 수·참여 인원(중복 없는 회원 수) — 지도 배지와 비회원 안내 */
export async function listMeetupCountsByRegion(): Promise<Record<number, RegionMeetupCounts>> {
  if (!isDbConfigured()) return {};
  const db = getDb();
  const [counts, people] = await Promise.all([
    db.select({ regionId: meetups.regionId, n: sql<number>`count(*)`.mapWith(Number) }).from(meetups).where(visible()).groupBy(meetups.regionId),
    db
      .select({ regionId: meetups.regionId, n: sql<number>`count(distinct ${meetupMembers.userId})`.mapWith(Number) })
      .from(meetupMembers)
      .innerJoin(meetups, eq(meetupMembers.meetupId, meetups.id))
      .where(visible())
      .groupBy(meetups.regionId),
  ]);
  const out: Record<number, RegionMeetupCounts> = {};
  for (const c of counts) out[c.regionId] = { meetups: c.n, participants: 0 };
  for (const p of people) out[p.regionId] = { meetups: out[p.regionId]?.meetups ?? 0, participants: p.n };
  return out;
}

export async function countOpenMeetups(): Promise<number> {
  if (!isDbConfigured()) return 0;
  const row = (await getDb().select({ n: sql<number>`count(*)`.mapWith(Number) }).from(meetups).where(visible()))[0];
  return row?.n ?? 0;
}

export interface MeetupSummary {
  id: number;
  slug: string;
  title: string;
  regionId: number;
  regionLabel: string;
  hostUserId: string | null;
  hostName: string | null;
  memberCount: number;
  capacity: number | null;
  meetingAt: Date | null;
  placeText: string | null;
  status: "open" | "closed";
  hiddenAt: Date | null;
  createdAt: Date;
}

// 바깥 테이블 컬럼은 글자 그대로 — drizzle 이 조인 없는 select 에서는 컬럼을 테이블 한정 없이 렌더한다
const memberCountSql = sql<number>`(select count(*) from ${meetupMembers} mm where mm.meetup_id = meetups.id)`.mapWith(Number);

function summarySelect() {
  return {
    id: meetups.id,
    slug: meetups.slug,
    title: meetups.title,
    regionId: meetups.regionId,
    regionLabel: sql<string>`${regions.sidoName} || ' ' || ${regions.sigunguName}`,
    hostUserId: meetups.hostUserId,
    hostName: users.displayName,
    memberCount: memberCountSql,
    capacity: meetups.capacity,
    meetingAt: meetups.meetingAt,
    placeText: meetups.placeText,
    status: meetups.status,
    hiddenAt: meetups.hiddenAt,
    createdAt: meetups.createdAt,
  };
}

function summaryQuery() {
  return getDb().select(summarySelect()).from(meetups).innerJoin(regions, eq(meetups.regionId, regions.id)).leftJoin(users, eq(meetups.hostUserId, users.id));
}

/** 한 지역의 모임 — 회원 화면. 열린 것 먼저, 최신순 */
export async function listMeetupsInRegion(regionId: number): Promise<MeetupSummary[]> {
  if (!isDbConfigured()) return [];
  return summaryQuery()
    .where(and(eq(meetups.regionId, regionId), isNull(meetups.hiddenAt)))
    .orderBy(meetups.status, desc(meetups.createdAt))
    .limit(100);
}

/** 회원의 내 지역 모임 + 참여 중인 모임 */
export async function listMeetupsForUser(userId: string): Promise<{ regionIds: number[]; inMyRegions: MeetupSummary[]; joined: MeetupSummary[] }> {
  if (!isDbConfigured()) return { regionIds: [], inMyRegions: [], joined: [] };
  const db = getDb();
  const mine = await db.select({ regionId: userRegions.regionId }).from(userRegions).where(eq(userRegions.userId, userId)).orderBy(userRegions.sortOrder);
  const regionIds = mine.map((r) => r.regionId);
  const [inMyRegions, joined] = await Promise.all([
    regionIds.length === 0
      ? Promise.resolve([] as MeetupSummary[])
      : summaryQuery()
          .where(and(inArray(meetups.regionId, regionIds), isNull(meetups.hiddenAt), eq(meetups.status, "open")))
          .orderBy(desc(meetups.createdAt))
          .limit(100),
    db
      .select(summarySelect())
      .from(meetupMembers)
      .innerJoin(meetups, eq(meetupMembers.meetupId, meetups.id))
      .innerJoin(regions, eq(meetups.regionId, regions.id))
      .leftJoin(users, eq(meetups.hostUserId, users.id))
      .where(and(eq(meetupMembers.userId, userId), isNull(meetups.hiddenAt)))
      .orderBy(desc(meetupMembers.joinedAt))
      .limit(100),
  ]);
  return { regionIds, inMyRegions, joined };
}

export interface MeetupDetail extends MeetupSummary {
  descriptionMd: string | null;
  sidoSlug: string;
  sigunguSlug: string;
  updatedAt: Date;
}

export async function getMeetupBySlug(slug: string): Promise<MeetupDetail | null> {
  if (!isDbConfigured()) return null;
  const row = (
    await getDb()
      .select({ ...summarySelect(), descriptionMd: meetups.descriptionMd, sidoSlug: regions.sidoSlug, sigunguSlug: regions.sigunguSlug, updatedAt: meetups.updatedAt })
      .from(meetups)
      .innerJoin(regions, eq(meetups.regionId, regions.id))
      .leftJoin(users, eq(meetups.hostUserId, users.id))
      .where(eq(meetups.slug, slug))
      .limit(1)
  )[0];
  return row ?? null;
}

export async function getMeetupById(id: number): Promise<MeetupDetail | null> {
  if (!isDbConfigured()) return null;
  const row = (
    await getDb()
      .select({ ...summarySelect(), descriptionMd: meetups.descriptionMd, sidoSlug: regions.sidoSlug, sigunguSlug: regions.sigunguSlug, updatedAt: meetups.updatedAt })
      .from(meetups)
      .innerJoin(regions, eq(meetups.regionId, regions.id))
      .leftJoin(users, eq(meetups.hostUserId, users.id))
      .where(eq(meetups.id, id))
      .limit(1)
  )[0];
  return row ?? null;
}

export async function isMeetupMember(meetupId: number, userId: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const row = (await getDb().select({ id: meetupMembers.id }).from(meetupMembers).where(and(eq(meetupMembers.meetupId, meetupId), eq(meetupMembers.userId, userId))).limit(1))[0];
  return Boolean(row);
}

export interface MeetupMemberRow {
  userId: string;
  name: string;
  joinedAt: Date;
}

export async function listMeetupMembers(meetupId: number): Promise<MeetupMemberRow[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({ userId: meetupMembers.userId, name: users.displayName, joinedAt: meetupMembers.joinedAt })
    .from(meetupMembers)
    .innerJoin(users, eq(meetupMembers.userId, users.id))
    .where(eq(meetupMembers.meetupId, meetupId))
    .orderBy(meetupMembers.joinedAt);
  return rows.map((r) => ({ userId: r.userId, name: r.name ?? "회원", joinedAt: r.joinedAt }));
}

export interface MeetupPostRow {
  id: number;
  userId: string;
  authorName: string;
  body: string;
  hiddenAt: Date | null;
  createdAt: Date;
}

/** 모임 게시판 — 참여 회원 화면(숨김 제외) 또는 관리자(숨김 포함). 최신순 */
export async function listMeetupPosts(meetupId: number, opts?: { includeHidden?: boolean }): Promise<MeetupPostRow[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({ id: meetupPosts.id, userId: meetupPosts.userId, authorName: users.displayName, body: meetupPosts.body, hiddenAt: meetupPosts.hiddenAt, createdAt: meetupPosts.createdAt })
    .from(meetupPosts)
    .innerJoin(users, eq(meetupPosts.userId, users.id))
    .where(opts?.includeHidden ? eq(meetupPosts.meetupId, meetupId) : and(eq(meetupPosts.meetupId, meetupId), isNull(meetupPosts.hiddenAt)))
    .orderBy(desc(meetupPosts.createdAt))
    .limit(200);
  return rows.map((r) => ({ ...r, authorName: r.authorName ?? "회원" }));
}

/** 회원의 내 지역 (정렬 순서대로, 최대 3곳) */
export async function getUserRegions(userId: string): Promise<RegionOption[]> {
  if (!isDbConfigured()) return [];
  return getDb()
    .select({ id: regions.id, sidoName: regions.sidoName, sidoSlug: regions.sidoSlug, sigunguName: regions.sigunguName })
    .from(userRegions)
    .innerJoin(regions, eq(userRegions.regionId, regions.id))
    .where(eq(userRegions.userId, userId))
    .orderBy(userRegions.sortOrder);
}

/** 관리자 — 숨김 포함 전체, 게시글 수 포함 */
export interface MeetupAdminRow extends MeetupSummary {
  postCount: number;
}

export async function listMeetupsAdmin(): Promise<MeetupAdminRow[]> {
  if (!isDbConfigured()) return [];
  return getDb()
    .select({ ...summarySelect(), postCount: sql<number>`(select count(*) from ${meetupPosts} mp where mp.meetup_id = meetups.id)`.mapWith(Number) })
    .from(meetups)
    .innerJoin(regions, eq(meetups.regionId, regions.id))
    .leftJoin(users, eq(meetups.hostUserId, users.id))
    .orderBy(desc(meetups.createdAt))
    .limit(300);
}
