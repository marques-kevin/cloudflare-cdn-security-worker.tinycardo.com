import worker, { verify_signature } from "./old";

describe("verify_signature", () => {
  const secret = "test-secret-key";
  const url = "https://example.com/audio/test.mp3";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should verify a valid signature", async () => {
    // Create a real signature for testing with expiration
    const expiration = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const url_with_exp = `${url}?exp=${expiration}`;
    const encoder = new TextEncoder();
    const key_data = encoder.encode(secret);
    const message_data = encoder.encode(url_with_exp);

    const real_key = await crypto.subtle.importKey(
      "raw",
      key_data,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature_buffer = await crypto.subtle.sign(
      "HMAC",
      real_key,
      message_data
    );
    const signature_array = Array.from(new Uint8Array(signature_buffer));
    const valid_signature = signature_array
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const result = await verify_signature({
      url: url_with_exp,
      signature: valid_signature,
      secret,
      expiration,
    });
    expect(result).toBe(true);
  });

  it("should reject an invalid signature", async () => {
    const expiration = Math.floor(Date.now() / 1000) + 3600;
    const url_with_exp = `${url}?exp=${expiration}`;
    const invalid_signature = "invalid-signature";
    const result = await verify_signature({
      url: url_with_exp,
      signature: invalid_signature,
      secret,
      expiration,
    });
    expect(result).toBe(false);
  });

  it("should reject a signature with wrong length", async () => {
    const expiration = Math.floor(Date.now() / 1000) + 3600;
    const url_with_exp = `${url}?exp=${expiration}`;
    const short_signature = "abc";
    const result = await verify_signature({
      url: url_with_exp,
      signature: short_signature,
      secret,
      expiration,
    });
    expect(result).toBe(false);
  });

  it("should handle errors gracefully", async () => {
    // Test with invalid secret that might cause errors
    const expiration = Math.floor(Date.now() / 1000) + 3600;
    const url_with_exp = `${url}?exp=${expiration}`;
    const result = await verify_signature({
      url: url_with_exp,
      signature: "any-signature",
      secret: "",
      expiration,
    });
    expect(result).toBe(false);
  });

  it("should reject expired signatures", async () => {
    const expiration = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const url_with_exp = `${url}?exp=${expiration}`;
    const any_signature = "any-signature";

    const result = await verify_signature({
      url: url_with_exp,
      signature: any_signature,
      secret,
      expiration,
    });
    expect(result).toBe(false);
  });
});

