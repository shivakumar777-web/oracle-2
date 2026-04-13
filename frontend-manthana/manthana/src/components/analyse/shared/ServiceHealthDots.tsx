"use client";
import React, { useState, useEffect, useRef } from "react";
import { GATEWAY_URL } from "@/lib/analyse/constants";

type ServiceStatus = "online" | "offline" | "checking";

interface ServiceDot {
  name: string;
  status: ServiceStatus;
}

const SERVICE_LIST = [
  "Gateway", "X-Ray", "Brain MRI", "Cardiac CT", "Abdominal CT",
  "Spine/Neuro", "Ultrasound", "ECG", "Pathology",
  "Mammography", "Cytology", "Oral Cancer", "Lab Report", "Dermatology",
];

interface Props {
  /** Tablet — slightly smaller than desktop */
  compact?: boolean;
  /** Phone — smallest dots so the strip fits the top bar */
  dense?: boolean;
}

export default function ServiceHealthDots({ compact = false, dense = false }: Props) {
  const [services, setServices] = useState<ServiceDot[]>(
    SERVICE_LIST.map((name) => ({ name, status: "checking" }))
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        // 1. Gateway health
        const gwOk = await fetch(`${GATEWAY_URL}/health`, {
          signal: AbortSignal.timeout(3000),
        })
          .then((r) => r.ok)
          .catch(() => false);

        // 2. Individual service health via /services endpoint
        let serviceStatuses: Record<string, string> = {};
        if (gwOk) {
          try {
            const res = await fetch(`${GATEWAY_URL}/services`, {
              signal: AbortSignal.timeout(8000),
            });
            if (res.ok) {
              const data = await res.json();
              const list = data.services || [];
              for (const s of list) {
                serviceStatuses[s.modality] = s.status;
              }
            }
          } catch {
            // /services endpoint unavailable — fall back to gateway-only
          }
        }

        // Map modality keys to display names
        const modalityMap: Record<string, string> = {
          xray: "X-Ray",
          brain_mri: "Brain MRI",
          cardiac_ct: "Cardiac CT",
          abdominal_ct: "Abdominal CT",
          spine_neuro: "Spine/Neuro",
          ultrasound: "Ultrasound",
          ecg: "ECG",
          pathology: "Pathology",
          mammography: "Mammography",
          cytology: "Cytology",
          oral_cancer: "Oral Cancer",
          lab_report: "Lab Report",
          dermatology: "Dermatology",
        };

        setServices(
          SERVICE_LIST.map((name) => {
            if (name === "Gateway") {
              return { name, status: gwOk ? "online" : "offline" };
            }
            // Find modality key for this display name
            const modalityKey = Object.entries(modalityMap).find(
              ([, v]) => v === name
            )?.[0];
            if (modalityKey && serviceStatuses[modalityKey]) {
              return {
                name,
                status: serviceStatuses[modalityKey] === "online" ? "online" : "offline",
              };
            }
            // If gateway is down, everything is unknown/offline
            return { name, status: gwOk ? "offline" : "offline" };
          })
        );
      } catch {
        // Total failure — mark everything offline
        setServices(SERVICE_LIST.map((name) => ({ name, status: "offline" })));
      }
    };

    checkHealth();
    // Removed 30-second polling interval to prevent serverless billing loop
    // intervalRef.current = setInterval(checkHealth, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const size = dense ? 3 : compact ? 4 : 6;
  const gap = dense ? 2 : compact ? 3 : 5;

  const statusColor = (status: ServiceStatus) => {
    switch (status) {
      case "online":
        return "var(--clear, #30d158)";
      case "offline":
        return "var(--critical, #ff453a)";
      case "checking":
        return "var(--scan-500, #0af)";
    }
  };

  const statusOpacity = (status: ServiceStatus) => {
    switch (status) {
      case "online":
        return 0.85;
      case "offline":
        return 0.6;
      case "checking":
        return 0.4;
    }
  };

  return (
    <div
      className="service-health-dots"
      style={{
        display: "flex",
        alignItems: "center",
        gap,
        flexShrink: 0,
      }}
      title="Backend service status (live)"
    >
      {services.map((svc) => (
        <div
          key={svc.name}
          title={`${svc.name}: ${svc.status}`}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: statusColor(svc.status),
            opacity: statusOpacity(svc.status),
            animation:
              svc.status === "checking"
                ? "dotPulse 2s ease-in-out infinite"
                : undefined,
            transition: "background 0.5s ease, opacity 0.5s ease",
            cursor: "help",
          }}
        />
      ))}
    </div>
  );
}
