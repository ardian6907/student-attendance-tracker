import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarCheck, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ensureBootstrapAdmin } from "@/lib/admin.functions";

type Mode = "login" | "signup";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nama, setNama] = useState("");
  const [nim, setNim] = useState("");
  const [busy, setBusy] = useState(false);
  const bootstrap = useServerFn(ensureBootstrapAdmin);

  useEffect(() => {
    bootstrap().catch(() => {});
  }, [bootstrap]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim();
    if (normalizedEmail !== normalizedEmail.toLowerCase()) {
      toast.error("Email harus ditulis dengan huruf kecil semua");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        toast.success("Berhasil masuk");
      } else {
        if (!nama.trim()) throw new Error("Nama wajib diisi");
        if (password.length < 6) throw new Error("Password minimal 6 karakter");
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              nama: nama.trim(),
              username: normalizedEmail.split("@")[0],
              nim: nim.trim() || undefined,
            },
          },
        });
        if (error) throw error;
        toast.success("Akun berhasil dibuat. Menunggu admin menetapkan peran Anda.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-subtle)] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-primary-foreground"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
          >
            <CalendarCheck className="h-6 w-6" />
          </div>
          <CardTitle>AbsenKelas</CardTitle>
          <CardDescription>
            {mode === "login" ? "Masuk menggunakan email" : "Daftar akun baru"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Nama lengkap</label>
                  <Input value={nama} onChange={(e) => setNama(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    NIM <span className="text-xs text-muted-foreground">(opsional, untuk mahasiswa)</span>
                  </label>
                  <Input value={nim} onChange={(e) => setNim(e.target.value)} />
                </div>
              </>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus={mode === "login"}
                autoComplete="email"
                placeholder="nama@email.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full gap-2" size="lg">
              {mode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {busy ? "Memproses..." : mode === "login" ? "Masuk" : "Daftar"}
            </Button>
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="block w-full pt-1 text-center text-sm text-primary hover:underline"
            >
              {mode === "login"
                ? "Belum punya akun? Daftar di sini"
                : "Sudah punya akun? Masuk"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
