"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { parseQrPayload } from "@/lib/crypto/parse-qr";

function getCameraErrorMessage(error: unknown): string {
  console.error("[Camera Error Details]", {
    name: error instanceof DOMException ? error.name : "Unknown",
    message: error instanceof Error ? error.message : String(error),
    type: typeof error,
  });

  const name = error instanceof DOMException ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera permission was denied or already blocked. Tap the lock/info icon in Chrome's address bar and change Camera to 'Allow', then try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera found on this device. Make sure your phone has a working camera.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Camera is already in use by another app. Close other apps and try again.";
  }
  if (message.includes("Permission denied")) {
    return "Camera permission blocked by your phone settings. Check Chrome Settings → Permissions → Camera.";
  }
  if (message.includes("HTTPS")) {
    return "Camera access requires HTTPS. Make sure you're using https://www.kokuacounter.app (secure connection).";
  }
  if (error instanceof TypeError) {
    return "Camera feature not available. Try a different browser (Chrome, Safari, Edge) or device.";
  }
  return "Could not start camera. Check settings and try again.";
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
      if (scanner && scanner.isScanning) {
        void scanner.stop()
          .then(() => scanner.clear())
          .catch((error) => {
            console.error("[Camera] Cleanup error:", error);
          });
      }
    };
  }, []);

  async function startScanner() {
    setCameraError(null);
    setScanning(false);
    
    // Check browser support
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera API not available. Try Chrome, Safari, or Edge on a device with a camera.");
      setStarting(false);
      return;
    }

    setStarting(true);
    
    try {
      // First stop any existing scanner to release camera
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scannerRef.current = null;
        // Small delay to let OS fully release the camera
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      
      // Load QR code scanner library
      const { Html5Qrcode } = await import("html5-qrcode");
      
      const cameras = await Html5Qrcode.getCameras();
      
      if (!cameras || cameras.length === 0) {
        throw new DOMException("No camera found on this device.", "NotFoundError");
      }


      // Prefer rear/environment camera for phone usage
      const camera = cameras.find((device) => /back|rear|environment/i.test(device.label)) ?? cameras[0];

      // Create new scanner instance
      const scanner = new Html5Qrcode("eatery-qr-reader");
      scannerRef.current = scanner;
      
      
      // Start scanner - this will trigger the permission popup if needed
      await scanner.start(
        camera.id,
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.777,
        },
        async (decodedText) => {
          if (processingRef.current) return;
          processingRef.current = true;
          setScanning(false);
          
          try {
            await scanner.stop();
          } catch (error) {
            console.warn("[QR] Error stopping scanner:", error);
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
          } catch (error) {
            console.error("[QR Redeem Error]", error);
            router.replace("/eatery/confirmation?result=unavailable");
          }
        },
        () => undefined, // No error callback - handle errors via catch
      );
      
      setScanning(true);
      setStarting(false);
    } catch (error) {
      console.error("[Camera ERROR - Full Details]", {
        errorName: error instanceof DOMException ? error.name : "Unknown",
        errorMessage: error instanceof Error ? error.message : String(error),
        errorType: typeof error,
        errorStack: error instanceof Error ? error.stack : "No stack",
      });
      
      // Clean up failed scanner
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch {
          // Ignore cleanup errors
        }
        scannerRef.current = null;
      }
      
      setStarting(false);
      setCameraError(getCameraErrorMessage(error));
    }
  }

  return (
    <div className="space-y-4">
      <div id="eatery-qr-reader" role="region" className="min-h-[60vh] w-full overflow-hidden rounded-xl border bg-black shadow-soft" aria-label="Meal pass camera scanner" />

      {cameraError ? (
        <Alert variant="destructive" className="space-y-3">
          <p className="font-semibold">{cameraError}</p>
          <div className="space-y-1 text-xs text-foreground/80">
            <p className="font-semibold">Troubleshooting</p>
            <ul className="list-inside list-disc space-y-1">
              <li>On your phone: tap the lock icon in Chrome&apos;s address bar, then Camera, and choose &quot;Allow&quot;</li>
              <li>Refresh this page and try again</li>
              <li>If you still see errors, close Chrome completely and reopen it</li>
            </ul>
          </div>
        </Alert>
      ) : null}

      {!scanning ? (
        <Button
          type="button"
          size="lg"
          variant={cameraError ? "accent" : "default"}
          className="w-full"
          disabled={starting}
          onClick={() => {
            setCameraError(null);
            void startScanner();
          }}
        >
          {starting ? "Waiting for permission…" : cameraError ? "Try again" : "Enable camera"}
        </Button>
      ) : (
        <Alert variant="success">
          <p className="font-semibold">✓ Camera is active and scanning</p>
          <p className="text-xs text-muted-foreground">Point the phone at the student&apos;s QR code.</p>
        </Alert>
      )}

      {!scanning && !starting && !cameraError ? (
        <p className="text-sm text-muted-foreground">
          Center the student&apos;s QR code in the camera frame. Scanned content is used only to verify the pass.
        </p>
      ) : null}
    </div>
  );
}
