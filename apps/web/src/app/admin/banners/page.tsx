"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  GripVertical,
  Image as ImageIcon,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api, FILE_BASE } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { ButtonLoading, TableLoading } from "@/components/ui";

interface HeroBanner {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  mobileImageUrl?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  badgeText?: string | null;
  badgeColor?: string | null;
  isActive: boolean;
  sortOrder: number;
  autoSlide: boolean;
  createdAt: string;
  updatedAt: string;
}

type Draft = Omit<HeroBanner, "id" | "createdAt" | "updatedAt">;
type UploadVariant = "desktop" | "mobile";

const DEFAULT_DRAFT: Draft = {
  title: "",
  subtitle: "",
  imageUrl: "/banners/ff-banner-1.svg",
  mobileImageUrl: "",
  ctaText: "",
  ctaLink: "",
  badgeText: "",
  badgeColor: "#E53935",
  isActive: true,
  sortOrder: 0,
  autoSlide: true,
};

export default function AdminBannersPage() {
  const toast = useToast();
  const { data, isLoading, mutate } = useSWR<HeroBanner[]>("/admin/banners", {
    revalidateOnFocus: false,
  });
  const banners = data ?? [];
  const [editing, setEditing] = useState<HeroBanner | null>(null);
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [desktopFile, setDesktopFile] = useState<File | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [desktopPreview, setDesktopPreview] = useState<string | null>(null);
  const [mobilePreview, setMobilePreview] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...banners].sort((a, b) => a.sortOrder - b.sortOrder),
    [banners],
  );

  function openAdd() {
    setEditing(null);
    setDraft({ ...DEFAULT_DRAFT, sortOrder: sorted.length + 1 });
    setDesktopFile(null);
    setMobileFile(null);
    setDesktopPreview(null);
    setMobilePreview(null);
    setPanelOpen(true);
  }

  function openEdit(banner: HeroBanner) {
    setEditing(banner);
    setDraft({
      title: banner.title,
      subtitle: banner.subtitle ?? "",
      imageUrl: banner.imageUrl,
      mobileImageUrl: banner.mobileImageUrl ?? "",
      ctaText: banner.ctaText ?? "",
      ctaLink: banner.ctaLink ?? "",
      badgeText: banner.badgeText ?? "",
      badgeColor: banner.badgeColor ?? "#E53935",
      isActive: banner.isActive,
      sortOrder: banner.sortOrder,
      autoSlide: banner.autoSlide,
    });
    setDesktopFile(null);
    setMobileFile(null);
    setDesktopPreview(null);
    setMobilePreview(null);
    setPanelOpen(true);
  }

  async function saveBanner(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = normalizeDraft(draft);
      const saved = editing
        ? await api<HeroBanner>(`/admin/banners/${editing.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await api<HeroBanner>("/admin/banners", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      if (desktopFile) await uploadImage(saved.id, desktopFile, "desktop", false);
      if (mobileFile) await uploadImage(saved.id, mobileFile, "mobile", false);
      toast.success(editing ? "Banner saved." : "Banner created.");
      setPanelOpen(false);
      await mutate();
    } catch (err: any) {
      toast.error(err.message || "Could not save banner.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(id: string, file: File, variant: UploadVariant, refresh = true) {
    setUploading(`${id}:${variant}`);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const updated = await api<HeroBanner>(`/admin/banners/${id}/upload?variant=${variant}`, {
        method: "POST",
        body: fd,
      });
      setDraft((current) => ({
        ...current,
        imageUrl: variant === "desktop" ? updated.imageUrl : current.imageUrl,
        mobileImageUrl: variant === "mobile" ? updated.mobileImageUrl ?? "" : current.mobileImageUrl,
      }));
      toast.success(variant === "mobile" ? "Mobile image updated." : "Desktop image updated.");
      if (refresh) await mutate();
    } catch (err: any) {
      toast.error(err.message || "Image upload failed.");
    } finally {
      setUploading(null);
    }
  }

  function chooseFile(file: File | null, variant: UploadVariant) {
    if (!file) return;
    const maxBytes = variant === "desktop" ? 2 * 1024 * 1024 : 1 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(
        `File too large. ${variant === "desktop" ? "Desktop" : "Mobile"} image must be under ${
          maxBytes / 1024 / 1024
        }MB`,
      );
      return;
    }
    const preview = URL.createObjectURL(file);
    if (variant === "desktop") {
      setDesktopFile(file);
      setDesktopPreview(preview);
      if (editing) uploadImage(editing.id, file, "desktop").catch(() => {});
    } else {
      setMobileFile(file);
      setMobilePreview(preview);
      if (editing) uploadImage(editing.id, file, "mobile").catch(() => {});
    }
  }

  async function toggleBanner(banner: HeroBanner) {
    await mutate(
      async () => {
        const updated = await api<HeroBanner>(`/admin/banners/${banner.id}/toggle`, { method: "PUT" });
        return banners.map((item) => (item.id === banner.id ? updated : item));
      },
      { optimisticData: banners.map((item) => item.id === banner.id ? { ...item, isActive: !item.isActive } : item) },
    );
  }

  async function deleteBanner(banner: HeroBanner) {
    if (!confirm(`Delete "${banner.title}"?`)) return;
    try {
      await api(`/admin/banners/${banner.id}`, { method: "DELETE" });
      toast.success("Banner deleted.");
      await mutate();
    } catch (err: any) {
      toast.error(err.message || "Could not delete banner.");
    }
  }

  async function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const current = [...sorted];
    const from = current.findIndex((item) => item.id === dragId);
    const to = current.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = current.splice(from, 1);
    current.splice(to, 0, moved);
    const ordered = current.map((item, index) => ({ ...item, sortOrder: index + 1 }));
    setDragId(null);
    await mutate(ordered, false);
    try {
      await api("/admin/banners/reorder", {
        method: "PUT",
        body: JSON.stringify({
          orders: ordered.map(({ id, sortOrder }) => ({ id, sortOrder })),
        }),
      });
      await mutate();
    } catch (err: any) {
      toast.error(err.message || "Could not reorder banners.");
      await mutate();
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="label">Content</p>
          <h1 className="font-display text-2xl">Hero Banners</h1>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Banner
        </button>
      </div>

      <div className="table-wrap">
        {isLoading ? (
          <TableLoading columns={8} rows={5} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>Image</th>
                <th>Title</th>
                <th>Link</th>
                <th>Badge</th>
                <th>Active</th>
                <th>Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((banner) => (
                <tr
                  key={banner.id}
                  draggable
                  onDragStart={() => setDragId(banner.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOn(banner.id)}
                  className={dragId === banner.id ? "opacity-50" : ""}
                >
                  <td className="w-8 text-white/40">
                    <GripVertical size={16} />
                  </td>
                  <td>
                    <img
                      src={bannerImageUrl(banner.imageUrl)}
                      alt=""
                      className="h-10 w-[60px] rounded object-cover"
                    />
                  </td>
                  <td>
                    <p className="font-semibold text-white">{banner.title}</p>
                    <p className="max-w-[320px] truncate text-xs text-white/45">
                      {banner.subtitle || "No subtitle"}
                    </p>
                  </td>
                  <td className="max-w-[200px] truncate text-xs text-white/60">
                    {banner.ctaLink ? (
                      <a href={banner.ctaLink} target="_blank" rel="noreferrer" className="underline hover:text-white">
                        {banner.ctaLink}
                      </a>
                    ) : (
                      <span className="text-white/30">No link</span>
                    )}
                  </td>
                  <td>
                    {banner.badgeText ? (
                      <span
                        className="rounded-full px-2 py-1 text-[10px] font-bold text-white"
                        style={{ backgroundColor: banner.badgeColor || "#E53935" }}
                      >
                        {banner.badgeText}
                      </span>
                    ) : (
                      <span className="text-xs text-white/35">None</span>
                    )}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={banner.isActive}
                      onChange={() => toggleBanner(banner).catch((err) => toast.error(err.message))}
                    />
                  </td>
                  <td className="font-mono text-xs">{banner.sortOrder}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-outline text-xs" onClick={() => openEdit(banner)}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button className="btn-outline text-xs" onClick={() => deleteBanner(banner)}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!sorted.length && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-white/40">
                    No banners yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {panelOpen && (
        <BannerPanel
          draft={draft}
          editing={editing}
          saving={saving}
          uploading={uploading}
          desktopPreview={desktopPreview}
          mobilePreview={mobilePreview}
          setDraft={setDraft}
          onClose={() => setPanelOpen(false)}
          onSave={saveBanner}
          onChooseFile={chooseFile}
        />
      )}
    </div>
  );
}

function BannerPanel({
  draft,
  editing,
  saving,
  uploading,
  desktopPreview,
  mobilePreview,
  setDraft,
  onClose,
  onSave,
  onChooseFile,
}: {
  draft: Draft;
  editing: HeroBanner | null;
  saving: boolean;
  uploading: string | null;
  desktopPreview: string | null;
  mobilePreview: string | null;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  onChooseFile: (file: File | null, variant: UploadVariant) => void;
}) {
  const previewImage = desktopPreview || bannerImageUrl(draft.imageUrl);
  return (
    <div className="fixed inset-0 z-50 bg-black/60">
      <aside className="ml-auto h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-bg p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="label">{editing ? "Edit Banner" : "Add Banner"}</p>
            <h2 className="font-display text-xl text-white">
              {editing ? editing.title : "New Hero Banner"}
            </h2>
          </div>
          <button className="btn-outline" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              required
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Subtitle</label>
            <input
              className="input"
              value={draft.subtitle ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">Badge Text</label>
              <input
                className="input"
                value={draft.badgeText ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, badgeText: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Badge Color</label>
              <input
                type="color"
                className="h-11 w-full rounded-md border border-border bg-surface p-1"
                value={draft.badgeColor || "#E53935"}
                onChange={(e) => setDraft((d) => ({ ...d, badgeColor: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">CTA Button Text</label>
              <input
                className="input"
                value={draft.ctaText ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, ctaText: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">CTA Link</label>
              <input
                className="input"
                placeholder="e.g. /tournaments or /challenges"
                value={draft.ctaLink ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, ctaLink: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="label">Sort Order</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="input"
                value={draft.sortOrder}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  setDraft((d) => ({ ...d, sortOrder: digits ? Number(digits) : 0 }));
                }}
              />
            </div>
            <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-3 text-sm text-white">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
              />
              Active
            </label>
            <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-3 text-sm text-white">
              <input
                type="checkbox"
                checked={draft.autoSlide}
                onChange={(e) => setDraft((d) => ({ ...d, autoSlide: e.target.checked }))}
              />
              Auto Slide
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <UploadBox
              title="Desktop Image"
              helper="1200x400px, max 2MB"
              preview={desktopPreview || bannerImageUrl(draft.imageUrl)}
              busy={uploading === `${editing?.id}:desktop`}
              onFile={(file) => onChooseFile(file, "desktop")}
            />
            <UploadBox
              title="Mobile Image"
              helper="600x338px for mobile crop"
              preview={mobilePreview || bannerImageUrl(draft.mobileImageUrl || draft.imageUrl)}
              busy={uploading === `${editing?.id}:mobile`}
              onFile={(file) => onChooseFile(file, "mobile")}
            />
          </div>

          <div>
            <p className="label mb-2">Live Preview</p>
            <div className="overflow-hidden rounded-lg border border-border">
                    <div
                      className="relative aspect-[3/1] md:aspect-[16/5] origin-top-left overflow-hidden bg-cover bg-center"
                      style={{
                        backgroundImage: `linear-gradient(to right, rgba(0,0,0,.75), rgba(0,0,0,.25), transparent), url(${previewImage})`,
                      }}
                    >
                <div className="absolute bottom-4 left-5 max-w-xs">
                  {draft.badgeText && (
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-bold text-white"
                      style={{ backgroundColor: draft.badgeColor || "#E53935" }}
                    >
                      {draft.badgeText}
                    </span>
                  )}
                  <p className="mt-2 font-display text-lg font-bold text-white">{draft.title || "Banner title"}</p>
                  <p className="line-clamp-2 text-xs text-white/80">{draft.subtitle || "Banner subtitle"}</p>
                  {draft.ctaText && (
                    <span className="mt-2 inline-flex rounded-md bg-[#E53935] px-3 py-1.5 text-xs font-bold text-white">
                      {draft.ctaText}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button className="btn-primary w-full" disabled={saving} type="submit">
            <ButtonLoading loading={saving} loadingText="Saving...">
              <Save size={16} /> Save Banner
            </ButtonLoading>
          </button>
        </form>
      </aside>
    </div>
  );
}

function UploadBox({
  title,
  helper,
  preview,
  busy,
  onFile,
}: {
  title: string;
  helper: string;
  preview: string;
  busy: boolean;
  onFile: (file: File | null) => void;
}) {
  return (
    <label
      className="block cursor-pointer rounded-lg border border-dashed border-border bg-surface/60 p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFile(e.dataTransfer.files?.[0] ?? null);
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-[10px] text-white/45">{helper}</p>
        </div>
        {busy ? <span className="text-xs text-neon-cyan">Uploading...</span> : <Upload size={16} className="text-white/50" />}
      </div>
      <div className="relative aspect-[3/1] md:aspect-[16/5] overflow-hidden rounded-md border border-border bg-card">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/35">
            <ImageIcon size={24} />
          </div>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function normalizeDraft(draft: Draft) {
  return {
    title: draft.title.trim(),
    subtitle: draft.subtitle?.trim() || null,
    imageUrl: draft.imageUrl || "/banners/ff-banner-1.svg",
    mobileImageUrl: draft.mobileImageUrl?.trim() || null,
    ctaText: draft.ctaText?.trim() || null,
    ctaLink: draft.ctaLink?.trim() || null,
    badgeText: draft.badgeText?.trim() || null,
    badgeColor: draft.badgeColor?.trim() || null,
    isActive: draft.isActive,
    sortOrder: Number(draft.sortOrder) || 0,
    autoSlide: draft.autoSlide,
  };
}

function bannerImageUrl(url?: string | null) {
  if (!url) return "/banners/ff-banner-1.svg";
  if (/^https?:\/\//.test(url) || url.endsWith(".svg")) return url;
  if (url.startsWith("/banners/")) return `${FILE_BASE}${url}`;
  return url;
}
