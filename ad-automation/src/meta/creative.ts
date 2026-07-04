import type { MetaClient } from "./client.js";

/**
 * Uploads an image to the ad account and returns its `hash`,
 * which is referenced later in the ad creative.
 */
export async function uploadImage(
  client: MetaClient,
  adAccountId: string,
  imagePath: string,
): Promise<string> {
  const res = await client.uploadFile(
    `act_${adAccountId}/adimages`,
    imagePath,
    {},
    "uploadImage",
  );

  if (res.dryRun) return "dry-run-image-hash";

  // Response shape: { images: { "<filename>": { hash, url, ... } } }
  const images = res.images ?? {};
  const first = Object.values(images)[0] as { hash?: string } | undefined;
  if (!first?.hash) {
    throw new Error(
      `Image upload succeeded but no hash was returned: ${JSON.stringify(res)}`,
    );
  }
  return first.hash;
}

/**
 * Uploads a video and returns its id. Note: Meta processes the video
 * asynchronously — it may take a short while before it is usable in an ad.
 */
export async function uploadVideo(
  client: MetaClient,
  adAccountId: string,
  videoPath: string,
): Promise<string> {
  const res = await client.uploadFile(
    `act_${adAccountId}/advideos`,
    videoPath,
    {},
    "uploadVideo",
  );
  if (res.dryRun) return "dry-run-video-id";
  if (!res.id) {
    throw new Error(
      `Video upload succeeded but no id was returned: ${JSON.stringify(res)}`,
    );
  }
  return res.id;
}
