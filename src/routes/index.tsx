import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  adminCreateUser,
  adminDeleteUser,
  adminListUsers,
  adminResetPassword,
  adminSetUserRole,
} from "@/lib/admin.functions";
import {
  deleteAttendanceSession,
  setAttendanceSessionClosed,
} from "@/lib/session.functions";
import { LoginForm } from "@/components/login-form";
import { QrScanner } from "@/components/qr-scanner";
import { StatusBadge } from "@/components/status-badge";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CalendarCheck, LogOut, Plus, Trash2, Users, KeyRound, ShieldCheck,
  GraduationCap, QrCode, ScanLine, CheckCircle2, Home, ClipboardList,
  History, BarChart3, FileSpreadsheet, Inbox, Menu, X,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: App });

type Role = "admin" | "dosen" | "mahasiswa";
type Status = "Hadir" | "Izin" | "Sakit" | "Alpa";

const STATUS_LIST: Status[] = ["Hadir", "Izin", "Sakit", "Alpa"];
const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator", dosen: "Dosen", mahasiswa: "Mahasiswa",
};

// ---------- session hook ----------
function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, ready };
}

function useMe(userId: string | undefined) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["me", userId],
    queryFn: async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      const roles = (r ?? []).map((x) => x.role as Role);
      const role: Role | null =
        roles.includes("admin") ? "admin" :
        roles.includes("dosen") ? "dosen" :
        roles.includes("mahasiswa") ? "mahasiswa" : null;
      return { profile: p, role };
    },
  });
}

// ---------- Layout shell with sidebar ----------
type MenuItem = { key: string; label: string; icon: React.ReactNode };

