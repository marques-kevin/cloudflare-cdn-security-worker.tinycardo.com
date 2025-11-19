// /**
//  * Cloudflare Worker for serving text-to-speech WAV files with signature verification
//  */

// interface Env {
//   TTS_BUCKET: R2Bucket;
//   SIGNATURE_SECRET: string;
// }

// interface VerifySignatureParams {
//   url: string;
//   signature: string;
//   secret: string;
//   expiration: number;
// }

// /**
//  * Verifies the HMAC signature of a request
//  */
// export async function verify_signature(
//   params: VerifySignatureParams
// ): Promise<boolean> {
//   try {
//     // Check expiration
//     const now = Math.floor(Date.now() / 1000);
//     if (now > params.expiration) {
//       return false;
//     }

//     // Create HMAC signature from the URL (including exp)
//     const encoder = new TextEncoder();
//     const key_data = encoder.encode(params.secret);
//     const message_data = encoder.encode(params.url);

//     const key = await crypto.subtle.importKey(
//       "raw",
//       key_data,
//       { name: "HMAC", hash: "SHA-256" },
//       false,
//       ["sign"]
//     );

//     const signature_buffer = await crypto.subtle.sign(
//       "HMAC",
//       key,
//       message_data
//     );
//     const signature_array = Array.from(new Uint8Array(signature_buffer));
//     const expected_signature = signature_array
//       .map((b) => b.toString(16).padStart(2, "0"))
//       .join("");

//     // Use constant-time comparison to prevent timing attacks
//     if (params.signature.length !== expected_signature.length) {
//       return false;
//     }

//     let result = 0;
//     for (let i = 0; i < params.signature.length; i++) {
//       result |=
//         params.signature.charCodeAt(i) ^ expected_signature.charCodeAt(i);
//     }

//     return result === 0;
//   } catch (error) {
//     console.error("Signature verification error:", error);
//     return false;
//   }
// }

// /**
//  * Handles the request and serves WAV files if signature is valid
//  */
// export default {
//   async fetch(request: Request, env: Env): Promise<Response> {
//     const url = new URL(request.url);

//     // Only allow GET requests
//     if (request.method !== "GET") {
//       return new Response("Method not allowed", { status: 405 });
//     }

//     // Extract signature from query parameter or header
//     const signature =
//       url.searchParams.get("sig") || request.headers.get("X-Signature") || "";

//     if (!signature) {
//       return new Response("Missing signature", { status: 401 });
//     }

//     // Extract expiration from query parameter (mandatory)
//     const exp_param = url.searchParams.get("exp");

//     if (!exp_param) {
//       return new Response("Missing expiration parameter", { status: 400 });
//     }

//     const expiration = parseInt(exp_param, 10);

//     if (isNaN(expiration) || expiration <= 0) {
//       return new Response("Invalid expiration parameter", { status: 400 });
//     }

//     // Get the file path from the URL
//     // Include exp in the signature
//     const file_path = url.pathname;
//     const base_url = url.origin + file_path;
//     const url_for_signature = `${base_url}?exp=${expiration}`;

//     // Verify signature
//     const is_valid = await verify_signature({
//       url: url_for_signature,
//       signature,
//       secret: env.SIGNATURE_SECRET,
//       expiration,
//     });

//     if (!is_valid) {
//       return new Response("Invalid signature", { status: 403 });
//     }

//     // Get the object from R2 bucket
//     const object_key = file_path.startsWith("/")
//       ? file_path.slice(1)
//       : file_path;

//     // Only allow .wav files
//     if (!object_key.endsWith(".mp3")) {
//       return new Response("Only MP3 files are allowed", { status: 400 });
//     }

//     try {
//       const object = await env.TTS_BUCKET.get(object_key);

//       if (object === null) {
//         return new Response("File not found", { status: 404 });
//       }

//       // Return the WAV file with appropriate headers
//       const headers = new Headers();
//       object.writeHttpMetadata(headers);
//       headers.set("etag", object.httpEtag);
//       headers.set("Content-Type", "audio/mp3");
//       headers.set("Cache-Control", "public, max-age=31536000, immutable");

//       return new Response(object.body, {
//         headers,
//         status: 200,
//       });
//     } catch (error) {
//       console.error("Error fetching object from R2:", error);
//       return new Response("Internal server error", { status: 500 });
//     }
//   },
// };

export default {
  async fetch(): Promise<Response> {
    return new Response("Hello, world from Cloudflare Worker!", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  },
};
