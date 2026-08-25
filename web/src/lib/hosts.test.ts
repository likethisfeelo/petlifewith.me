import { describe, expect, it } from "vitest";
import { rewritePathForHost, subdomainOf } from "./hosts";

describe("subdomainOf", () => {
  it("apex 자신·www 는 null", () => {
    expect(subdomainOf("petlifewith.me", "petlifewith.me")).toBeNull();
    expect(subdomainOf("www.petlifewith.me", "petlifewith.me")).toBeNull();
  });
  it("서브도메인과 포트를 처리한다", () => {
    expect(subdomainOf("admin.petlifewith.me", "petlifewith.me")).toBe("admin");
    expect(subdomainOf("service.localhost:3000", "localhost")).toBe("service");
    expect(subdomainOf("ADMIN.PetLifeWith.Me", "petlifewith.me")).toBe("admin");
  });
  it("무관한 호스트·다단계 서브도메인은 null", () => {
    expect(subdomainOf("evil.example.com", "petlifewith.me")).toBeNull();
    expect(subdomainOf("a.b.petlifewith.me", "petlifewith.me")).toBeNull();
    expect(subdomainOf("fakepetlifewith.me", "petlifewith.me")).toBeNull();
  });
});

describe("rewritePathForHost", () => {
  it("admin. → /admin (루트 포함)", () => {
    expect(rewritePathForHost("admin", "/")).toBe("/admin");
    expect(rewritePathForHost("admin", "/guides")).toBe("/admin/guides");
    expect(rewritePathForHost("admin", "/login")).toBe("/admin/login");
  });
  it("이미 접두사가 붙은 경로는 이중 재작성하지 않는다 (redirect 호환)", () => {
    expect(rewritePathForHost("admin", "/admin/login")).toBeNull();
    expect(rewritePathForHost("admin", "/admin")).toBeNull();
    expect(rewritePathForHost("service", "/portal/spot")).toBeNull();
  });
  it("service./product. → 사장님 포털", () => {
    expect(rewritePathForHost("service", "/")).toBe("/portal/spot");
    expect(rewritePathForHost("product", "/")).toBe("/portal/product");
  });
  it("dev.·알 수 없는 서브도메인·메인 호스트는 손대지 않는다", () => {
    expect(rewritePathForHost("dev", "/guide/x")).toBeNull();
    expect(rewritePathForHost("blog", "/")).toBeNull();
    expect(rewritePathForHost(null, "/admin")).toBeNull();
  });
});
