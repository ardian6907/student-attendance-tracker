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
  adminResetPassword,
} from "@/lib/admin.functions";
import { LoginForm } from "@/components/login-form";
import { QrScanner } from "@/components/qr-scanner";
import { StatusBadge } from "@/components/status-badge";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CalendarCheck, LogOut, Plus, Trash2, Users, KeyRound, ShieldCheck,
  GraduationCap, QrCode, ScanLine, X, RotateCcw, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: App });

type Role = "admin" | "dosen" | "mahasiswa";
type Status = "Hadir" | "Izin" | "Sakit" | "Alpa";

const STATUS_LIST: Status[] = ["Hadir", "Izin", "Sakit", "Alpa"];
const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  dosen: "Dosen",
  mahasiswa: "Mahasiswa",
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
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null);
    });
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
      const role: Role =
        roles.includes("admin") ? "admin" :
        roles.includes("dosen") ? "dosen" : "mahasiswa";
      return { profile: p, role };
    },
  });
}

// ---------- App shell ----------
function App() {
  const { user, ready } = useSession();
  const me = useMe(user?.id);

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Memuat...</div>;
  }
  if (!user) {
    return <><LoginForm /><Toaster /></>;
  }
  if (me.isLoading || !me.data) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Memuat profil...</div>;
  }

  const role = me.data.role;
  const nama = me.data.profile?.nama ?? user.email ?? "User";

  return (
    <div className="min-h-screen bg-[image:var(--gradient-subtle)]">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}
            >
              <CalendarCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">AbsenKelas</p>
              <p className="text-xs text-muted-foreground leading-tight">{nama} · {ROLE_LABEL[role]}</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => supabase.auth.signOut()} className="gap-1">
            <LogOut className="h-4 w-4" /> Keluar
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {role === "admin" && <AdminPanel currentUserId={user.id} />}
        {role === "dosen" && <DosenPanel userId={user.id} />}
        {role === "mahasiswa" && <MahasiswaPanel userId={user.id} />}
      </main>
      <Toaster />
    </div>
  );
}

// ---------- Admin ----------
function AdminPanel({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("nama"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map<string, Role>();
      for (const r of roles ?? []) {
        const cur = roleMap.get(r.user_id);
        if (!cur || r.role === "admin" || (r.role === "dosen" && cur === "mahasiswa")) {
          roleMap.set(r.user_id, r.role as Role);
        }
      }
      return (profiles ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? "mahasiswa" as Role }));
    },
  });

  return (
    <Tabs defaultValue="mahasiswa" className="space-y-4">
      <TabsList>
        <TabsTrigger value="mahasiswa" className="gap-1"><GraduationCap className="h-4 w-4"/>Mahasiswa</TabsTrigger>
        <TabsTrigger value="dosen" className="gap-1"><ShieldCheck className="h-4 w-4"/>Dosen</TabsTrigger>
      </TabsList>
      <TabsContent value="mahasiswa">
        <UserManager
          title="Kelola Mahasiswa"
          role="mahasiswa"
          users={(users.data ?? []).filter((u) => u.role === "mahasiswa")}
          onChanged={() => qc.invalidateQueries({ queryKey: ["all-users"] })}
          currentUserId={currentUserId}
        />
      </TabsContent>
      <TabsContent value="dosen">
        <UserManager
          title="Kelola Dosen"
          role="dosen"
          users={(users.data ?? []).filter((u) => u.role === "dosen")}
          onChanged={() => qc.invalidateQueries({ queryKey: ["all-users"] })}
          currentUserId={currentUserId}
        />
      </TabsContent>
    </Tabs>
  );
}

