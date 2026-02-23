import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../retry.js";

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 429, message: "rate limited" })
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 10 });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 500, message: "server error" })
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 10 });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 400", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue({ status: 400, message: "bad request" });

    await expect(
      withRetry(fn, { baseDelayMs: 1, maxDelayMs: 10 }),
    ).rejects.toEqual({ status: 400, message: "bad request" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 404", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue({ status: 404, message: "not found" });

    await expect(
      withRetry(fn, { baseDelayMs: 1, maxDelayMs: 10 }),
    ).rejects.toEqual({ status: 404, message: "not found" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after maxRetries exceeded", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue({ status: 429, message: "rate limited" });

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 }),
    ).rejects.toEqual({ status: 429, message: "rate limited" });
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("respects Retry-After header", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({
        status: 429,
        message: "rate limited",
        headers: { "retry-after": "0.01" },
      })
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 30000 });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-Error thrown values without status", async () => {
    const fn = vi.fn().mockRejectedValue("string error");

    await expect(
      withRetry(fn, { baseDelayMs: 1, maxDelayMs: 10 }),
    ).rejects.toBe("string error");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
