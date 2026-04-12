/**
 * No server session; client clears localStorage only.
 */

export async function handler() {
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true }),
  };
}
