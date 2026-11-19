export function compressImageBase64(
  base64Str: string,
  maxWidth = 1200,
  maxWeightBytes = 800000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!base64Str.startsWith("data:image/")) {
      console.log(
        "[Client Compressor] Document asset recognized (PDF/Doc). Bypassing compression safely.",
      );
      return resolve(base64Str);
    }

    const img = new Image();
    img.src = base64Str;

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(base64Str);

      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.75;
      let compressedDataUrl = canvas.toDataURL("image/jpeg", quality);

      while (
        compressedDataUrl.length * 0.75 > maxWeightBytes &&
        quality > 0.3
      ) {
        quality -= 0.1;
        compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      }

      console.log(
        `[Client Compressor] Compressed camera snapshot down to ${Math.round((compressedDataUrl.length * 3) / 4 / 1024)} KB for instant Cloudinary upload.`,
      );
      resolve(compressedDataUrl);
    };

    img.onerror = (err) => reject(err);
  });
}
