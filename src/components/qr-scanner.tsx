import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Button } from "@/components/ui/button";
import { Camera, X, RotateCcw } from "lucide-react";

type Props = {
  onResult: (text: string) => void;
  onClose?: () => void;
};

type Facing = "environment" | "user";

export function QrScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const firedRef = useRef(false);
  const [facing, setFacing] = useState<Facing>("environment");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    firedRef.current = false;
    setError(null);
    setStarting(true);

    // 1) Request camera permission with a preferred facing mode.
    //    This is the reliable path on mobile browsers (especially iOS Safari).
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: { facingMode: { ideal: facing } },
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Browser tidak mendukung akses kamera. Coba buka via HTTPS / Chrome / Safari.");
        setStarting(false);
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        // fall back: any camera
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (err) {
          setError(
            err instanceof Error
              ? `Tidak dapat mengakses kamera: ${err.message}. Izinkan kamera di pengaturan browser.`
              : "Tidak dapat mengakses kamera",
          );
          setStarting(false);
          return;
        }
      }

      if (cancelled || !videoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.muted = true;
      try {
        await video.play();
      } catch {
        /* iOS may need user gesture; the Buka Kamera button already provides it */
      }

      // 2) Hand the live stream to ZXing for decoding.
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
      try {
        const controls = await reader.decodeFromStream(stream, video, (result) => {
          if (result && !firedRef.current) {
            firedRef.current = true;
            onResult(result.getText());
          }
        });
        stopRef.current = () => {
          controls.stop();
          stream.getTracks().forEach((t) => t.stop());
        };
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memulai pembaca QR");
        stream.getTracks().forEach((t) => t.stop());
      } finally {
        setStarting(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [facing, onResult]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border bg-black">
        <video
          ref={videoRef}
          className="aspect-square w-full object-cover"
          muted
          playsInline
          autoPlay
        />
        <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary/70" />
        {starting && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/80">
            Memulai kamera...
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          className="flex-1 gap-1"
        >
          <RotateCcw className="h-4 w-4" />
          {facing === "environment" ? "Kamera Depan" : "Kamera Belakang"}
        </Button>
        <Button variant="outline" size="sm" onClick={onClose} className="gap-1">
          <X className="h-4 w-4" /> Tutup
        </Button>
      </div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Camera className="h-3 w-3" /> Arahkan kamera ke QR code dari dosen
      </p>
    </div>
  );
}
