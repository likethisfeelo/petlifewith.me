import path from "node:path";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// 모노레포 — 환경변수는 루트 .env.local 단일 소스.
// Next 는 앱 디렉토리의 env 파일만 자동 로드하므로 여기서 직접 로드한다.
// 배포(Lambda)에서는 실제 환경변수/Secrets Manager 가 공급되고 이 로드는 no-op 이다.
loadEnv({ path: path.resolve(__dirname, "../.env.local") });
loadEnv({ path: path.resolve(__dirname, "../.env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@app/data"],
  // @app/data 는 ESM 스타일(.js 확장자)로 임포트한다 — 웹팩이 .ts 원본을 찾도록 매핑
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".js", ".ts"],
      ".jsx": [".jsx", ".tsx"],
    };
    return config;
  },
  // 이미지 최적화는 업로드 시점 사전 생성으로 간다 (claude.md 10-7).
  // Lambda 런타임 변환에 의존하지 않도록 기본 최적화를 끈다.
  images: {
    unoptimized: true,
  },
  // Vercel 전용 기능·Edge 전용 API 를 쓰지 않는다 (claude.md 10-6).
};

export default nextConfig;