function Shell({
  role, nama, menus, current, setCurrent, children,
}: {
  role: Role; nama: string;
  menus: MenuItem[]; current: string; setCurrent: (k: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-[image:var(--gradient-subtle)]">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r bg-background transition-transform md:relative md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-foreground"
            style={{ background: "var(--gradient-primary)" }}
          >
            <CalendarCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">AbsenKelas</p>
            <p className="truncate text-xs text-muted-foreground leading-tight">{ROLE_LABEL[role]}</p>
          </div>
          <button onClick={() => setOpen(false)} className="ml-auto md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="space-y-0.5 p-2">
          {menus.map((m) => (
            <button
              key={m.key}
              onClick={() => { setCurrent(m.key); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                current === m.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {m.icon}{m.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(true)} className="md:hidden"><Menu className="h-5 w-5" /></button>
            <p className="text-sm font-medium">{nama}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => supabase.auth.signOut()} className="gap-1">
            <LogOut className="h-4 w-4" /> Keluar
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        {icon && <div className="rounded-md bg-primary/10 p-2 text-primary">{icon}</div>}
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- App root ----------
function App() {
  const { user, ready } = useSession();
  const me = useMe(user?.id);

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Memuat...</div>;
  if (!user) return <><LoginForm /><Toaster /></>;
  if (me.isLoading || !me.data) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Memuat profil...</div>;

  const role = me.data.role;
  const nama = me.data.profile?.nama ?? user.email ?? "User";

  if (role === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-subtle)] px-4">
        <Card className="max-w-md text-center">
          <CardHeader>
            <CardTitle>Menunggu persetujuan admin</CardTitle>
            <CardDescription>Akun Anda belum memiliki peran. Hubungi admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>Keluar</Button>
          </CardContent>
        </Card>
        <Toaster />
      </div>
    );
  }

  return (
    <>
      {role === "admin" && <AdminApp nama={nama} currentUserId={user.id} />}
      {role === "dosen" && <DosenApp nama={nama} userId={user.id} />}
      {role === "mahasiswa" && <MahasiswaApp nama={nama} userId={user.id} />}
      <Toaster />
    </>
  );
}

// ==================== ADMIN ====================
function AdminApp({ nama, currentUserId }: { nama: string; currentUserId: string }) {
  const [current, setCurrent] = useState("beranda");
  const menus: MenuItem[] = [
    { key: "beranda", label: "Beranda", icon: <Home className="h-4 w-4" /> },
    { key: "kelola", label: "Kelola Akun", icon: <Users className="h-4 w-4" /> },
    { key: "mhs", label: "Data Mahasiswa", icon: <GraduationCap className="h-4 w-4" /> },
    { key: "dsn", label: "Data Dosen", icon: <ShieldCheck className="h-4 w-4" /> },
    { key: "monitor", label: "Monitoring Absensi", icon: <ClipboardList className="h-4 w-4" /> },
    { key: "riwayat", label: "Riwayat Sesi", icon: <History className="h-4 w-4" /> },
    { key: "rekap", label: "Rekap Absensi", icon: <FileSpreadsheet className="h-4 w-4" /> },
  ];
  return (
    <Shell role="admin" nama={nama} menus={menus} current={current} setCurrent={setCurrent}>
      {current === "beranda" && <AdminBeranda />}
      {current === "kelola" && <AdminKelola currentUserId={currentUserId} />}
      {current === "mhs" && <AdminDataMahasiswa currentUserId={currentUserId} />}
      {current === "dsn" && <AdminDataDosen currentUserId={currentUserId} />}
      {current === "monitor" && <AdminMonitoring />}
      {current === "riwayat" && <AdminRiwayat />}
      {current === "rekap" && <AdminRekap />}
    </Shell>
  );
}

function useAdminUsers() {
  const list = useServerFn(adminListUsers);
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: () => list({}),
  });
}

function useAllSessions() {
  return useQuery({
    queryKey: ["all-sessions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_sessions")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
}

function useAllAttendances() {
  return useQuery({
    queryKey: ["all-att"],
    queryFn: async () => {
      const { data } = await supabase.from("attendances").select("*");
      return data ?? [];
    },
  });
}

function AdminBeranda() {
  const users = useAdminUsers();
  const sessions = useAllSessions();
  const atts = useAllAttendances();
  const u = users.data ?? [];
  const totalMhs = u.filter((x) => x.role === "mahasiswa").length;
  const totalDsn = u.filter((x) => x.role === "dosen").length;
  const totalSesi = sessions.data?.length ?? 0;
  const sesiAktif = sessions.data?.filter((s) => !s.closed).length ?? 0;
  const today = new Date().toDateString();
  const todayAtts = (atts.data ?? []).filter((a) => new Date(a.created_at).toDateString() === today);
  const hadirToday = todayAtts.filter((a) => a.status === "Hadir").length;
  const izinSakitToday = todayAtts.filter((a) => a.status === "Izin" || a.status === "Sakit").length;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Beranda Admin</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Mahasiswa" value={totalMhs} icon={<GraduationCap className="h-5 w-5" />} />
        <StatCard label="Total Dosen" value={totalDsn} icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Total Sesi" value={totalSesi} icon={<CalendarCheck className="h-5 w-5" />} />
        <StatCard label="Sesi Aktif" value={sesiAktif} icon={<QrCode className="h-5 w-5" />} />
        <StatCard label="Hadir Hari Ini" value={hadirToday} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Izin/Sakit Hari Ini" value={izinSakitToday} icon={<Inbox className="h-5 w-5" />} />
      </div>
    </div>
  );
}

function AdminKelola({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const users = useAdminUsers();
  const del = useServerFn(adminDeleteUser);
  const reset = useServerFn(adminResetPassword);
  const setRole = useServerFn(adminSetUserRole);
  const create = useServerFn(adminCreateUser);

  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({ nama: "", email: "", password: "", role: "mahasiswa" as "mahasiswa" | "dosen", nim: "" });
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);

  const onChanged = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const handleCreate = async () => {
    setBusy(true);
    try {
      await create({
        data: {
          nama: form.nama.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          nim: form.role === "mahasiswa" ? form.nim.trim() || null : null,
        },
      });
      toast.success("Akun dibuat");
      setOpenCreate(false);
      setForm({ nama: "", email: "", password: "", role: "mahasiswa", nim: "" });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally { setBusy(false); }
  };

  const handleReset = async () => {
    if (!resetFor) return;
    setBusy(true);
    try {
      await reset({ data: { userId: resetFor, password: newPw } });
      toast.success("Password direset");
      setResetFor(null); setNewPw("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal"); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus akun ini?")) return;
    try { await del({ data: { userId: id } }); toast.success("Dihapus"); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal"); }
  };

  const handleRoleChange = async (id: string, value: string) => {
    const role = value === "none" ? null : (value as "mahasiswa" | "dosen");
    try { await setRole({ data: { userId: id, role } }); toast.success("Peran diperbarui"); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal"); }
  };

  const all = (users.data ?? []).filter((u) => u.role !== "admin");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Kelola Akun</h1>
        <Button onClick={() => setOpenCreate(true)} className="gap-1"><Plus className="h-4 w-4" />Tambah Akun</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Nama</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Aksi</th></tr>
              </thead>
              <tbody className="divide-y">
                {all.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Belum ada akun.</td></tr>}
                {all.map((u) => (
                  <tr key={u.id}>
                    <td className="p-3">
                      <p className="font-medium">{u.nama}</p>
                      {u.nim && <p className="text-xs text-muted-foreground">NIM {u.nim}</p>}
                    </td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3">
                      <Select value={u.role ?? "none"} onValueChange={(v) => handleRoleChange(u.id, v)}>
                        <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Belum diatur</SelectItem>
                          <SelectItem value="mahasiswa">Mahasiswa</SelectItem>
                          <SelectItem value="dosen">Dosen</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => { setResetFor(u.id); setNewPw(""); }}>
                          <KeyRound className="h-3.5 w-3.5" />Reset
                        </Button>
                        {u.id !== currentUserId && (
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(u.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tambah Akun */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Akun</DialogTitle>
            <DialogDescription>Buat akun mahasiswa atau dosen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm">Nama lengkap</label>
              <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm">Email</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@email.com" />
            </div>
            <div>
              <label className="mb-1 block text-sm">Password awal</label>
              <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 6 karakter" />
            </div>
            <div>
              <label className="mb-1 block text-sm">Peran</label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "mahasiswa" | "dosen" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mahasiswa">Mahasiswa</SelectItem>
                  <SelectItem value="dosen">Dosen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "mahasiswa" && (
              <div>
                <label className="mb-1 block text-sm">NIM</label>
                <Input value={form.nim} onChange={(e) => setForm({ ...form, nim: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={busy || !form.nama || !form.email || form.password.length < 6}>Buat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <Input type="password" placeholder="Password baru (min 6)" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <DialogFooter><Button disabled={busy || newPw.length < 6} onClick={handleReset}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminDataMahasiswa({ currentUserId }: { currentUserId: string }) {
  const users = useAdminUsers();
  const atts = useAllAttendances();
  const [viewMhs, setViewMhs] = useState<string | null>(null);
  const list = (users.data ?? []).filter((u) => u.role === "mahasiswa");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Data Mahasiswa</h1>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Nama</th><th className="p-3">NIM</th><th className="p-3">Email</th><th className="p-3">Status</th><th className="p-3">Aksi</th></tr>
              </thead>
              <tbody className="divide-y">
                {list.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Belum ada mahasiswa.</td></tr>}
                {list.map((u) => (
                  <tr key={u.id}>
                    <td className="p-3 font-medium">{u.nama}</td>
                    <td className="p-3">{u.nim ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3"><span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Aktif</span></td>
                    <td className="p-3">
                      <Button size="sm" variant="outline" onClick={() => setViewMhs(u.id)}>Lihat Riwayat</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!viewMhs} onOpenChange={(o) => !o && setViewMhs(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Riwayat Absensi Mahasiswa</DialogTitle></DialogHeader>
          {viewMhs && <RiwayatMahasiswa studentId={viewMhs} />}
        </DialogContent>
      </Dialog>
      {/* prevent unused warn */}
      <input type="hidden" value={currentUserId} readOnly />
      <input type="hidden" value={atts.isLoading ? "1" : "0"} readOnly />
    </div>
  );
}

function RiwayatMahasiswa({ studentId }: { studentId: string }) {
  const q = useQuery({
    queryKey: ["riwayat-mhs", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendances")
        .select("*, attendance_sessions(judul, created_at)")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <div className="max-h-96 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">Sesi</th><th className="p-2">Tanggal</th><th className="p-2">Status</th></tr></thead>
        <tbody className="divide-y">
          {(q.data ?? []).map((a: any) => (
            <tr key={a.id}>
              <td className="p-2">{a.attendance_sessions?.judul ?? "—"}</td>
              <td className="p-2 text-muted-foreground">{new Date(a.created_at).toLocaleString("id-ID")}</td>
              <td className="p-2"><StatusBadge status={a.status as Status} /></td>
            </tr>
          ))}
          {(q.data ?? []).length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Belum ada absensi.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AdminDataDosen({ currentUserId }: { currentUserId: string }) {
  const users = useAdminUsers();
  const sessions = useAllSessions();
  const [viewDsn, setViewDsn] = useState<string | null>(null);
  const list = (users.data ?? []).filter((u) => u.role === "dosen");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Data Dosen</h1>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Nama</th><th className="p-3">Email</th><th className="p-3">Jumlah Sesi</th><th className="p-3">Status</th><th className="p-3">Aksi</th></tr>
              </thead>
              <tbody className="divide-y">
                {list.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Belum ada dosen.</td></tr>}
                {list.map((u) => (
                  <tr key={u.id}>
                    <td className="p-3 font-medium">{u.nama}</td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3">{u.sessionsCount}</td>
                    <td className="p-3"><span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Aktif</span></td>
                    <td className="p-3"><Button size="sm" variant="outline" onClick={() => setViewDsn(u.id)}>Lihat Sesi</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!viewDsn} onOpenChange={(o) => !o && setViewDsn(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Sesi yang dibuat</DialogTitle></DialogHeader>
          {viewDsn && (
            <div className="max-h-96 overflow-y-auto divide-y rounded border">
              {(sessions.data ?? []).filter((s) => s.created_by === viewDsn).map((s) => (
                <div key={s.id} className="p-3 text-sm">
                  <p className="font-medium">{s.judul}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleString("id-ID")} · {s.closed ? "Ditutup" : "Aktif"} · Kode {s.kode}
                  </p>
                </div>
              ))}
              {(sessions.data ?? []).filter((s) => s.created_by === viewDsn).length === 0 && (
                <p className="p-4 text-center text-muted-foreground">Belum ada sesi.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <input type="hidden" value={currentUserId} readOnly />
    </div>
  );
}

function useSessionStats() {
  const sessions = useAllSessions();
  const atts = useAllAttendances();
  const users = useAdminUsers();
  const dosenMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users.data ?? []) m.set(u.id, u.nama);
    return m;
  }, [users.data]);
  const stats = useMemo(() => {
    return (sessions.data ?? []).map((s) => {
      const att = (atts.data ?? []).filter((a) => a.session_id === s.id);
      const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 } as Record<Status, number>;
      for (const a of att) counts[a.status as Status]++;
      return { ...s, counts, total: att.length, dosenNama: dosenMap.get(s.created_by ?? "") ?? "—" };
    });
  }, [sessions.data, atts.data, dosenMap]);
  return stats;
}

function AdminMonitoring() {
  const stats = useSessionStats().filter((s) => !s.closed);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Monitoring Absensi</h1>
      <p className="text-sm text-muted-foreground">Daftar sesi aktif saat ini.</p>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Sesi</th><th className="p-3">Dosen</th><th className="p-3">Tanggal</th><th className="p-3">Hadir</th><th className="p-3">Izin</th><th className="p-3">Sakit</th><th className="p-3">Alpa</th><th className="p-3">Status</th></tr>
              </thead>
              <tbody className="divide-y">
                {stats.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Tidak ada sesi aktif.</td></tr>}
                {stats.map((s) => (
                  <tr key={s.id}>
                    <td className="p-3 font-medium">{s.judul}</td>
                    <td className="p-3">{s.dosenNama}</td>
                    <td className="p-3 text-muted-foreground">{new Date(s.created_at).toLocaleString("id-ID")}</td>
                    <td className="p-3">{s.counts.Hadir}</td>
                    <td className="p-3">{s.counts.Izin}</td>
                    <td className="p-3">{s.counts.Sakit}</td>
                    <td className="p-3">{s.counts.Alpa}</td>
                    <td className="p-3"><span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Aktif</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminRiwayat() {
  const stats = useSessionStats();
  const [detail, setDetail] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Riwayat Sesi</h1>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Sesi</th><th className="p-3">Dosen</th><th className="p-3">Tanggal</th><th className="p-3">Status</th><th className="p-3">Peserta</th><th className="p-3"></th></tr>
              </thead>
              <tbody className="divide-y">
                {stats.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Belum ada sesi.</td></tr>}
                {stats.map((s) => (
                  <tr key={s.id}>
                    <td className="p-3 font-medium">{s.judul}</td>
                    <td className="p-3">{s.dosenNama}</td>
                    <td className="p-3 text-muted-foreground">{new Date(s.created_at).toLocaleString("id-ID")}</td>
                    <td className="p-3">{s.closed ? <span className="rounded bg-muted px-2 py-0.5 text-xs">Ditutup</span> : <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Aktif</span>}</td>
                    <td className="p-3">{s.total}</td>
                    <td className="p-3"><Button size="sm" variant="outline" onClick={() => setDetail(s.id)}>Detail</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Detail Sesi</DialogTitle></DialogHeader>
          {detail && <SessionAttendanceList sessionId={detail} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminRekap() {
  const users = useAdminUsers();
  const atts = useAllAttendances();
  const sessions = useAllSessions();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filterMhs, setFilterMhs] = useState("");

  const mahasiswa = (users.data ?? []).filter((u) => u.role === "mahasiswa");
  const filteredAtts = (atts.data ?? []).filter((a) => {
    const d = new Date(a.created_at);
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(to + "T23:59:59")) return false;
    if (filterMhs && a.student_id !== filterMhs) return false;
    return true;
  });

  const rekap = mahasiswa.map((m) => {
    const my = filteredAtts.filter((a) => a.student_id === m.id);
    const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 } as Record<Status, number>;
    for (const a of my) counts[a.status as Status]++;
    const total = my.length || 1;
    const persen = ((counts.Hadir / total) * 100).toFixed(0);
    return { ...m, counts, persen };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Rekap Absensi</h1>
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div><label className="mb-1 block text-xs">Dari tanggal</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="mb-1 block text-xs">Sampai tanggal</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div>
            <label className="mb-1 block text-xs">Mahasiswa</label>
            <Select value={filterMhs || "all"} onValueChange={(v) => setFilterMhs(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {mahasiswa.map((m) => <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Nama</th><th className="p-3">NIM</th><th className="p-3">Hadir</th><th className="p-3">Izin</th><th className="p-3">Sakit</th><th className="p-3">Alpa</th><th className="p-3">Persentase</th></tr>
              </thead>
              <tbody className="divide-y">
                {rekap.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Belum ada data.</td></tr>}
                {rekap.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 font-medium">{r.nama}</td>
                    <td className="p-3">{r.nim ?? "—"}</td>
                    <td className="p-3">{r.counts.Hadir}</td>
                    <td className="p-3">{r.counts.Izin}</td>
                    <td className="p-3">{r.counts.Sakit}</td>
                    <td className="p-3">{r.counts.Alpa}</td>
                    <td className="p-3">{r.persen}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <input type="hidden" value={sessions.isLoading ? "1" : "0"} readOnly />
    </div>
  );
}

// ==================== DOSEN ====================
function DosenApp({ nama, userId }: { nama: string; userId: string }) {
  const [current, setCurrent] = useState("beranda");
  const menus: MenuItem[] = [
    { key: "beranda", label: "Beranda", icon: <Home className="h-4 w-4" /> },
    { key: "buat", label: "Buat Sesi", icon: <Plus className="h-4 w-4" /> },
    { key: "aktif", label: "Sesi Aktif", icon: <QrCode className="h-4 w-4" /> },
    { key: "kehadiran", label: "Daftar Kehadiran", icon: <ClipboardList className="h-4 w-4" /> },
    { key: "pengajuan", label: "Pengajuan Izin/Sakit", icon: <Inbox className="h-4 w-4" /> },
    { key: "riwayat", label: "Riwayat Sesi", icon: <History className="h-4 w-4" /> },
    { key: "rekap", label: "Rekap Absensi", icon: <FileSpreadsheet className="h-4 w-4" /> },
  ];
  return (
    <Shell role="dosen" nama={nama} menus={menus} current={current} setCurrent={setCurrent}>
      {current === "beranda" && <DosenBeranda userId={userId} />}
      {current === "buat" && <DosenBuatSesi userId={userId} />}
      {current === "aktif" && <DosenSesiAktif userId={userId} />}
      {current === "kehadiran" && <DosenKehadiran userId={userId} />}
      {current === "pengajuan" && <DosenPengajuan userId={userId} />}
      {current === "riwayat" && <DosenRiwayat userId={userId} />}
      {current === "rekap" && <DosenRekap userId={userId} />}
    </Shell>
  );
}

function useMySessions(userId: string) {
  return useQuery({
    queryKey: ["dosen-sessions", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_sessions")
        .select("*")
        .eq("created_by", userId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
}

function useMyAttendances(sessionIds: string[]) {
  return useQuery({
    enabled: sessionIds.length > 0,
    queryKey: ["dosen-att", sessionIds.join(",")],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendances")
        .select("*")
        .in("session_id", sessionIds);
      return data ?? [];
    },
  });
}

function useMahasiswaList() {
  return useQuery({
    queryKey: ["mahasiswa-list"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "mahasiswa");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, nama, nim").in("id", ids);
      return profiles ?? [];
    },
  });
}

function DosenBeranda({ userId }: { userId: string }) {
  const sessions = useMySessions(userId);
  const sIds = (sessions.data ?? []).map((s) => s.id);
  const atts = useMyAttendances(sIds);
  const mhs = useMahasiswaList();

  const aktif = (sessions.data ?? []).filter((s) => !s.closed);
  const aktifIds = new Set(aktif.map((s) => s.id));
  const attAktif = (atts.data ?? []).filter((a) => aktifIds.has(a.session_id));
  const hadirAktif = attAktif.filter((a) => a.status === "Hadir").length;
  const belumAbsen = aktif.length * (mhs.data?.length ?? 0) - attAktif.length;
  const pendingIzin = (atts.data ?? []).filter((a) => (a.status === "Izin" || a.status === "Sakit") && !a.keterangan?.startsWith("[OK]") && !a.keterangan?.startsWith("[TOLAK]")).length;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Beranda Dosen</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Sesi" value={sessions.data?.length ?? 0} icon={<CalendarCheck className="h-5 w-5" />} />
        <StatCard label="Sesi Aktif" value={aktif.length} icon={<QrCode className="h-5 w-5" />} />
        <StatCard label="Hadir di Sesi Aktif" value={hadirAktif} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Belum Absen" value={Math.max(0, belumAbsen)} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Pengajuan Menunggu" value={pendingIzin} icon={<Inbox className="h-5 w-5" />} />
      </div>
    </div>
  );
}

function DosenBuatSesi({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [judul, setJudul] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const sessions = useMySessions(userId);
  const created = sessions.data?.find((s) => s.id === createdId);

  const create = async () => {
    if (!judul.trim()) return toast.error("Nama sesi wajib");
    const kode = crypto.randomUUID().slice(0, 8).toUpperCase();
    const { data, error } = await supabase
      .from("attendance_sessions")
      .insert({ judul: judul.trim(), kode, created_by: userId })
      .select().single();
    if (error) return toast.error(error.message);
    toast.success("Sesi dibuat");
    setJudul("");
    setCreatedId(data.id);
    qc.invalidateQueries({ queryKey: ["dosen-sessions", userId] });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Buat Sesi</h1>
      <Card>
        <CardHeader><CardTitle>Form Sesi Baru</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-sm">Nama mata kuliah / sesi</label>
            <Input placeholder="Contoh: Algoritma — Pertemuan 5" value={judul} onChange={(e) => setJudul(e.target.value)} />
          </div>
          <Button onClick={create} className="gap-1"><Plus className="h-4 w-4" />Buat Sesi</Button>
        </CardContent>
      </Card>
      {created && (
        <Card>
          <CardHeader><CardTitle>{created.judul}</CardTitle><CardDescription>QR Code & kode manual</CardDescription></CardHeader>
          <CardContent className="flex flex-col items-center gap-2 rounded-lg border bg-white p-6">
            <QRCodeSVG value={created.kode} size={240} level="M" />
            <p className="text-xs text-muted-foreground">Kode manual:</p>
            <code className="rounded bg-muted px-2 py-1 text-sm font-bold tracking-wider">{created.kode}</code>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DosenSesiAktif({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const sessions = useMySessions(userId);
  const aktif = (sessions.data ?? []).filter((s) => !s.closed);
  const sIds = aktif.map((s) => s.id);
  const atts = useMyAttendances(sIds);
  const mhs = useMahasiswaList();
  const toggleClose = useServerFn(setAttendanceSessionClosed);

  const close = async (id: string) => {
    try {
      await toggleClose({ data: { sessionId: id, closed: true } });
      toast.success("Sesi ditutup");
      qc.invalidateQueries({ queryKey: ["dosen-sessions", userId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal"); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Sesi Aktif</h1>
      {aktif.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">Tidak ada sesi aktif.</CardContent></Card>}
      <div className="grid gap-4 md:grid-cols-2">
        {aktif.map((s) => {
          const sAtt = (atts.data ?? []).filter((a) => a.session_id === s.id);
          const hadir = sAtt.filter((a) => a.status === "Hadir").length;
          const belum = (mhs.data?.length ?? 0) - sAtt.length;
          return (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle>{s.judul}</CardTitle>
                <CardDescription>{new Date(s.created_at).toLocaleString("id-ID")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col items-center gap-2 rounded-lg border bg-white p-4">
                  <QRCodeSVG value={s.kode} size={180} level="M" />
                  <code className="rounded bg-muted px-2 py-1 text-sm font-bold tracking-wider">{s.kode}</code>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Hadir: <b>{hadir}</b></span>
                  <span>Belum: <b>{Math.max(0, belum)}</b></span>
                </div>
                <Button variant="outline" className="w-full" onClick={() => close(s.id)}>Tutup Sesi</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DosenKehadiran({ userId }: { userId: string }) {
  const sessions = useMySessions(userId);
  const [sessionId, setSessionId] = useState<string>("");
  useEffect(() => {
    if (!sessionId && sessions.data && sessions.data.length > 0) setSessionId(sessions.data[0].id);
  }, [sessions.data, sessionId]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Daftar Kehadiran</h1>
      <Card>
        <CardContent className="p-4">
          <label className="mb-1 block text-sm">Pilih Sesi</label>
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger><SelectValue placeholder="Pilih sesi" /></SelectTrigger>
            <SelectContent>
              {(sessions.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.judul} {s.closed ? "(Ditutup)" : "(Aktif)"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      {sessionId && (
        <Card>
          <CardContent className="p-4">
            <SessionAttendanceList sessionId={sessionId} canEdit />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DosenPengajuan({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const sessions = useMySessions(userId);
  const sIds = (sessions.data ?? []).map((s) => s.id);
  const atts = useMyAttendances(sIds);
  const mhs = useMahasiswaList();

  const mhsMap = new Map<string, { nama: string; nim: string | null }>();
  for (const m of mhs.data ?? []) mhsMap.set(m.id, { nama: m.nama, nim: m.nim });
  const sesMap = new Map<string, string>();
  for (const s of sessions.data ?? []) sesMap.set(s.id, s.judul);

  const pengajuan = (atts.data ?? []).filter((a) => a.status === "Izin" || a.status === "Sakit");

  const decide = async (id: string, accept: boolean, current: any) => {
    if (accept) {
      const newKet = `[OK] ${current.keterangan ?? ""}`.trim();
      const { error } = await supabase.from("attendances").update({ keterangan: newKet }).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("Diterima");
    } else {
      const { error } = await supabase.from("attendances").update({ status: "Alpa", keterangan: `[TOLAK] ${current.keterangan ?? ""}`.trim() }).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("Ditolak");
    }
    qc.invalidateQueries({ queryKey: ["dosen-att", sIds.join(",")] });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pengajuan Izin / Sakit</h1>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Nama</th><th className="p-3">NIM</th><th className="p-3">Sesi</th><th className="p-3">Jenis</th><th className="p-3">Alasan</th><th className="p-3">Tanggal</th><th className="p-3">Status</th><th className="p-3">Aksi</th></tr>
              </thead>
              <tbody className="divide-y">
                {pengajuan.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Tidak ada pengajuan.</td></tr>}
                {pengajuan.map((a) => {
                  const m = mhsMap.get(a.student_id);
                  const ket = a.keterangan ?? "";
                  const isAccepted = ket.startsWith("[OK]");
                  const isRejected = ket.startsWith("[TOLAK]");
                  const status = isAccepted ? "Diterima" : isRejected ? "Ditolak" : "Menunggu";
                  return (
                    <tr key={a.id}>
                      <td className="p-3 font-medium">{m?.nama ?? "—"}</td>
                      <td className="p-3">{m?.nim ?? "—"}</td>
                      <td className="p-3">{sesMap.get(a.session_id) ?? "—"}</td>
                      <td className="p-3"><StatusBadge status={a.status as Status} /></td>
                      <td className="p-3 text-xs text-muted-foreground">{ket.replace(/^\[(OK|TOLAK)\]\s?/, "") || "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("id-ID")}</td>
                      <td className="p-3"><span className={`rounded px-2 py-0.5 text-xs ${isAccepted ? "bg-emerald-100 text-emerald-800" : isRejected ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>{status}</span></td>
                      <td className="p-3">
                        {!isAccepted && !isRejected && (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => decide(a.id, true, a)}>Terima</Button>
                            <Button size="sm" variant="outline" onClick={() => decide(a.id, false, a)}>Tolak</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DosenRiwayat({ userId }: { userId: string }) {
  const sessions = useMySessions(userId);
  const sIds = (sessions.data ?? []).map((s) => s.id);
  const atts = useMyAttendances(sIds);
  const [detail, setDetail] = useState<string | null>(null);

  const rows = (sessions.data ?? []).map((s) => {
    const att = (atts.data ?? []).filter((a) => a.session_id === s.id);
    const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 } as Record<Status, number>;
    for (const a of att) counts[a.status as Status]++;
    return { ...s, counts };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Riwayat Sesi</h1>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Sesi</th><th className="p-3">Tanggal</th><th className="p-3">Status</th><th className="p-3">Hadir</th><th className="p-3">Izin</th><th className="p-3">Sakit</th><th className="p-3">Alpa</th><th className="p-3"></th></tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Belum ada sesi.</td></tr>}
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className="p-3 font-medium">{s.judul}</td>
                    <td className="p-3 text-muted-foreground">{new Date(s.created_at).toLocaleString("id-ID")}</td>
                    <td className="p-3">{s.closed ? "Ditutup" : "Aktif"}</td>
                    <td className="p-3">{s.counts.Hadir}</td>
                    <td className="p-3">{s.counts.Izin}</td>
                    <td className="p-3">{s.counts.Sakit}</td>
                    <td className="p-3">{s.counts.Alpa}</td>
                    <td className="p-3"><Button size="sm" variant="outline" onClick={() => setDetail(s.id)}>Detail</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Detail Sesi</DialogTitle></DialogHeader>
          {detail && <SessionAttendanceList sessionId={detail} canEdit />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DosenRekap({ userId }: { userId: string }) {
  const sessions = useMySessions(userId);
  const sIds = (sessions.data ?? []).map((s) => s.id);
  const atts = useMyAttendances(sIds);
  const mhs = useMahasiswaList();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sesFilter, setSesFilter] = useState("");

  const filteredAtts = (atts.data ?? []).filter((a) => {
    const d = new Date(a.created_at);
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(to + "T23:59:59")) return false;
    if (sesFilter && a.session_id !== sesFilter) return false;
    return true;
  });

  const rekap = (mhs.data ?? []).map((m) => {
    const my = filteredAtts.filter((a) => a.student_id === m.id);
    const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 } as Record<Status, number>;
    for (const a of my) counts[a.status as Status]++;
    const total = my.length || 1;
    return { ...m, counts, persen: ((counts.Hadir / total) * 100).toFixed(0) };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Rekap Absensi</h1>
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div><label className="mb-1 block text-xs">Dari</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="mb-1 block text-xs">Sampai</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div>
            <label className="mb-1 block text-xs">Sesi</label>
            <Select value={sesFilter || "all"} onValueChange={(v) => setSesFilter(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {(sessions.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.judul}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Nama</th><th className="p-3">NIM</th><th className="p-3">Hadir</th><th className="p-3">Izin</th><th className="p-3">Sakit</th><th className="p-3">Alpa</th><th className="p-3">Persentase</th></tr>
              </thead>
              <tbody className="divide-y">
                {rekap.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Belum ada data.</td></tr>}
                {rekap.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 font-medium">{r.nama}</td>
                    <td className="p-3">{r.nim ?? "—"}</td>
                    <td className="p-3">{r.counts.Hadir}</td>
                    <td className="p-3">{r.counts.Izin}</td>
                    <td className="p-3">{r.counts.Sakit}</td>
                    <td className="p-3">{r.counts.Alpa}</td>
                    <td className="p-3">{r.persen}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Shared session attendance list ----------
function SessionAttendanceList({ sessionId, canEdit }: { sessionId: string; canEdit?: boolean }) {
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ["session-att", sessionId],
    refetchInterval: 3000,
    queryFn: async () => {
      const [{ data: students }, { data: roles }, { data: atts }] = await Promise.all([
        supabase.from("profiles").select("id, nama, nim"),
        supabase.from("user_roles").select("user_id, role").eq("role", "mahasiswa"),
        supabase.from("attendances").select("*").eq("session_id", sessionId),
      ]);
      const studentIds = new Set((roles ?? []).map((r) => r.user_id));
      const list = (students ?? []).filter((s) => studentIds.has(s.id));
      const attMap = new Map((atts ?? []).map((a) => [a.student_id, a]));
      return { list, attMap };
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`att-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendances", filter: `session_id=eq.${sessionId}` },
        () => qc.invalidateQueries({ queryKey: ["session-att", sessionId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, qc]);

  const setStatus = async (studentId: string, status: Status, current: Status | undefined) => {
    if (current === status) {
      const { error } = await supabase.from("attendances").delete().eq("session_id", sessionId).eq("student_id", studentId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("attendances")
        .upsert({ session_id: sessionId, student_id: studentId, status }, { onConflict: "session_id,student_id" });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["session-att", sessionId] });
  };

  if (!data.data) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 } as Record<Status, number>;
  data.data.list.forEach((s) => {
    const st = data.data.attMap.get(s.id)?.status as Status | undefined;
    if (st) counts[st]++;
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-xs">
        {STATUS_LIST.map((s) => (
          <div key={s} className="rounded-md border px-2 py-1"><StatusBadge status={s} /> <span className="ml-1 font-semibold">{counts[s]}</span></div>
        ))}
      </div>
      <div className="max-h-80 divide-y overflow-y-auto rounded-md border">
        {data.data.list.map((s) => {
          const cur = data.data.attMap.get(s.id)?.status as Status | undefined;
          return (
            <div key={s.id} className="flex items-center justify-between gap-2 p-2 text-sm">
              <div>
                <p className="font-medium">{s.nama}</p>
                <p className="text-xs text-muted-foreground">{s.nim ?? "—"}</p>
              </div>
              {canEdit ? (
                <div className="flex gap-1">
                  {STATUS_LIST.map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatus(s.id, st, cur)}
                      title={cur === st ? "Klik lagi untuk membatalkan" : undefined}
                      className={`rounded px-2 py-0.5 text-xs ${cur === st ? "ring-2 ring-primary" : ""}`}
                    >
                      <StatusBadge status={st} />
                    </button>
                  ))}
                </div>
              ) : cur ? <StatusBadge status={cur} /> : <span className="text-xs text-muted-foreground">Belum</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== MAHASISWA ====================
function MahasiswaApp({ nama, userId }: { nama: string; userId: string }) {
  const [current, setCurrent] = useState("beranda");
  const menus: MenuItem[] = [
    { key: "beranda", label: "Beranda", icon: <Home className="h-4 w-4" /> },
    { key: "absen", label: "Absen Sekarang", icon: <ScanLine className="h-4 w-4" /> },
    { key: "pengajuan", label: "Pengajuan Izin/Sakit", icon: <Inbox className="h-4 w-4" /> },
    { key: "riwayat", label: "Riwayat Absensi", icon: <History className="h-4 w-4" /> },
    { key: "rekap", label: "Rekap Kehadiran", icon: <BarChart3 className="h-4 w-4" /> },
  ];
  return (
    <Shell role="mahasiswa" nama={nama} menus={menus} current={current} setCurrent={setCurrent}>
      {current === "beranda" && <MhsBeranda userId={userId} />}
      {current === "absen" && <MhsAbsen userId={userId} />}
      {current === "pengajuan" && <MhsPengajuan userId={userId} />}
      {current === "riwayat" && <MhsRiwayat userId={userId} />}
      {current === "rekap" && <MhsRekap userId={userId} />}
    </Shell>
  );
}

function useMyAtt(userId: string) {
  return useQuery({
    queryKey: ["my-att", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendances")
        .select("*, attendance_sessions(judul, created_at, closed, created_by)")
        .eq("student_id", userId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
}

function useOpenSessions() {
  return useQuery({
    queryKey: ["open-sessions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_sessions")
        .select("*")
        .eq("closed", false)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
}

function MhsBeranda({ userId }: { userId: string }) {
  const att = useMyAtt(userId);
  const open = useOpenSessions();
  const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 } as Record<Status, number>;
  for (const a of att.data ?? []) counts[a.status as Status]++;
  const total = (att.data ?? []).length || 1;
  const persen = ((counts.Hadir / total) * 100).toFixed(0);
  const today = new Date().toDateString();
  const todayAtt = (att.data ?? []).find((a) => new Date(a.created_at).toDateString() === today);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Beranda</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Hadir" value={counts.Hadir} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Izin" value={counts.Izin} />
        <StatCard label="Sakit" value={counts.Sakit} />
        <StatCard label="Alpa" value={counts.Alpa} />
        <StatCard label="Persentase" value={`${persen}%`} icon={<BarChart3 className="h-5 w-5" />} />
        <StatCard label="Status Hari Ini" value={todayAtt ? todayAtt.status : "Belum absen"} />
        <StatCard label="Sesi Aktif" value={open.data?.length ?? 0} icon={<QrCode className="h-5 w-5" />} />
      </div>
    </div>
  );
}

function MhsAbsen({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const open = useOpenSessions();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualKode, setManualKode] = useState("");

  const submit = async (kode: string) => {
    const trimmed = kode.trim().toUpperCase();
    if (!trimmed) return;
    const { data: ses, error: sErr } = await supabase
      .from("attendance_sessions").select("id, judul, closed").eq("kode", trimmed).maybeSingle();
    if (sErr || !ses) return toast.error("QR Code / kode tidak valid");
    if (ses.closed) return toast.error("Sesi sudah ditutup");
    const { data: existing } = await supabase.from("attendances")
      .select("id, status").eq("session_id", ses.id).eq("student_id", userId).maybeSingle();
    if (existing && existing.status === "Hadir") return toast.error("Anda sudah absen pada sesi ini");
    const { error } = await supabase.from("attendances")
      .upsert({ session_id: ses.id, student_id: userId, status: "Hadir" }, { onConflict: "session_id,student_id" });
    if (error) return toast.error(error.message);
    toast.success(`Absensi berhasil: ${ses.judul}`);
    qc.invalidateQueries({ queryKey: ["my-att", userId] });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Absen Sekarang</h1>
      <Card>
        <CardHeader><CardTitle>Sesi Aktif Tersedia</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(open.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Tidak ada sesi aktif.</p>}
          {(open.data ?? []).map((s) => (
            <div key={s.id} className="rounded border p-3 text-sm">
              <p className="font-medium">{s.judul}</p>
              <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("id-ID")} · Aktif</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5" />Scan QR Code</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!scannerOpen ? (
              <Button className="w-full gap-1" onClick={() => setScannerOpen(true)}><ScanLine className="h-4 w-4" />Buka Kamera</Button>
            ) : (
              <QrScanner onResult={async (t) => { setScannerOpen(false); await submit(t); }} onClose={() => setScannerOpen(false)} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Input Kode Manual</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Kode sesi" value={manualKode} onChange={(e) => setManualKode(e.target.value)} />
            <Button className="w-full gap-1" onClick={() => { submit(manualKode); setManualKode(""); }}>
              <CheckCircle2 className="h-4 w-4" />Kirim Kode
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MhsPengajuan({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const open = useOpenSessions();
  const att = useMyAtt(userId);
  const [sessionId, setSessionId] = useState("");
  const [jenis, setJenis] = useState<"Izin" | "Sakit">("Izin");
  const [alasan, setAlasan] = useState("");

  const submit = async () => {
    if (!sessionId) return toast.error("Pilih sesi");
    if (!alasan.trim()) return toast.error("Alasan wajib");
    const { error } = await supabase.from("attendances")
      .upsert({ session_id: sessionId, student_id: userId, status: jenis, keterangan: alasan }, { onConflict: "session_id,student_id" });
    if (error) return toast.error(error.message);
    toast.success("Pengajuan dikirim");
    setSessionId(""); setAlasan("");
    qc.invalidateQueries({ queryKey: ["my-att", userId] });
  };

  const pengajuan = (att.data ?? []).filter((a) => a.status === "Izin" || a.status === "Sakit");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pengajuan Izin / Sakit</h1>
      <Card>
        <CardHeader><CardTitle>Form Pengajuan</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-sm">Sesi</label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger><SelectValue placeholder="Pilih sesi aktif" /></SelectTrigger>
              <SelectContent>
                {(open.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.judul}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm">Jenis</label>
            <Select value={jenis} onValueChange={(v) => setJenis(v as "Izin" | "Sakit")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Izin">Izin</SelectItem>
                <SelectItem value="Sakit">Sakit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm">Alasan</label>
            <Input value={alasan} onChange={(e) => setAlasan(e.target.value)} />
          </div>
          <Button onClick={submit}>Kirim Pengajuan</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Status Pengajuan</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Sesi</th><th className="p-3">Jenis</th><th className="p-3">Alasan</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody className="divide-y">
              {pengajuan.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Belum ada pengajuan.</td></tr>}
              {pengajuan.map((a: any) => {
                const ket = a.keterangan ?? "";
                const isOk = ket.startsWith("[OK]"); const isTolak = ket.startsWith("[TOLAK]");
                const status = isOk ? "Diterima" : isTolak ? "Ditolak" : "Menunggu";
                return (
                  <tr key={a.id}>
                    <td className="p-3">{a.attendance_sessions?.judul ?? "—"}</td>
                    <td className="p-3">{a.status}</td>
                    <td className="p-3 text-xs text-muted-foreground">{ket.replace(/^\[(OK|TOLAK)\]\s?/, "")}</td>
                    <td className="p-3"><span className={`rounded px-2 py-0.5 text-xs ${isOk ? "bg-emerald-100 text-emerald-800" : isTolak ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>{status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function MhsRiwayat({ userId }: { userId: string }) {
  const att = useMyAtt(userId);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Riwayat Absensi</h1>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Sesi</th><th className="p-3">Tanggal</th><th className="p-3">Status</th><th className="p-3">Keterangan</th></tr>
              </thead>
              <tbody className="divide-y">
                {(att.data ?? []).length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Belum ada absensi.</td></tr>}
                {(att.data ?? []).map((a: any) => (
                  <tr key={a.id}>
                    <td className="p-3 font-medium">{a.attendance_sessions?.judul ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{new Date(a.created_at).toLocaleString("id-ID")}</td>
                    <td className="p-3"><StatusBadge status={a.status as Status} /></td>
                    <td className="p-3 text-xs text-muted-foreground">{(a.keterangan ?? "").replace(/^\[(OK|TOLAK)\]\s?/, "") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MhsRekap({ userId }: { userId: string }) {
  const att = useMyAtt(userId);
  const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 } as Record<Status, number>;
  for (const a of att.data ?? []) counts[a.status as Status]++;
  const total = (att.data ?? []).length || 1;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Rekap Kehadiran Saya</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Sesi" value={att.data?.length ?? 0} />
        <StatCard label="Hadir" value={counts.Hadir} />
        <StatCard label="Izin" value={counts.Izin} />
        <StatCard label="Sakit" value={counts.Sakit} />
        <StatCard label="Alpa" value={counts.Alpa} />
        <StatCard label="Persentase Hadir" value={`${((counts.Hadir / total) * 100).toFixed(0)}%`} />
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Sesi</th><th className="p-3">Tanggal</th><th className="p-3">Status</th><th className="p-3">Keterangan</th></tr>
            </thead>
            <tbody className="divide-y">
              {(att.data ?? []).map((a: any) => (
                <tr key={a.id}>
                  <td className="p-3">{a.attendance_sessions?.judul ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{new Date(a.created_at).toLocaleString("id-ID")}</td>
                  <td className="p-3"><StatusBadge status={a.status as Status} /></td>
                  <td className="p-3 text-xs text-muted-foreground">{(a.keterangan ?? "").replace(/^\[(OK|TOLAK)\]\s?/, "") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
