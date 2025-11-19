async function generate_signature(
  url: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key_data = encoder.encode(secret);
  const message_data = encoder.encode(url);

  const key = await crypto.subtle.importKey(
    "raw",
    key_data,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature_buffer = await crypto.subtle.sign("HMAC", key, message_data);
  const signature_array = Array.from(new Uint8Array(signature_buffer));
  return signature_array.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error(
      "Usage: ts-node scripts/generate-signed-url.ts <file_path> [expiration_seconds] [origin]"
    );
    console.error(
      "Example: ts-node scripts/generate-signed-url.ts /audio/test.mp3 3600 https://cdn.tinycardo.com"
    );
    process.exit(1);
  }

  const file_path = args[0];
  const expiration_seconds = args[1] ? parseInt(args[1], 10) : 3600; // Default 1 hour
  const origin = args[2] || "https://cdn.tinycardo.com";

  // Get secret from environment variable
  const secret = process.env.SIGNATURE_SECRET;
  if (!secret) {
    console.error("Error: SIGNATURE_SECRET environment variable is not set");
    console.error("Set it with: export SIGNATURE_SECRET='your-secret-key'");
    process.exit(1);
  }

  // Calculate expiration timestamp
  const expiration = Math.floor(Date.now() / 1000) + expiration_seconds;

  // Build the URL for signature (must match the format in index.ts)
  const base_url = origin + file_path;
  const url_for_signature = `${base_url}?exp=${expiration}`;

  // Generate signature
  const signature = await generate_signature(url_for_signature, secret);

  // Output just the query string
  console.log(`?sig=${signature}&exp=${expiration}`);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