describe("worker.fetch", () => {
  const mock_env: {
    TTS_BUCKET: R2Bucket;
    SIGNATURE_SECRET: string;
  } = {
    TTS_BUCKET: {} as R2Bucket,
    SIGNATURE_SECRET: "test-secret",
  };

  let mock_r2_object: {
    body: ReadableStream;
    httpEtag: string;
    writeHttpMetadata: (headers: Headers) => void;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mock_r2_object = {
      body: new ReadableStream(),
      httpEtag: "etag-123",
      writeHttpMetadata: jest.fn((headers: Headers) => {
        headers.set("Content-Length", "1000");
      }),
    };

    // Mock R2Bucket.get
    (mock_env.TTS_BUCKET.get as jest.Mock) = jest.fn();
  });

  async function create_signed_url(
    path: string,
    secret: string,
    expiration?: number
  ): Promise<string> {
    const encoder = new TextEncoder();
    const key_data = encoder.encode(secret);
    // Ensure path starts with / for proper URL construction
    const normalized_path = path.startsWith("/") ? path : `/${path}`;
    const base_url = `https://example.com${normalized_path}`;
    const exp = expiration ?? Math.floor(Date.now() / 1000) + 3600; // Default 1 hour
    const url_with_exp = `${base_url}?exp=${exp}`;
    const message_data = encoder.encode(url_with_exp);

    const key = await crypto.subtle.importKey(
      "raw",
      key_data,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature_buffer = await crypto.subtle.sign(
      "HMAC",
      key,
      message_data
    );
    const signature_array = Array.from(new Uint8Array(signature_buffer));
    const signature = signature_array
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return `${url_with_exp}&sig=${signature}`;
  }

  it("should reject non-GET requests", async () => {
    const request = new Request("https://example.com/audio/test.mp3", {
      method: "POST",
    });

    const response = await worker.fetch(request, mock_env);
    expect(response.status).toBe(405);
    expect(await response.text()).toBe("Method not allowed");
  });

  it("should reject requests without signature", async () => {
    const request = new Request(
      "https://example.com/audio/test.wav?exp=1234567890"
    );

    const response = await worker.fetch(request, mock_env);
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Missing signature");
  });

  it("should reject requests without expiration", async () => {
    const request = new Request(
      "https://example.com/audio/test.mp3?sig=some-signature"
    );

    const response = await worker.fetch(request, mock_env);
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Missing expiration parameter");
  });

  it("should reject requests with invalid signature", async () => {
    const expiration = Math.floor(Date.now() / 1000) + 3600;
    const request = new Request(
      `https://example.com/audio/test.mp3?exp=${expiration}&sig=invalid-signature`
    );

    const response = await worker.fetch(request, mock_env);
    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Invalid signature");
  });

  it("should accept signature from X-Signature header", async () => {
    const path = "/audio/test.mp3";
    const signed_url = await create_signed_url(path, mock_env.SIGNATURE_SECRET);
    const url = new URL(signed_url);
    const signature = url.searchParams.get("sig") || "";
    const expiration = url.searchParams.get("exp") || "";

    const request = new Request(
      `https://example.com${path}?exp=${expiration}`,
      {
        headers: {
          "X-Signature": signature,
        },
      }
    );

    (mock_env.TTS_BUCKET.get as jest.Mock).mockResolvedValue(mock_r2_object);

    const response = await worker.fetch(request, mock_env);
    expect(response.status).toBe(200);
  });

  it("should reject non-MP3 files", async () => {
    const path = "/audio/test.wav";
    const signed_url = await create_signed_url(path, mock_env.SIGNATURE_SECRET);

    const request = new Request(signed_url);

    const response = await worker.fetch(request, mock_env);
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Only MP3 files are allowed");
  });

  it("should return 404 for non-existent files", async () => {
    const path = "/audio/nonexistent.mp3";
    const signed_url = await create_signed_url(path, mock_env.SIGNATURE_SECRET);

    const request = new Request(signed_url);

    (mock_env.TTS_BUCKET.get as jest.Mock).mockResolvedValue(null);

    const response = await worker.fetch(request, mock_env);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("File not found");
  });

  it("should serve MP3 file with valid signature", async () => {
    const path = "/audio/test.mp3";
    const signed_url = await create_signed_url(path, mock_env.SIGNATURE_SECRET);

    const request = new Request(signed_url);

    (mock_env.TTS_BUCKET.get as jest.Mock).mockResolvedValue(mock_r2_object);

    const response = await worker.fetch(request, mock_env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mp3");
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable"
    );
    expect(response.headers.get("etag")).toBe("etag-123");
    expect(mock_r2_object.writeHttpMetadata).toHaveBeenCalled();
  });

  it("should handle R2 bucket errors", async () => {
    const path = "/audio/test.mp3";
    const signed_url = await create_signed_url(path, mock_env.SIGNATURE_SECRET);

    const request = new Request(signed_url);

    (mock_env.TTS_BUCKET.get as jest.Mock).mockRejectedValue(
      new Error("R2 error")
    );

    const response = await worker.fetch(request, mock_env);
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal server error");
  });

  it("should handle file path with leading slash", async () => {
    const path = "/audio/test.mp3";
    const signed_url = await create_signed_url(path, mock_env.SIGNATURE_SECRET);

    const request = new Request(signed_url);

    (mock_env.TTS_BUCKET.get as jest.Mock).mockResolvedValue(mock_r2_object);

    const response = await worker.fetch(request, mock_env);

    expect(response.status).toBe(200);
    expect(mock_env.TTS_BUCKET.get).toHaveBeenCalledWith("audio/test.mp3");
  });

  it("should handle file path without leading slash", async () => {
    // Test with a path that results in pathname without leading slash
    // This tests the edge case where pathname might be just the filename
    const path = "/test.mp3";
    const signed_url = await create_signed_url(path, mock_env.SIGNATURE_SECRET);

    const request = new Request(signed_url);

    (mock_env.TTS_BUCKET.get as jest.Mock).mockResolvedValue(mock_r2_object);

    const response = await worker.fetch(request, mock_env);

    expect(response.status).toBe(200);
    expect(mock_env.TTS_BUCKET.get).toHaveBeenCalledWith("test.mp3");
  });
});
