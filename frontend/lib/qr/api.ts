import { api } from "@/lib/api";
import type { QRIdentity, QRScanResult, QRCodeImage, QRScanLog } from "@/lib/types";

export async function mintQRIdentity(params: {
  subject_type: string;
  subject_id: string;
  tier?: "public" | "org" | "admin";
  metadata?: Record<string, unknown>;
}): Promise<QRIdentity> {
  return api.post<QRIdentity>("/api/v1/qr/mint", params);
}

export async function resolveQRCode(code: string): Promise<QRIdentity> {
  return api.get<QRIdentity>(`/api/v1/qr/${code}`);
}

export async function scanQRCode(code: string): Promise<QRScanResult> {
  return api.post<QRScanResult>(`/api/v1/qr/${code}/scan`);
}

export async function getQRImage(code: string, baseUrl?: string): Promise<QRCodeImage> {
  const params = baseUrl ? `?base_url=${encodeURIComponent(baseUrl)}` : "";
  return api.get<QRCodeImage>(`/api/v1/qr/${code}/image${params}`);
}

export async function revokeQRCode(code: string): Promise<{ status: string; code: string }> {
  return api.delete(`/api/v1/qr/${code}`);
}

export async function listEntityQRCodes(
  subjectType: string,
  subjectId: string,
): Promise<QRIdentity[]> {
  return api.get<QRIdentity[]>(`/api/v1/qr/entity/${subjectType}/${subjectId}`);
}

export async function getQRScanLog(code: string): Promise<QRScanLog[]> {
  return api.get<QRScanLog[]>(`/api/v1/qr/${code}/scans`);
}

export async function getQRLineage(
  code: string,
  tier: "public" | "org" | "admin" = "public",
): Promise<Record<string, unknown>> {
  return api.get(`/api/v1/qr/${code}/lineage?tier=${tier}`);
}
