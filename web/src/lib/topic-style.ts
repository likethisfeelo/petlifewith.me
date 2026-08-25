// 토픽(클러스터)별 컬러 코딩 — 노견은 차분한 세이지, 놀이는 따뜻한 액센트.
// 두 클러스터를 함께 미는 이유(감정 톤 균형)를 시각 언어로도 반영한다.

export interface TopicStyle {
  chip: string; // 작은 라벨
  card: string; // 카드 배경 강조
  heading: string;
}

const STYLES: Record<string, TopicStyle> = {
  "senior-life": {
    chip: "bg-sage-soft text-sage-deep",
    card: "bg-sage-soft/60 border-sage/20",
    heading: "text-sage-deep",
  },
  play: {
    chip: "bg-accent-soft text-accent-deep",
    card: "bg-accent-soft/60 border-accent/20",
    heading: "text-accent-deep",
  },
  care: {
    chip: "bg-plum-soft text-plum",
    card: "bg-plum-soft/60 border-plum/20",
    heading: "text-plum",
  },
  treats: {
    chip: "bg-honey-soft text-honey",
    card: "bg-honey-soft/60 border-honey/20",
    heading: "text-honey",
  },
  spot: {
    chip: "bg-sea-soft text-sea",
    card: "bg-sea-soft/60 border-sea/20",
    heading: "text-sea",
  },
};

const FALLBACK: TopicStyle = {
  chip: "bg-sand text-ink-soft",
  card: "bg-sand/60 border-line",
  heading: "text-ink",
};

export function topicStyle(slug: string): TopicStyle {
  return STYLES[slug] ?? FALLBACK;
}
