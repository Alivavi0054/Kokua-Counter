"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseQrPayload } from "@/lib/crypto/parse-qr";
import { Button } from "@/components/ui/button";

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
      if (scanner?.isScanning) {
        void scanner.stop().then(() => scanner.clear()).catch(() => undefined);
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
    let permissionStream: MediaStream | null = null;
    
    try {
      console.log("[Camera] 1. Checking HTTPS context...", { 
        isSecure: window.isSecureContext,
        protocol: window.location.protocol,
        hostname: window.location.hostname 
      });
      
      console.log("[Camera] 2. Requesting camera access (browser will ask for permission)...");
      
      // This line should trigger the permission popup on mobile
      permissionStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      console.log("[Camera] 3. Permission granted! Got access to tracks:", permissionStream.getTracks().length);

      // Load QR code scanner library
      const { Html5Qrcode } = await import("html5-qrcode");
      const cameras = await Html5Qrcode.getCameras();
      
      if (!cameras || cameras.length === 0) {
        throw new DOMException("No camera found on this device.", "NotFoundError");
      }

      console.log("[Camera] 4. Found", cameras.length, "camera(s):", cameras.map(c => c.label).join(", "));

      // Prefer rear/environment camera for phone usage
      const camera = cameras.find((device) => /back|rear|environment/i.test(device.label)) ?? cameras[0];

      // Stop the permission check stream before starting the real scanner
      permissionStream.getTracks().forEach((track) => {
        track.stop();
        console.log("[Camera] 5. Stopped permission check track:", track.kind);
      });
      permissionStream = null;

      // Initialize scanner
      const scanner = new Html5Qrcode("eatery-qr-reader");
      scannerRef.current = scanner;
      
      console.log("[Camera] 6. Starting QR scanner with camera:", camera.label);
      
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
            // Scanner already stopped
          }
          
          const token = parseQrPayload(decodedText) ?? decodedText;
          console.log("[QR] Decoded token, submitting to redeem endpoint...");
          
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
        () => undefined,
      );
      
      console.log("[Camera] 7. Scanner started successfully!");
      setScanning(true);
      setStarting(false);
    } catch (error) {
      console.error("[Camera ERROR - Full Details]", {
        errorName: error instanceof DOMException ? error.name : "Unknown",
        errorMessage: error instanceof Error ? error.message : String(error),
        errorType: typeof error,
        errorStack: error instanceof Error ? error.stack : "No stack",
      });
      
      setStarting(false);
      setCameraError(getCameraErrorMessage(error));
    } finally {
      permissionStream?.getTracks().forEach((track) => {
        track.stop();
      });
    }
  }

  return (
    <div className="space-y-4">
      <div id="eatery-qr-reader" className="min-h-[65vh] w-full overflow-hidden rounded-md border bg-black" aria-label="Meal pass camera scanner" />
      
      {cameraError && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <p className="text-sm font-medium text-red-900" role="alert">
            {cameraError}
          </p>
          <div className="text-xs text-red-700 mt-3 space-y-2">
            <p><strong>Troubleshooting:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>On your phone: Look for Chrome's address bar lock icon (🔒) → Camera → change to "Allow"</li>
              <li>Then refresh this page and try again</li>
              <li>If you still see errors, close Chrome completely and reopen it</li>
            </ul>
          </div>
        </div>
      )}
      
      {!scanning && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setCameraError(null);
              void startScanner();
            }}
            disabled={starting}
            className={`flex-1 h-12 rounded-md font-medium transition-colors ${
              starting
                ? "bg-blue-200 text-blue-900 cursor-wait"
                : cameraError
                  ? "bg-orange-600 hover:bg-orange-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {starting ? "Waiting for permission…" : cameraError ? "Try Again" : "Enable Camera"}
          </button>
        </div>
      )}
      
      {scanning && (
        <div className="rounded-md bg-green-50 p-3 border border-green-200">
          <p className="text-sm font-medium text-green-900">✓ Camera is active and scanning</p>
          <p className="text-xs text-green-700">Point the phone at the student's QR code.</p>
        </div>
      )}
      
      {!scanning && !starting && !cameraError && (
        <p className="text-sm text-muted-foreground">
          Center the student's QR code in the camera frame. Scanned content is used only to verify the pass.
        </p>
      )}
    </div>
  );
}