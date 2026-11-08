import { describe, expect, it } from "vitest";
import { workerFetch } from "@/lib/worker";

describe("workerFetch", () => {
  it("returns null when the worker isn't running", async () => {
    process.env.DND_WORKER_URL = "http://127.0.0.1:1";
    expect(await workerFetch("/status")).toBeNull();
  });
});
