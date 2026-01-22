import { useState } from "react";
import { supabase } from "../lib/supabase";

const MAX_IMAGE_MB = 5;

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadImages = async (files: File[], businessId: string): Promise<string[]> => {
    if (files.length === 0) return [];

    setUploading(true);
    setError(null);

    const urls: string[] = [];

    if (!supabase) {
      setError("Storage connection failed.");
      setUploading(false);
      return [];
    }

    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          const msg = `${file.name} is not an image.`;
          setError(msg);
          throw new Error(msg);
        }
        if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
          const msg = `${file.name} is larger than ${MAX_IMAGE_MB}MB.`;
          setError(msg);
          throw new Error(msg);
        }

        const rawName = file.name || "image";
        const safeName = rawName.replace(/[^\w.-]+/g, "-");
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}-${safeName}`;
        const filePath = `${businessId}/${fileName}`;
        console.log("UPLOAD_KEY", filePath);

        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          const msg = (uploadError as any)?.message ?? String(uploadError);
          console.error("Upload error:", uploadError);
          setError(msg);
          throw new Error(msg);
        }

        const { data } = supabase.storage.from("products").getPublicUrl(filePath);
        if (data?.publicUrl) urls.push(data.publicUrl);
      }

      if (urls.length === 0) {
        const msg = "Failed to upload images.";
        setError(msg);
        throw new Error(msg);
      }
    } catch (err: any) {
      console.error("Upload process error:", err);
      if (urls.length === 0 && !error) setError("Failed to upload images.");
      throw err;
    } finally {
      setUploading(false);
    }

    return urls;
  };

  return { uploadImages, uploading, error };
}
