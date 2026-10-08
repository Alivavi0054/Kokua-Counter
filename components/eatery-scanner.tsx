"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseQrPayload } from "@/lib/crypto/parse-qr";
import { Button } from "@/components/ui/button";

function getCameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera permission was denied. Allow camera access for this site in your browser settings, then try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found on this device.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera is already in use by another app. Close it and try again.";
  }
  return "Could not start the camera. Check browser permissions and try again.";
}

export function EateryScanner() {
  const router = useRouter();
  const processingRef = useRef(false);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner?.isScanning) {
        void scanner.stop().then(() => scanner.clear()).catch(() => undefined);
      }
    };
  }, []);

  async function startScanner() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not support camera access. Use a newer browser or Chrome/Safari on a phone.");
      return;
    }

    if (!window.isSecureContext) {
      setCameraError("Camera access requires HTTPS. Use https://www.kokuacounter.app on a phone, or http://localhost:3000 on your computer. Localhost on a phone requires HTTPS.");
      return;
    }

    setStarting(true);
    let permissionStream: MediaStream | null = null;
    try {
      permissionStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      const { Html5Qrcode } = await import("html5-qrcode");
      const cameras = await Html5Qrcode.getCameras();
      const camera = cameras.find((device) => /back|rear|environment/i.test(device.label)) ?? cameras[0];
      if (!camera) throw new DOMException("No camera found.", "NotFoundError");

      permissionStream.getTracks().forEach((track) => track.stop());
      permissionStream = null;

      const scanner = new Html5Qrcode("eatery-qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        camera.id,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (processingRef.current) return;
          processingRef.current = true;
          setScanning(false);
          try {
            await scanner.stop();
          } catch {
            // The scanner may already have stopped during teardown.
          }
          const token = parseQrPayload(decodedText) ?? decodedText;
          try {
            const response = await fetch("/api/qr/redeem", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });
            const payload = (await response.json()) as {
              redemption_id?: string;
              error_code?: string;
            };
            if (response.ok && payload.redemption_id) {
              router.replace(`/eatery/confirmation?redemption_id=${encodeURIComponent(payload.redemption_id)}`);
            } else {
              const safeCode = ["invalid", "already_used", "expired", "unavailable", "eatery_limit", "try_later"].includes(payload.error_code ?? "")
                ? payload.error_code
                : "unavailable";
              router.replace(`/eatery/confirmation?result=${safeCode}`);
            }
          } catch {
            router.replace("/eatery/confirmation?result=unavailable");
          }
        },
        () => undefined,
      );
      setScanning(true);
    } catch (error) {
      setCameraError(getCameraErrorMessage(error));
    } finally {
      permissionStream?.getTracks().forEach((track) => track.stop());
      setStarting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div id="eatery-qr-reader" className="min-h-[65vh] w-full overflow-hidden rounded-md border bg-black" aria-label="Meal pass camera scanner" />
      {cameraError ? <p className="text-sm text-destructive font-medium" role="alert">{cameraError}</p> : null}
      {!scanning ? (
        <Button size="lg" variant={starting ? "secondary" : cameraError ? "destructive" : "default"} onClick={() => void startScanner()} disabled={starting}>
          {starting ? "Allow camera access in the popup above…" : cameraError ? "Retry camera" : "Enable camera"}
        </Button>
      ) : null}
      {starting && <p className="text-xs text-muted-foreground">A browser popup is asking for camera permission. Tap "Allow" to continue.</p>}
      {scanning && <p className="text-xs text-green-700">✓ Camera is active. Center the QR code in the frame.</p>}
      {!scanning && !starting && <p className="text-sm text-muted-foreground">Center the student's QR code in the camera frame. Scanned content is used only to verify the pass.</p>}
    </div>
  );
}