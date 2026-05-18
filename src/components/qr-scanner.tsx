import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

type Props = {
  onResult: (text: string) => void;
  onClose?: () => void;
};

export function QrScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const stopRef = useRef<(() => void) | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    BrowserMultiFormatReader.listVideoInputDevices()
      .then((d) => {
        setDevices(d);
        const back = d.find((x) => /back|rear|environment/i.test(x.label));
        setDeviceId((back ?? d[0])?.deviceId);
      })
      .catch(() => setError("Tidak dapat mengakses kamera"));
  }, []);

  useEffect(() => {
    if (!deviceId || !videoRef.current) return;
    const reader = new BrowserMultiFormatReader();
    let stopped = false;
    reader
      .decodeFromVideoDevice(deviceId, videoRef.current, (result) => {
        if (result && !firedRef.current) {
          firedRef.current = true;
          onResult(result.getText());
        }
      })
      .then((controls) => {
        if (stopped) controls.stop();
        else stopRef.current = () => controls.stop();
      })
      .catch((e) => setError(e?.message ?? "Gagal memulai kamera"));
    return () => {
      stopped = true;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [deviceId, onResult]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border bg-black">
        <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary/70" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        {devices.length > 1 && (
          <select
            className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
            value={deviceId}
            onChange={(e) => {
              firedRef.current = false;
              setDeviceId(e.target.value);
            }}
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Kamera ${d.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        )}
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