function UserManager({
  title, role, users, onChanged, currentUserId,
}: {
  title: string;
  role: Role;
  users: Array<{ id: string; nama: string; username: string; nim: string | null }>;
  onChanged: () => void;
  currentUserId: string;
}) {
  const create = useServerFn(adminCreateUser);
  const del = useServerFn(adminDeleteUser);
  const reset = useServerFn(adminResetPassword);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nama: "", username: "", nim: "", password: "" });
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setBusy(true);
    try {
      await create({
        data: {
          nama: form.nama,
          username: form.username || form.nim,
          password: form.password,
          role,
          nim: role === "mahasiswa" ? form.nim : null,
        },
      });
      toast.success("Akun dibuat");
      setOpen(false);
      setForm({ nama: "", username: "", nim: "", password: "" });
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
      toast.success("Password berhasil direset");
      setResetFor(null); setNewPw("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus akun ini?")) return;
    try {
      await del({ data: { userId: id } });
      toast.success("Akun dihapus");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/>{title}</CardTitle>
          <CardDescription>{users.length} akun</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4"/>Tambah</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah {ROLE_LABEL[role]}</DialogTitle>
              <DialogDescription>Admin menentukan password awal.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nama" value={form.nama} onChange={(e)=>setForm({...form, nama: e.target.value})}/>
              {role === "mahasiswa" && (
                <Input placeholder="NIM" value={form.nim} onChange={(e)=>setForm({...form, nim: e.target.value, username: e.target.value})}/>
              )}
              <Input placeholder="Username" value={form.username} onChange={(e)=>setForm({...form, username: e.target.value})}/>
              <Input type="password" placeholder="Password (min 6)" value={form.password} onChange={(e)=>setForm({...form, password: e.target.value})}/>
            </div>
            <DialogFooter>
              <Button disabled={busy} onClick={handleCreate}>{busy ? "Memproses..." : "Buat"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-md border">
          {users.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">Belum ada akun.</p>
          )}
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 p-3">
              <div>
                <p className="text-sm font-medium">{u.nama}</p>
                <p className="text-xs text-muted-foreground">
                  @{u.username}{u.nim ? ` · NIM ${u.nim}` : ""}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="gap-1" onClick={()=>{setResetFor(u.id); setNewPw("");}}>
                  <KeyRound className="h-3.5 w-3.5"/>Reset
                </Button>
                {u.id !== currentUserId && (
                  <Button size="sm" variant="ghost" onClick={()=>handleDelete(u.id)}>
                    <Trash2 className="h-4 w-4 text-destructive"/>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={!!resetFor} onOpenChange={(o)=>!o && setResetFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Atur password baru untuk akun ini.</DialogDescription>
          </DialogHeader>
          <Input type="password" placeholder="Password baru (min 6)" value={newPw} onChange={(e)=>setNewPw(e.target.value)} />
          <DialogFooter>
            <Button disabled={busy || newPw.length < 6} onClick={handleReset}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------- Dosen ----------
function DosenPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_sessions")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const [judul, setJudul] = useState("");
  const [active, setActive] = useState<string | null>(null);

  const create = async () => {
    if (!judul.trim()) return;
    const kode = crypto.randomUUID();
    const { data, error } = await supabase
      .from("attendance_sessions")
      .insert({ judul: judul.trim(), kode, created_by: userId })
      .select()
      .single();
    if (error) return toast.error(error.message);
    toast.success("Sesi dibuat");
    setJudul("");
    setActive(data.id);
    qc.invalidateQueries({ queryKey: ["sessions"] });
  };

  const toggle = async (id: string, closed: boolean) => {
    await supabase.from("attendance_sessions").update({ closed: !closed }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["sessions"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Hapus sesi ini beserta semua absensinya?")) return;
    await supabase.from("attendance_sessions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["sessions"] });
    if (active === id) setActive(null);
  };

  const activeSession = sessions.data?.find((s) => s.id === active);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5"/>Buat Sesi Baru</CardTitle>
          <CardDescription>Judul matakuliah / pertemuan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Contoh: Algoritma — Pertemuan 5" value={judul} onChange={(e)=>setJudul(e.target.value)}/>
          <Button onClick={create} className="w-full gap-1"><Plus className="h-4 w-4"/>Buat & Tampilkan QR</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Sesi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 divide-y overflow-y-auto rounded-md border">
            {(sessions.data ?? []).length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">Belum ada sesi.</p>
            )}
            {(sessions.data ?? []).map((s) => (
              <button
                key={s.id}
                onClick={()=>setActive(s.id)}
                className={`flex w-full items-center justify-between p-3 text-left hover:bg-muted/50 ${active===s.id?"bg-muted/40":""}`}
              >
                <div>
                  <p className="text-sm font-medium">{s.judul}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleString("id-ID")} · {s.closed ? "Ditutup" : "Aktif"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {activeSession && (
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{activeSession.judul}</CardTitle>
              <CardDescription>QR untuk ditampilkan ke kelas</CardDescription>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={()=>toggle(activeSession.id, activeSession.closed)}>
                {activeSession.closed ? "Buka Kembali" : "Tutup Sesi"}
              </Button>
              <Button size="sm" variant="ghost" onClick={()=>remove(activeSession.id)}>
                <Trash2 className="h-4 w-4 text-destructive"/>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[auto,1fr]">
            <div className="flex flex-col items-center gap-2 rounded-lg border bg-white p-6">
              <QRCodeSVG value={activeSession.kode} size={240} level="M" />
              <p className="text-xs text-muted-foreground">Kode fallback:</p>
              <code className="rounded bg-muted px-2 py-1 text-xs">{activeSession.kode.slice(0, 8)}</code>
            </div>
            <SessionAttendanceList sessionId={activeSession.id} canEdit />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SessionAttendanceList({ sessionId, canEdit }: { sessionId: string; canEdit?: boolean }) {
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ["session-att", sessionId],
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

  const setStatus = async (studentId: string, status: Status) => {
    const { error } = await supabase
      .from("attendances")
      .upsert({ session_id: sessionId, student_id: studentId, status }, { onConflict: "session_id,student_id" });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["session-att", sessionId] });
  };

  if (!data.data) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  const counts = STATUS_LIST.reduce<Record<Status, number>>((acc, s) => {
    acc[s] = 0; return acc;
  }, { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 });
  data.data.list.forEach((s) => {
    const st = data.data.attMap.get(s.id)?.status as Status | undefined;
    if (st) counts[st]++;
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-xs">
        {STATUS_LIST.map((s) => (
          <div key={s} className="rounded-md border px-2 py-1"><StatusBadge status={s}/> <span className="ml-1 font-semibold">{counts[s]}</span></div>
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
                      onClick={()=>setStatus(s.id, st)}
                      className={`rounded px-2 py-0.5 text-xs ${cur===st?"ring-2 ring-primary":""}`}
                    >
                      <StatusBadge status={st}/>
                    </button>
                  ))}
                </div>
              ) : cur ? <StatusBadge status={cur}/> : <span className="text-xs text-muted-foreground">Belum</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Mahasiswa ----------
function MahasiswaPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualKode, setManualKode] = useState("");
  const [izinOpen, setIzinOpen] = useState(false);
  const [izinSessionId, setIzinSessionId] = useState<string>("");
  const [izinStatus, setIzinStatus] = useState<Status>("Izin");
  const [izinKet, setIzinKet] = useState("");

  const history = useQuery({
    queryKey: ["my-att", userId],
    queryFn: async () => {
      const { data: atts } = await supabase
        .from("attendances")
        .select("*, attendance_sessions(judul, created_at)")
        .eq("student_id", userId)
        .order("created_at", { ascending: false });
      return atts ?? [];
    },
  });

  const openSessions = useQuery({
    queryKey: ["open-sessions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_sessions")
        .select("id, judul")
        .eq("closed", false)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const submitHadir = async (kode: string) => {
    const trimmed = kode.trim();
    if (!trimmed) return;
    const { data: ses, error: sErr } = await supabase
      .from("attendance_sessions")
      .select("id, judul, closed")
      .or(`kode.eq.${trimmed},kode.ilike.${trimmed}%`)
      .maybeSingle();
    if (sErr || !ses) return toast.error("Sesi tidak ditemukan");
    if (ses.closed) return toast.error("Sesi sudah ditutup");
    const { error } = await supabase
      .from("attendances")
      .upsert(
        { session_id: ses.id, student_id: userId, status: "Hadir" },
        { onConflict: "session_id,student_id" },
      );
    if (error) return toast.error(error.message);
    toast.success(`Hadir untuk: ${ses.judul}`);
    qc.invalidateQueries({ queryKey: ["my-att", userId] });
  };

  const submitIzin = async () => {
    if (!izinSessionId) return toast.error("Pilih sesi");
    const { error } = await supabase
      .from("attendances")
      .upsert(
        { session_id: izinSessionId, student_id: userId, status: izinStatus, keterangan: izinKet || null },
        { onConflict: "session_id,student_id" },
      );
    if (error) return toast.error(error.message);
    toast.success("Diajukan");
    setIzinOpen(false); setIzinKet(""); setIzinSessionId("");
    qc.invalidateQueries({ queryKey: ["my-att", userId] });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5"/>Scan QR Absen</CardTitle>
          <CardDescription>Arahkan kamera ke QR yang ditampilkan dosen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!scannerOpen ? (
            <Button className="w-full gap-1" onClick={()=>setScannerOpen(true)}>
              <ScanLine className="h-4 w-4"/>Buka Kamera
            </Button>
          ) : (
            <QrScanner
              onResult={async (text) => {
                setScannerOpen(false);
                await submitHadir(text);
              }}
              onClose={()=>setScannerOpen(false)}
            />
          )}
          <div className="text-center text-xs text-muted-foreground">atau masukkan kode manual</div>
          <div className="flex gap-2">
            <Input placeholder="Kode sesi" value={manualKode} onChange={(e)=>setManualKode(e.target.value)} />
            <Button variant="outline" onClick={()=>{ submitHadir(manualKode); setManualKode(""); }}>
              <CheckCircle2 className="h-4 w-4"/>
            </Button>
          </div>

          <Dialog open={izinOpen} onOpenChange={setIzinOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="w-full">Ajukan Izin / Sakit</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Izin / Sakit</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Select value={izinSessionId} onValueChange={setIzinSessionId}>
                  <SelectTrigger><SelectValue placeholder="Pilih sesi aktif"/></SelectTrigger>
                  <SelectContent>
                    {openSessions.data?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.judul}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={izinStatus} onValueChange={(v)=>setIzinStatus(v as Status)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Izin">Izin</SelectItem>
                    <SelectItem value="Sakit">Sakit</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Keterangan (opsional)" value={izinKet} onChange={(e)=>setIzinKet(e.target.value)}/>
              </div>
              <DialogFooter><Button onClick={submitIzin}>Kirim</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Absensi Saya</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 divide-y overflow-y-auto rounded-md border">
            {(history.data ?? []).length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">Belum ada absensi.</p>
            )}
            {(history.data ?? []).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-medium">{a.attendance_sessions?.judul ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("id-ID")}</p>
                  {a.keterangan && <p className="text-xs italic text-muted-foreground">{a.keterangan}</p>}
                </div>
                <StatusBadge status={a.status as Status}/>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
