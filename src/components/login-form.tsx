import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { CalendarCheck, LogIn } from "lucide-react";
import { toast } from "sonner";

export function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const u = login(username, password);
      toast.success(`Selamat datang, ${u.nama}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal login");
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
          <CardDescription>Masuk untuk melanjutkan</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handle} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
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
            <Button type="submit" className="w-full gap-2" size="lg">
              <LogIn className="h-4 w-4" /> Masuk
            </Button>
            <p className="pt-2 text-center text-xs text-muted-foreground">
              Admin default: <span className="font-mono">admin</span> /{" "}
              <span className="font-mono">admin123</span>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
