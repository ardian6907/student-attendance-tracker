import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarCheck, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ensureBootstrapAdmin } from "@/lib/admin.functions";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<{ email: string; password: string } | null>(null);
  const bootstrap = useServerFn(ensureBootstrapAdmin);

  useEffect(() => {
    bootstrap()
      .then((r) => {
        if (r.created) setHint({ email: r.email!, password: r.password! });
      })
      .catch(() => {});
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
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;
      toast.success("Berhasil masuk");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal masuk");
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
          <CardDescription>Masuk menggunakan email</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
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
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full gap-2" size="lg">
              <LogIn className="h-4 w-4" /> {busy ? "Memproses..." : "Masuk"}
            </Button>
            {hint ? (
              <div className="rounded-md border bg-muted/40 p-3 text-xs">
                <p className="font-medium">Akun admin baru saja dibuat:</p>
                <p>Email: <span className="font-mono">{hint.email}</span></p>
                <p>Password: <span className="font-mono">{hint.password}</span></p>
                <p className="mt-1 text-muted-foreground">Segera ganti password setelah login.</p>
              </div>
            ) : (
              <p className="pt-2 text-center text-xs text-muted-foreground">
                Admin default: <span className="font-mono">admin@kampus.local</span> /{" "}
                <span className="font-mono">admin123</span>
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
