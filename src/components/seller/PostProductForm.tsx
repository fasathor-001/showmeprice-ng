import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import ProductCategorySelector from "./ProductCategorySelector";
import { useCurrentBusiness } from "../../hooks/useSeller";
import { useStates } from "../../hooks/useStates";
import { useImageUpload } from "../../hooks/useImageUpload";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";
import { CircleAlert, ImagePlus, X, Loader2, Tag, MapPin } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Props = {
  onClose?: () => void;
};

type PostKind = "ad" | "deal";
const getPostKind = (): PostKind => {
  try {
    return (window as any).__smp_post_kind === "deal" ? "deal" : "ad";
  } catch {
    return "ad";
  }
};

const MAX_IMAGES = 6;
const MAX_IMAGE_MB = 6;

function nav(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
}

function formatMoneyInput(v: string) {
  const digits = String(v || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

type ValidateField = "title" | "price" | "category" | "state_id" | "city" | "description" | "general";
type ValidateResult = { message: string; field?: ValidateField };

function getFlagRow(flags: any[], key: string) {
  return flags.find((f: any) => f?.key === key || f?.flag_key === key) ?? null;
}

function toFileArray(input: FileList | File[] | null | undefined): File[] {
  if (!input) return [];
  return Array.isArray(input) ? input : Array.from(input);
}

export default function PostProductForm({ onClose }: Props) {
  const { business, loading: businessLoading } = useCurrentBusiness();

  const productSubmitting = false;

  const img: any = useImageUpload();
  const uploadImages: any = img?.uploadImages;
  const imagesUploading: boolean = !!img?.uploading;
  const uploadError: any = img?.error ?? null;

  const statesHook: any = useStates();
  const statesLoading = !!statesHook?.loading;
  const states = (statesHook?.states ?? statesHook?.data ?? []) as any[];

  const ff: any = useFeatureFlags();
  const flagsLoading = !!ff?.loading;
  const flagList = (ff?.flags ?? ff?.flagList ?? []) as any[];

  const isEnabled = ff?.isEnabled
    ? ff.isEnabled
    : (key: string) => !!getFlagRow(flagList, key)?.enabled;

  const dealsEnabled = !flagsLoading && !!isEnabled("deals_enabled");
  const dealsPostingEnabled = dealsEnabled && !flagsLoading && !!isEnabled("deals_posting_enabled");
  const canPostDeal = dealsEnabled && dealsPostingEnabled;

  const seasonLabel = useMemo(() => {
    const row = getFlagRow(flagList, "deals_posting_enabled");
    const label = String(row?.description ?? row?.label ?? "").trim();
    return label || "Seasonal Deals";
  }, [flagList]);

  const postKind = getPostKind();
  const isDealPost = postKind === "deal";

  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    price: "",
    description: "",
    condition: "used",
    state_id: "",
    city: "",
  });

  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const isEdit = !!editProductId;

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const previewsRef = useRef<string[]>([]);
  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onOpen = () => {
      const p = (window as any).__smp_edit_product || null;
      if (p && p.id) {
        setEditProductId(String(p.id));
        setFormData({
          title: String(p.title ?? "").trim(),
          price: String(p.price ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ","),
          description: String(p.description ?? "").trim(),
          condition: String(p.condition ?? "used"),
          state_id: p.state_id != null ? String(p.state_id) : "",
          city: String(p.city ?? "").trim(),
        });
        const catId = p.category_id ?? p.subcategory_id ?? null;
        setSubcategoryId(catId != null ? Number(catId) : null);
        const imgs = Array.isArray(p.images) ? p.images.filter((x) => String(x ?? "").trim()) : [];
        setExistingImages(imgs as string[]);
        setPreviews(imgs as string[]);
        setSelectedFiles([]);
      } else {
        setEditProductId(null);
        setExistingImages([]);
        setSelectedFiles([]);
        setPreviews([]);
        setSubcategoryId(null);
        setFormData({
          title: "",
          price: "",
          description: "",
          condition: "used",
          state_id: "",
          city: "",
        });
      }
    };

    window.addEventListener("smp:post-product:open", onOpen as EventListener);
    return () => {
      window.removeEventListener("smp:post-product:open", onOpen as EventListener);
    };
  }, []);

  const [formError, setFormError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; tone?: "error" | "success" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const notify = useCallback((message: string, tone: "error" | "success" = "error") => {
    try {
      window.dispatchEvent(new CustomEvent("smp:toast", { detail: { type: tone, message } }));
    } catch {
      // intentionally empty
    }
    if ((window as any).__smp_toast_global) return;
    setToast({ message, tone });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      previewsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const titleRef = useRef<HTMLInputElement | null>(null);
  const priceRef = useRef<HTMLInputElement | null>(null);
  const stateRef = useRef<HTMLSelectElement | null>(null);
  const cityRef = useRef<HTMLInputElement | null>(null);
  const descRef = useRef<HTMLTextAreaElement | null>(null);

  const focusField = (field?: ValidateField) => {
    const map: Partial<Record<ValidateField, React.RefObject<any>>> = {
      title: titleRef,
      price: priceRef,
      state_id: stateRef,
      city: cityRef,
      description: descRef,
    };
    const ref = field ? map[field] : null;
    const el = (ref?.current as HTMLElement | null) ?? null;
    if (el) {
      el.focus?.();
      el.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
  };

  const isSubmitting = productSubmitting || imagesUploading || businessLoading;

  const getBusinessId = () => (business as any)?.id ?? (business as any)?.business_id ?? null;

  const clearKindMarker = () => {
    try {
      delete (window as any).__smp_post_kind;
    } catch {
      // intentionally empty
    }
  };

  const closeModal = () => {
    try {
      (window as any).__smp_edit_product = null;
    } catch {
      // intentionally empty
    }
    setEditProductId(null);
    setExistingImages([]);
    setSelectedFiles([]);
    setPreviews([]);
    clearKindMarker();
    onClose?.();
  };

  const toastOverlay = toast ? (
    <div className="fixed top-4 right-4 z-[9999] max-w-[92vw] sm:max-w-md">
      <div
        className={[
          "rounded-2xl border px-4 py-3 shadow-xl backdrop-blur",
          toast.tone === "success"
            ? "bg-emerald-600 text-white border-emerald-500/40"
            : "bg-slate-900 text-white border-slate-700/40",
        ].join(" ")}
      >
        <div className="text-sm font-semibold">{toast.message}</div>
      </div>
    </div>
  ) : null;

  const addFiles = (incoming: FileList | File[]) => {
    setFormError(null);

    if (isEdit && existingImages.length > 0 && selectedFiles.length === 0) {
      setExistingImages([]);
      setPreviews([]);
    }

    const incomingArr = toFileArray(incoming);

    const remaining = MAX_IMAGES - selectedFiles.length;
    if (remaining <= 0) {
      notify("Max 6 photos per product.", "error");
      return;
    }

    const slice = incomingArr.slice(0, remaining);
    if (incomingArr.length > remaining) {
      notify("Max 6 photos per product.", "error");
    }
    const accepted: File[] = [];
    const nextUrls: string[] = [];
    const rejected: string[] = [];

    for (const f of slice) {
      if (!f.type.startsWith("image/")) {
        rejected.push(`${f.name}: not an image`);
        continue;
      }
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
        rejected.push(`${f.name}: > ${MAX_IMAGE_MB}MB`);
        continue;
      }
      accepted.push(f);
      nextUrls.push(URL.createObjectURL(f));
    }

    if (rejected.length) notify(`Some files were skipped: ${rejected.join(", ")}`, "error");

    if (accepted.length) {
      setSelectedFiles((p) => [...p, ...accepted]);
      setPreviews((p) => [...p, ...nextUrls]);
    }
  };

  const removeImageAt = (idx: number) => {
    setSelectedFiles((p) => p.filter((_, i) => i !== idx));
    setPreviews((p) => {
      const removed = p[idx];
      if (removed && String(removed).startsWith("blob:")) URL.revokeObjectURL(removed);
      return p.filter((_, i) => i !== idx);
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "price") {
      setFormData((p) => ({ ...p, price: formatMoneyInput(value) }));
      return;
    }
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const validate = (): ValidateResult | null => {
    const title = formData.title.trim();
    const desc = formData.description.trim();
    const priceNum = Number(String(formData.price).replace(/,/g, "").trim());
    const city = formData.city.trim();
    const businessId = getBusinessId();

    if (!business) return { message: "Seller profile missing.", field: "general" };
    if (!businessId) return { message: "Missing business id (upload folder).", field: "general" };

    if (title.length < 4) return { message: "Title is required (min 4 characters).", field: "title" };
    if (!Number.isFinite(priceNum) || priceNum <= 0) return { message: "Enter a valid price.", field: "price" };
    if (!subcategoryId) return { message: "Please select a category (hub + subcategory).", field: "category" };
    if (!formData.state_id) return { message: "Please select a state.", field: "state_id" };
    if (city.length < 2) return { message: "City / Area is required (e.g. Ikeja, Lekki, Yaba).", field: "city" };
    if (desc.length < 10) return { message: "Description is required (min 10 characters).", field: "description" };

    if (isDealPost && (!dealsEnabled || !canPostDeal)) {
      return { message: "Deal posting is currently closed.", field: "general" };
    }

    if (!uploadImages) return { message: "Image upload function not available.", field: "general" };
    return null;
  };

  const normalizeUploaded = (res: any): string[] => {
    if (!res) return [];
    if (Array.isArray(res)) {
      if (res.every((x) => typeof x === "string")) return res as string[];
      return (res as any[])
        .map((x) => x?.publicUrl ?? x?.url ?? x?.public_url ?? x?.publicURL ?? null)
        .filter(Boolean);
    }
    if (Array.isArray(res?.urls)) return res.urls.filter(Boolean);
    return [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setFormError(null);

  if (businessLoading) {
    notify("Loading seller profile. Please wait...", "error");
    return;
  }

  const businessId = getBusinessId();
  if (!businessId) {
    const msg = "Complete seller profile before posting.";
    setFormError(msg);
    notify(msg, "error");
    nav("/seller/setup");
    return;
  }

  if (!supabase) {
    const msg = "Database connection failed.";
    setFormError(msg);
    notify(msg, "error");
    return;
  }

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user?.id) {
    const msg = authErr?.message || "Please sign in to post a product.";
    setFormError(msg);
    notify(msg, "error");
    return;
  }
  const ownerId = authData.user.id;

  const v = validate();
  if (v) {
    setFormError(v.message);
    notify(v.message, "error");
    focusField(v.field);
    return;
  }

  const priceNum = Number(String(formData.price).replace(/,/g, "").trim());

  let uploadedUrls: string[] = [];
  if (selectedFiles.length > 0 && uploadImages) {
    try {
      if (import.meta.env.DEV) console.log("UPLOAD_COUNT", selectedFiles.length);
      let res: any;
      if (typeof uploadImages === "function" && uploadImages.length >= 2) {
        res = await uploadImages(selectedFiles, businessId);
      } else {
        res = await uploadImages(selectedFiles);
      }
      uploadedUrls = normalizeUploaded(res);
      if (import.meta.env.DEV) console.log("UPLOADED_URLS", uploadedUrls);
    } catch (err: any) {
      const msg = err?.message ?? "Image upload failed. Check Storage policies (RLS).";
      setFormError(msg);
      notify(msg, "error");
      return;
    }
  }

  const imagesToSave = selectedFiles.length > 0 ? uploadedUrls : existingImages;

  try {
    if (isEdit) {
      const edit = (window as any).__smp_edit_product;
      const editId = edit?.id ? String(edit.id) : "";
      if (!editId) {
        const msg = "Could not identify product to update";
        setFormError(msg);
        notify(msg, "error");
        return;
      }

      const userId = authData?.user?.id ?? "";
      if (import.meta.env.DEV) console.log("EDIT_UPDATE_TARGET", { editId, businessId, userId });
      const nextImages =
        selectedFiles.length > 0
          ? [...(existingImages || []), ...uploadedUrls].slice(0, MAX_IMAGES)
          : existingImages;

      const payload = {
        business_id: businessId,
        category_id: subcategoryId as number,
        title: formData.title.trim(),
        price: priceNum,
        description: formData.description.trim(),
        condition: formData.condition as any,
        state_id: parseInt(formData.state_id, 10),
        city: formData.city.trim(),
        images: nextImages,
        is_deal: isDealPost,
        deal_season: isDealPost ? seasonLabel : null,
      };

      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", editId)
        .select("id")
        .maybeSingle();

      if (error) {
        const msg = error?.message || "Product not updated. Please try again.";
        setFormError(msg);
        notify(msg, "error");
        return;
      }

      if (!data?.id) {
        const msg = "Could not update product (permission or not found). Please refresh and try again.";
        setFormError(msg);
        notify(msg, "error");
        return;
      }

      window.dispatchEvent(
        new CustomEvent("smp:toast", {
          detail: { type: "success", message: "✅ Product updated successfully." },
        })
      );
      window.dispatchEvent(
        new CustomEvent("smp:products:refresh", {
          detail: { businessId: String(businessId || ""), productId: String(data.id || ""), mode: "updated" },
        })
      );
      try {
        (window as any).__smp_edit_product = null;
      } catch {
        // intentionally empty
      }
      setTimeout(() => closeModal(), 50);
      return;
    }

    const payload = {
      business_id: businessId,
      owner_id: ownerId,
      category_id: subcategoryId as number,
      title: formData.title.trim(),
      price: priceNum,
      description: formData.description.trim(),
      condition: formData.condition as any,
      state_id: parseInt(formData.state_id, 10),
      city: formData.city.trim(),
      images: imagesToSave,
      is_deal: isDealPost,
      deal_season: isDealPost ? seasonLabel : null,
    };

    const { data, error } = await supabase.from("products").insert(payload).select("id").maybeSingle();
    if (error || !data?.id) {
      const msg = error?.message || "Product not saved. Please try again.";
      setFormError(msg);
      notify(msg, "error");
      return;
    }

    if (import.meta.env.DEV) console.log("POSTED_PRODUCT_ID", data.id);
    window.dispatchEvent(
      new CustomEvent("smp:toast", {
        detail: { type: "success", message: "✅ Product posted. It’s now live on the marketplace." },
      })
    );
    window.dispatchEvent(
      new CustomEvent("smp:products:refresh", {
        detail: { businessId: String(businessId || ""), productId: String(data.id || ""), mode: "created" },
      })
    );
    setTimeout(() => closeModal(), 50);
  } catch (err: any) {
    const msg = err?.message ?? "Failed to post listing.";
    setFormError(msg);
    notify(msg, "error");
  }
};

  if (businessLoading) {
    return (
      <div className="bg-gradient-to-b from-slate-50 to-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {toastOverlay}
        <div className="p-5 border-b border-slate-100">
          <div className="h-6 w-44 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-72 bg-slate-200 rounded mt-3 animate-pulse" />
        </div>
        <div className="p-5 space-y-3">
          <div className="h-10 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-10 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="bg-gradient-to-b from-slate-50 to-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {toastOverlay}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-slate-500">Seller</div>
            <div className="text-xl font-black text-emerald-700">Post Listing</div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="p-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex gap-3">
            <CircleAlert className="w-5 h-5 mt-0.5" />
            <div>
              <div className="font-black">Seller profile missing</div>
              <div className="text-sm mt-1">Create a seller profile before posting products.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isDealPost && (!dealsEnabled || !canPostDeal)) {
    return (
      <div className="bg-gradient-to-b from-slate-50 to-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {toastOverlay}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-slate-500">Deals</div>
            <div className="text-xl font-black text-emerald-700">Post a Deal</div>

            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-red-600 text-white text-xs font-black shadow-md shadow-red-600/20 border border-red-500/30">
              <Tag className="w-4 h-4" />
              SEASON <span className="opacity-95">{seasonLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="p-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <CircleAlert className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <div className="font-black text-slate-900">Deal Season Closed</div>
                <div className="text-sm text-slate-600 mt-1">
                  Admin has not opened deal posting. When it’s open, you’ll be able to post under{" "}
                  <span className="font-black">{seasonLabel}</span>.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
      {toastOverlay}

      <div className="sticky top-0 z-10 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
        <div className="p-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-black text-slate-500">
              {isEdit ? "Edit Listing" : isDealPost ? "Seasonal Deal Listing" : "Product Listing"}
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700">
              {isEdit ? "Edit Product" : isDealPost ? "Post a Deal" : "Post New Product"}
            </div>
            <div className="text-sm text-slate-600 mt-1">Transparent pricing only — no “DM for price”.</div>

            {isDealPost ? (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-red-600 text-white text-xs font-black shadow-md shadow-red-600/20 border border-red-500/30">
                <Tag className="w-4 h-4" />
                SEASON <span className="opacity-95 max-w-[260px] truncate">{seasonLabel}</span>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="shrink-0 p-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition"
            aria-label="Close"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {formError || uploadError ? (
          <div className="px-5 pb-5">
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-sm font-semibold flex gap-3">
              <CircleAlert className="w-5 h-5 mt-0.5" />
              <div className="min-w-0">{formError || uploadError}</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 pb-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-8">
                <label className="text-sm font-semibold text-slate-700 block mb-2">Title</label>
                <input
                  ref={titleRef}
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. iPhone 13 Pro Max"
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="text-sm font-semibold text-slate-700 block mb-2">Price (₦)</label>
                <input
                  ref={priceRef}
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="e.g. 250,000"
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">Category</label>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <ProductCategorySelector onCategorySelect={(id) => setSubcategoryId(id)} />
              {!subcategoryId ? (
                <div className="text-xs text-slate-500 mt-2">Select a hub + subcategory to continue.</div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">Condition</label>
              <select
                name="condition"
                value={formData.condition}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="new">New</option>
                <option value="used">Used</option>
                <option value="refurbished">Refurbished</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">State</label>
              <select
                ref={stateRef}
                name="state_id"
                value={formData.state_id}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                disabled={statesLoading}
              >
                <option value="">{statesLoading ? "Loading states..." : "Select a state"}</option>
                {states.map((s: any) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">
              City / Area <span className="text-emerald-700 font-black">(required)</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={cityRef}
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="e.g. Ikeja, Lekki, Yaba"
                className="w-full border border-slate-200 rounded-2xl pl-10 pr-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
            <div className="text-xs text-slate-500 mt-2">
              This will show to buyers to know your exact area within the state.
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">Description</label>
            <textarea
              ref={descRef}
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Give buyers details: condition, accessories, warranty, pickup/delivery, etc."
              className="w-full border border-slate-200 rounded-2xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-sm font-semibold text-slate-700">Images</label>
              <div className="text-xs text-slate-500 font-semibold">
                {selectedFiles.length}/{MAX_IMAGES} • max {MAX_IMAGE_MB}MB each
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  const files = e.currentTarget.files;
                  if (files && files.length) addFiles(files);
                  e.currentTarget.value = "";
                }}
                className="hidden"
              />

              <div className="flex flex-wrap gap-3">
                {previews.map((url, idx) => (
                  <div key={url} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-200">
                    <img src={url} alt="preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImageAt(idx)}
                      className="absolute top-2 right-2 bg-white/95 hover:bg-white rounded-full p-1.5 shadow"
                      aria-label="Remove image"
                      title="Remove"
                    >
                      <X className="w-4 h-4 text-slate-700" />
                    </button>
                  </div>
                ))}

                {selectedFiles.length < MAX_IMAGES ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-2xl border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 transition flex flex-col items-center justify-center gap-2"
                  >
                    <ImagePlus className="w-5 h-5 text-slate-700" />
                    <span className="text-xs font-black text-slate-700">Add</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 pt-4">
            <div className="bg-gradient-to-t from-white via-white/95 to-transparent pt-4">
              <button
                type="submit"
                disabled={isSubmitting || !subcategoryId}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-600 text-white font-black shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {businessLoading
                      ? "Loading seller profile..."
                      : imagesUploading
                      ? "Uploading..."
                      : "Posting..."}
                  </>
                ) : (
                  <>{isEdit ? "Update Product" : isDealPost ? "Post Deal" : "Post Product"}</>
                )}
              </button>

              <button
                type="button"
                onClick={closeModal}
                className="mt-3 w-full py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
