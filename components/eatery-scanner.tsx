"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseQrPayload } from "@/lib/crypto/parse-qr";
import { Button } from "@/components/ui/button";

export function EateryScanner() {
  const router = useRouter();
  const processingRef = useRef(false);
  const [scanning, setScanning] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanning) return;
    let disposed = false;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (disposed) return;
        scanner = new Html5Qrcode("eatery-qr-reader");
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            if (processingRef.current) return;
            processingRef.current = true;
            setScanning(false);
            try {
              await scanner?.stop();
            } catch {
              // The scanner may already have stopped during teardown.
            }
            const token = parseQrPayload(decodedText);
            if (!token) {
              router.replace("/eatery/confirmation?result=invalid");
              return;
            }
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
      } catch {
        if (!disposed) setCameraError("Camera access is unavailable. Allow camera access and try again.");
      }
    }

    void startScanner();
    return () => {
      disposed = true;
      const activeScanner = scanner;
      if (activeScanner?.isScanning) {
        void activeScanner.stop().then(() => activeScanner.clear()).catch(() => undefined);
      }
    };
  }, [router, scanning]);

  function restart() {
    processingRef.current = false;
    setCameraError(null);
    setScanning(true);
  }

  return (
    <div className="space-y-4">
      <div id="eatery-qr-reader" className="min-h-64 overflow-hidden rounded-md border bg-black" aria-label="Meal pass camera scanner" />
      {cameraError ? <p className="text-sm text-destructive" role="alert">{cameraError}</p> : null}
      {!scanning ? <Button variant="outline" onClick={restart}>Scan another pass</Button> : null}
      <p className="text-sm text-muted-foreground">Center the student’s QR code in the camera frame. Scanned content is used only to verify the pass.</p>
    </div>
  );
}