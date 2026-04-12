"use client";

import { useState } from "react";
import { GATEWAY_URL } from "@/lib/analyse/constants";

interface Props {
  onAccept: (patientId: string) => void;
  /** Mobile: user scrolled the consent body (e.g. to read terms) — parent can tuck away bottom chrome. */
  onConsentBodyScroll?: (scrollTop: number) => void;
}

export function ConsentGate({ onAccept, onConsentBodyScroll }: Props) {
  const [patientId, setPatientId] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleAccept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (
        process.env.NODE_ENV === "development" &&
        process.env.NEXT_PUBLIC_ANALYSE_DEV_BYPASS_CONSENT_GATEWAY === "1"
      ) {
        console.warn(
          "[ConsentGate] NEXT_PUBLIC_ANALYSE_DEV_BYPASS_CONSENT_GATEWAY=1 — skipping consent POST (dev only).",
          GATEWAY_URL
        );
        onAccept(patientId || "ANONYMOUS");
        return;
      }

      /** Same-origin: uses Supabase session cookie — does not depend on Oracle/gateway POST /consent */
      const res = await fetch("/api/labs/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          patient_id: patientId || "ANONYMOUS",
          purpose: "radiology_second_opinion",
          informed_by: "clinician",
        }),
      });
      if (!res.ok) {
        const devGatewayError =
          process.env.NODE_ENV === "development" &&
          [502, 503, 504].includes(res.status);
        if (devGatewayError) {
          console.warn(
            `[ConsentGate] Consent API returned HTTP ${res.status} — entering Manthana Labs in dev only.`
          );
          onAccept(patientId || "ANONYMOUS");
          return;
        }
        throw new Error(`Consent failed (${res.status})`);
      }
      onAccept(patientId || "ANONYMOUS");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isUnreachable =
        e instanceof TypeError ||
        /failed to fetch|networkerror|network request failed|load failed|ec\.connrefused/i.test(msg);
      if (process.env.NODE_ENV === "development" && isUnreachable) {
        console.warn(
          "[ConsentGate] Gateway unreachable — entering Manthana Labs in dev only (consent not recorded server-side).",
          GATEWAY_URL
        );
        onAccept(patientId || "ANONYMOUS");
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to record consent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="consent-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        background: "radial-gradient(circle at top, rgba(0,20,40,0.85), rgba(0,0,0,0.95))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        className="glass-panel"
        onScroll={(e) => onConsentBodyScroll?.(e.currentTarget.scrollTop)}
        style={{
          maxWidth: 680,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "28px 32px max(24px, env(safe-area-inset-bottom, 0px))",
          borderRadius: "var(--r-xl)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 32px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)",
          background: "linear-gradient(180deg, rgba(15,20,30,0.95) 0%, rgba(8,12,20,0.98) 100%)",
        }}
      >
        {/* Header with Shield Icon */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(0,200,180,0.2) 0%, rgba(0,150,140,0.1) 100%)",
              border: "1px solid rgba(0,200,180,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 28,
            }}
          >
            🔒
          </div>
          <p
            className="font-display"
            style={{
              fontSize: 15,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--scan-400)",
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            Secure & Anonymous by Design
          </p>
          <p
            className="font-body"
            style={{
              fontSize: 12,
              color: "var(--text-50)",
              letterSpacing: "0.05em",
            }}
          >
            One-Time Consent Required — DPDP Act 2023 Compliant
          </p>
        </div>

        {/* Privacy & Security Section */}
        <div
          style={{
            background: "rgba(0,200,180,0.05)",
            border: "1px solid rgba(0,200,180,0.15)",
            borderRadius: "var(--r-lg)",
            padding: "18px 20px",
            marginBottom: 20,
          }}
        >
          <p
            className="font-body"
            style={{
              fontSize: 12,
              color: "var(--text-70)",
              lineHeight: 1.7,
              marginBottom: 12,
            }}
          >
            Manthana is engineered with privacy as its foundational principle. Our platform
            automatically anonymizes all data to ensure complete patient confidentiality while
            delivering accurate AI-powered radiology insights.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "10px",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 11, color: "var(--text-65)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--text-80)" }}>Zero Data Leakage:</strong> All uploads
                are encrypted and processed within Manthana&apos;s secure environment
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 11, color: "var(--text-65)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--text-80)" }}>Automatic Anonymization:</strong> Any
                identifying information is automatically stripped from your data
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 11, color: "var(--text-65)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--text-80)" }}>Optional Clinical Context:</strong> Add
                age, sex, location, or symptoms to improve accuracy — all anonymized by default
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 11, color: "var(--text-65)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--text-80)" }}>Clinical Decision Support Tool:</strong>{" "}
                Even with premium trained models, AI cannot replace radiologists under current Indian
                medical device regulations and AI governance frameworks. This platform provides
                evidence-based insights and second opinions to support — not substitute — your clinical
                judgment. The radiologist remains the final decision maker. As regulatory frameworks
                evolve, we will update capabilities in strict compliance with CDSCO, ICMR, and DPDP Act
                guidelines.
              </span>
            </div>
          </div>

          <p
            className="font-body"
            style={{
              fontSize: 11,
              color: "var(--text-55)",
              lineHeight: 1.6,
              fontStyle: "italic",
              borderTop: "1px solid rgba(0,200,180,0.1)",
              paddingTop: 10,
            }}
          >
            This platform will not compromise on data handling. Manthana is fully committed to Indian
            law — truthful, loyal, and transparent in every processing step. This one-time consent
            is required under India&apos;s Digital Personal Data Protection (DPDP) Act 2023 to ensure
            transparent, lawful, and ethical AI usage.
          </p>
        </div>

        {/* Upload Guidelines Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "var(--r-md)",
            padding: "12px 16px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: showDetails ? 16 : 20,
            transition: "all 0.2s ease",
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "var(--text-70)",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 14 }}>📋</span>
            Important Upload Guidelines & Supported Formats
          </span>
          <span style={{ fontSize: 12, color: "var(--text-50)" }}>{showDetails ? "▲" : "▼"}</span>
        </button>

        {/* Expanded Upload Guidelines */}
        {showDetails && (
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "var(--r-lg)",
              padding: "20px 22px",
              marginBottom: 20,
            }}
          >
            {/* Upload Methods */}
            <div style={{ marginBottom: 18 }}>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--gold-300)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 10,
                  fontWeight: 600,
                }}
              >
                📤 Upload Methods Supported
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ fontSize: 11, color: "var(--text-60)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--text-75)" }}>Direct Camera Capture:</strong> Use
                  device camera for instant X-ray, ECG, oral cancer, dermatology imaging
                </div>
                <div style={{ fontSize: 11, color: "var(--text-60)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--text-75)" }}>Gallery/File Upload:</strong> Select
                  from device or drag-and-drop files directly
                </div>
                <div style={{ fontSize: 11, color: "var(--text-60)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--text-75)" }}>PACS Integration:</strong> Direct
                  DICOM study retrieval from hospital PACS (Orthanc)
                </div>
                <div style={{ fontSize: 11, color: "var(--text-60)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--text-75)" }}>Multi-Modal Batch:</strong> Analyze
                  up to 4 modalities simultaneously in one workflow
                </div>
              </div>
            </div>

            {/* Modality Guidelines */}
            <div style={{ marginBottom: 18 }}>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--gold-300)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 10,
                  fontWeight: 600,
                }}
              >
                🩻 Modality-Specific Quality Guidelines
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    padding: "10px 12px",
                    borderRadius: 6,
                    borderLeft: "2px solid var(--scan-400)",
                  }}
                >
                  <p style={{ fontSize: 10, color: "var(--text-70)", fontWeight: 600, marginBottom: 4 }}>
                    📱 X-Ray, Oral Cancer, ECG, Dermatology
                  </p>
                  <p style={{ fontSize: 10, color: "var(--text-55)", lineHeight: 1.5 }}>
                    <strong>Recommended:</strong> Direct camera capture or high-quality gallery upload{" "}
                    | <strong>Formats:</strong> JPG, PNG, WebP | <strong>Tips:</strong> Ensure good
                    lighting, avoid shadows, capture full frame, flat surface for ECG strips
                  </p>
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    padding: "10px 12px",
                    borderRadius: 6,
                    borderLeft: "2px solid var(--scan-400)",
                  }}
                >
                  <p style={{ fontSize: 10, color: "var(--text-70)", fontWeight: 600, marginBottom: 4 }}>
                    🔬 CT Scans (Abdomen, Chest, Cardiac, Spine, Brain)
                  </p>
                  <p style={{ fontSize: 10, color: "var(--text-55)", lineHeight: 1.5, marginBottom: 6 }}>
                    <strong>Best:</strong> Full DICOM series (.dcm) or ZIP archive of DICOM folder{" "}
                    | <strong>Also accepts:</strong> Individual JPG/PNG slices (not preferred)
                  </p>
                  <div style={{ fontSize: 10, color: "var(--text-50)", lineHeight: 1.4 }}>
                    <span style={{ color: "var(--danger-300)" }}>●</span> &lt;30 slices: Basic
                    analysis only |{" "}
                    <span style={{ color: "var(--warning-300)" }}>●</span> 30-79: Fast tier
                    (reduced accuracy) |{" "}
                    <span style={{ color: "var(--success-300)" }}>●</span> 80-300: Full 3D
                    TotalSegmentator ✓ <strong>Recommended</strong> |{" "}
                    <span style={{ color: "var(--scan-400)" }}>●</span> 300+: Complete volumetric
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    padding: "10px 12px",
                    borderRadius: 6,
                    borderLeft: "2px solid var(--scan-400)",
                  }}
                >
                  <p style={{ fontSize: 10, color: "var(--text-70)", fontWeight: 600, marginBottom: 4 }}>
                    🧠 MRI (Brain, Spine)
                  </p>
                  <p style={{ fontSize: 10, color: "var(--text-55)", lineHeight: 1.5 }}>
                    <strong>Best:</strong> DICOM or NIfTI (.nii, .nii.gz) |{" "}
                    <strong>Recommended:</strong> 80+ slices for brain MRI full coverage |{" "}
                    <strong>Formats:</strong> DICOM, NIfTI, JPG, PNG
                  </p>
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    padding: "10px 12px",
                    borderRadius: 6,
                    borderLeft: "2px solid var(--scan-400)",
                  }}
                >
                  <p style={{ fontSize: 10, color: "var(--text-70)", fontWeight: 600, marginBottom: 4 }}>
                    📡 Ultrasound
                  </p>
                  <p style={{ fontSize: 10, color: "var(--text-55)", lineHeight: 1.5 }}>
                    <strong>Video (preferred):</strong> MP4 format for dynamic studies |{" "}
                    <strong>Images:</strong> Still frame JPG/PNG for specific views |{" "}
                    <strong>Modes:</strong> B-mode, M-mode, Doppler supported
                  </p>
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    padding: "10px 12px",
                    borderRadius: 6,
                    borderLeft: "2px solid var(--scan-400)",
                  }}
                >
                  <p style={{ fontSize: 10, color: "var(--text-70)", fontWeight: 600, marginBottom: 4 }}>
                    🧪 Pathology, Cytology, Lab Reports, ECG
                  </p>
                  <p style={{ fontSize: 10, color: "var(--text-55)", lineHeight: 1.5 }}>
                    <strong>Pathology:</strong> SVS (whole slide), JPG/PNG (smears) |{" "}
                    <strong>Lab Reports:</strong> PDF, TXT, CSV, TSV |{" "}
                    <strong>ECG:</strong> Photo of strip (all 12 leads visible) or CSV/EDF digital
                  </p>
                </div>
              </div>
            </div>

            {/* File Format Reference */}
            <div>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--gold-300)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 8,
                  fontWeight: 600,
                }}
              >
                📁 Accepted File Formats Reference
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "6px 16px",
                  fontSize: 10,
                  color: "var(--text-55)",
                }}
              >
                <span>
                  <strong style={{ color: "var(--text-70)" }}>DICOM:</strong> .dcm, .dic
                </span>
                <span>
                  <strong style={{ color: "var(--text-70)" }}>Images:</strong> .jpg, .png, .webp
                </span>
                <span>
                  <strong style={{ color: "var(--text-70)" }}>Neuro:</strong> .nii, .nii.gz
                </span>
                <span>
                  <strong style={{ color: "var(--text-70)" }}>Video:</strong> .mp4 (USG)
                </span>
                <span>
                  <strong style={{ color: "var(--text-70)" }}>Archive:</strong> .zip (DICOM)
                </span>
                <span>
                  <strong style={{ color: "var(--text-70)" }}>Pathology:</strong> .svs
                </span>
                <span>
                  <strong style={{ color: "var(--text-70)" }}>ECG:</strong> .csv, .edf
                </span>
                <span>
                  <strong style={{ color: "var(--text-70)" }}>Lab:</strong> .pdf, .txt, .csv
                </span>
                <span>
                  <strong style={{ color: "var(--text-70)" }}>Data:</strong> .tsv
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Patient ID Input */}
        <div style={{ marginBottom: 16 }}>
          <label
            className="text-caption"
            style={{
              fontSize: 11,
              color: "var(--text-60)",
              display: "block",
              marginBottom: 6,
              fontWeight: 500,
            }}
          >
            Patient ID (optional — leave blank for anonymous processing)
          </label>
          <input
            type="text"
            placeholder="e.g. HOSP-123456"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(10,10,10,0.6)",
              color: "var(--text-80)",
              fontSize: 12,
              fontFamily: "var(--font-body)",
              transition: "border-color 0.2s ease",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(0,200,180,0.4)")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
          />
          <p style={{ fontSize: 10, color: "var(--text-45)", marginTop: 6, lineHeight: 1.4 }}>
            Any identifier provided will be automatically anonymized by the system. Default is
            ANONYMOUS.
          </p>
        </div>

        {/* Consent Checkbox */}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            fontSize: 12,
            color: "var(--text-70)",
            marginBottom: 16,
            cursor: "pointer",
            padding: "14px 16px",
            background: accepted ? "rgba(0,200,180,0.08)" : "rgba(255,255,255,0.03)",
            border: accepted ? "1px solid rgba(0,200,180,0.3)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: "var(--r-md)",
            transition: "all 0.2s ease",
          }}
        >
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            style={{
              marginTop: 2,
              width: 16,
              height: 16,
              accentColor: "var(--scan-400)",
            }}
          />
          <span style={{ lineHeight: 1.5 }}>
            I confirm that <strong style={{ color: "var(--text-85)" }}>valid consent</strong> has been
            obtained from the patient (or authorised representative) for processing their medical
            data using this AI system, in full compliance with the Digital Personal Data Protection
            (DPDP) Act 2023 and my institution&apos;s policies. I understand that all AI findings are
            advisory and require radiologist confirmation before any clinical decisions.
          </span>
        </label>

        {error && (
          <p
            className="text-caption"
            style={{
              fontSize: 11,
              color: "var(--danger-300)",
              marginBottom: 12,
              padding: "10px 12px",
              background: "rgba(255,100,100,0.1)",
              borderRadius: 6,
            }}
          >
            ⚠ {error}
          </p>
        )}

        {/* Action Button */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <button
            type="button"
            disabled={!accepted || submitting}
            onClick={handleAccept}
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.05em",
              padding: "12px 32px",
              borderRadius: "var(--r-lg)",
              border: "none",
              background: accepted
                ? "linear-gradient(135deg, rgba(0,200,180,0.9) 0%, rgba(0,160,140,0.9) 100%)"
                : "rgba(255,255,255,0.1)",
              color: accepted ? "rgba(0,0,0,0.9)" : "var(--text-40)",
              opacity: !accepted || submitting ? 0.5 : 1,
              cursor: !accepted || submitting ? "not-allowed" : "pointer",
              boxShadow: accepted ? "0 4px 20px rgba(0,200,180,0.3)" : "none",
              transition: "all 0.3s ease",
            }}
          >
            {submitting ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(0,0,0,0.3)",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Recording consent…
              </span>
            ) : (
              "ENTER MANTHANA LABS PLATFORM →"
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
