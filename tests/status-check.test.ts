import { describe, expect, it } from "vitest";
import {
  classifyHttpResponse,
  formatDeadSubdomainIssueBody,
} from "../scripts/lib/status-check.js";

describe("classifyHttpResponse", () => {
  it("marks 2xx and 3xx responses as live", () => {
    expect(classifyHttpResponse(200, {}, "<html>ok</html>").status).toBe("live");
    expect(classifyHttpResponse(308, {}, "").status).toBe("live");
  });

  it("detects Vercel, GitHub Pages, and Netlify dead subdomain signatures", () => {
    expect(
      classifyHttpResponse(
        404,
        { "x-vercel-error": "DEPLOYMENT_NOT_FOUND" },
        "Not found",
      ).status,
    ).toBe("dead");

    expect(
      classifyHttpResponse(404, {}, "404: DEPLOYMENT_NOT_FOUND").status,
    ).toBe("dead");

    expect(
      classifyHttpResponse(
        404,
        {},
        "<h1>404</h1><p>There isn't a GitHub Pages site here.</p>",
      ).status,
    ).toBe("dead");

    expect(
      classifyHttpResponse(404, {}, "Not Found - Request ID: 01ABC").status,
    ).toBe("dead");
  });

  it("classifies ordinary 4xx and 5xx as warn", () => {
    expect(classifyHttpResponse(404, {}, "Custom app 404 page").status).toBe("warn");
    expect(classifyHttpResponse(503, {}, "Service unavailable").status).toBe("warn");
    expect(classifyHttpResponse(401, {}, "Unauthorized").status).toBe("warn");
  });
});

describe("formatDeadSubdomainIssueBody", () => {
  it("mentions owners and lists offending files", () => {
    const body = formatDeadSubdomainIssueBody(
      [
        {
          label: "old",
          fqdn: "old.harrylee.dev",
          owner: "alice-gh",
          status: "dead",
          httpStatus: 404,
          reason: "Vercel DEPLOYMENT_NOT_FOUND (potential takeover)",
          checkedAt: "2026-11-20T05:30:00.000Z",
        },
      ],
      "2026-11-20T05:30:00.000Z",
    );

    expect(body).toContain("`old.harrylee.dev`");
    expect(body).toContain("@alice-gh");
    expect(body).toContain("`domains/old.json`");
  });
});
