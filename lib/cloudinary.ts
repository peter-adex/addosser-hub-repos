import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export { cloudinary };

export async function uploadFile(
  base64: string,
  folder: string,
<<<<<<< HEAD
  publicId?: string,
=======
  publicId?: string
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
): Promise<{ url: string; publicId: string }> {
  const result = await cloudinary.uploader.upload(base64, {
    folder: `addosser-hub/${folder}`,
    public_id: publicId,
    overwrite: true,
<<<<<<< HEAD
    resource_type: "raw",
    type: "upload",
    access_mode: "public",
=======
    resource_type: "auto",
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  });
  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteFile(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}
<<<<<<< HEAD

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format: string;
  bytes: number;
  resourceType: string;
}

export type CloudinaryFolder =
  | "drivers"
  | "vehicles"
  | "work-orders"
  | "appraisals";

export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder: CloudinaryFolder,
  filename?: string,
): Promise<CloudinaryUploadResult> {
  const isDocument = folder === "work-orders";

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `addosser_fleet/${folder}`,
        public_id: filename ?? undefined,
        resource_type: isDocument ? "raw" : "auto",
        overwrite: true,
        ...(isDocument
          ? {}
          : {
              transformation: [{ quality: "auto", fetch_format: "auto" }],
              eager: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
            }),
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve({
          publicId: result.public_id,
          url: result.url,
          secureUrl: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
          resourceType: result.resource_type,
        });
      },
    );

    uploadStream.end(fileBuffer);
  });
}

export async function uploadBase64ToCloudinary(
  base64DataUrl: string,
  folder: CloudinaryFolder,
  filename?: string,
): Promise<CloudinaryUploadResult> {
  const result = await cloudinary.uploader.upload(base64DataUrl, {
    folder: `addosser_fleet/${folder}`,
    public_id: filename ?? undefined,
  });

  return {
    publicId: result.public_id,
    url: result.url,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
    resourceType: result.resource_type,
  };
}

export async function deleteFromCloudinary(
  publicId: string,
  resourceType: "image" | "raw" = "image",
): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

export function getSignedUrl(publicId: string, expiresInSeconds = 3600): string {
  return cloudinary.url(publicId, {
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    resource_type: "auto",
    secure: true,
  });
}
=======
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
