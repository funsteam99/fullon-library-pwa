"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useState, useTransition } from "react";

import { BarcodeScanner } from "../../../components/barcode-scanner";
import { CameraCapture } from "../../../components/camera-capture";
import { apiRequest } from "../../../lib/api";
import { uploadImage } from "../../../lib/upload";

type CreateMemberResponse = {
  item: {
    id: number;
    memberCode: string;
    name: string;
    photoUrl: string | null;
  };
};

export default function MobileMemberCreatePage() {
  const [memberCode, setMemberCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [unitName, setUnitName] = useState("");
  const [note, setNote] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createdMemberId, setCreatedMemberId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleMemberCodeDetected(code: string) {
    setMemberCode(code);
    setError(null);
  }

  function setCapturedPhoto(file: File, previewUrl: string) {
    setPhotoFile(file);
    setPhotoPreview(previewUrl);
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }

    setCapturedPhoto(file, URL.createObjectURL(file));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setCreatedMemberId(null);

    startTransition(async () => {
      try {
        let photoUrl: string | null = null;

        if (photoFile) {
          const upload = await uploadImage("/api/uploads/member-photo", photoFile);
          photoUrl = upload.url;
        }

        const payload = await apiRequest<CreateMemberResponse>("/api/members", {
          method: "POST",
          body: JSON.stringify({
            memberCode,
            name,
            phone: phone || null,
            email: email || null,
            unitName: unitName || null,
            note: note || null,
            photoUrl,
            status: "active",
          }),
        });

        setCreatedMemberId(payload.item.id);
        setMessage(`已建立會員 ${payload.item.name}，編號 ${payload.item.memberCode}。`);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "建立會員失敗。");
      }
    });
  }

  return (
    <section className="mobile-stack">
      <article className="hero-card compact">
        <p className="eyebrow">Member intake</p>
        <h2>會員建檔</h2>
        <p>可掃會員條碼、手動補資料，也能直接用桌機 webcam 或手機相機拍會員照片。</p>
      </article>

      <section className="action-grid compact">
        <Link href="/mobile/members" className="action-card">
          <div className="action-badge">會員</div>
          <h3>查看會員清單</h3>
          <p>建檔完成後可回清單確認會員資料與照片。</p>
        </Link>
      </section>

      <BarcodeScanner
        label="掃描會員條碼"
        helperText="如果會員卡上已有條碼，可以先掃入當作會員編號。"
        onDetected={handleMemberCodeDetected}
      />

      <form className="mobile-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>會員編號</span>
          <input
            value={memberCode}
            onChange={(event) => setMemberCode(event.target.value)}
            placeholder="例如 M0002"
            autoCapitalize="characters"
            required
          />
        </label>

        <label className="field">
          <span>姓名</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 王小明" required />
        </label>

        <label className="field">
          <span>電話</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="例如 0912345678" inputMode="tel" />
        </label>

        <label className="field">
          <span>Email</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="reader@example.com"
            inputMode="email"
          />
        </label>

        <label className="field">
          <span>班級 / 單位</span>
          <input
            value={unitName}
            onChange={(event) => setUnitName(event.target.value)}
            placeholder="例如 三年甲班 / 志工組"
          />
        </label>

        <label className="field">
          <span>會員照片</span>
          <input type="file" accept="image/*" onChange={handlePhotoChange} />
        </label>

        <CameraCapture label="拍會員照片" onCapture={setCapturedPhoto} />

        {photoPreview ? (
          <div className="cover-preview-card">
            <img src={photoPreview} alt="會員照片預覽" className="cover-preview-image" />
          </div>
        ) : null}

        <label className="field">
          <span>備註</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="例如 特殊身份、證件備註或聯絡說明"
            rows={4}
          />
        </label>

        <button type="submit" className="primary-button" disabled={isPending}>
          {isPending ? "建立中..." : "建立會員"}
        </button>
      </form>

      {message ? (
        <div className="feedback success">
          <div>{message}</div>
          <div className="feedback-link-row">
            <Link href="/mobile/members" className="inline-link">
              查看全部會員
            </Link>
            {createdMemberId ? <span className="feedback-meta">ID: {createdMemberId}</span> : null}
          </div>
        </div>
      ) : null}

      {error ? <div className="feedback error">{error}</div> : null}
    </section>
  );
}
