import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  STATUS_LIST,
  Status,
  findByKode,
  useSessions,
  useStudents,
} from "@/lib/attendance-store";
import { ROLE_LABEL, Role, useAuth, useUsers } from "@/lib/auth-store";
import { LoginForm } from "@/components/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  CalendarCheck,
  KeyRound,
  LogOut,
  Plus,
  Trash2,
  Users,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "AbsenKelas — Aplikasi Absensi Mahasiswa" },
      {
        name: "description",
        content:
          "Aplikasi absensi mahasiswa dengan login terpisah untuk admin, dosen, dan mahasiswa.",
      },
    ],
  }),
});

function Index() {
  const { current } = useAuth();

  return (
    <>
      <Toaster richColors position="top-center" />
      {!current ? (
        <LoginForm />
      ) : (
        <div className="min-h-screen bg-[image:var(--gradient-subtle)]">
          <Header />
          <main className="container mx-auto max-w-6xl px-4 py-8">
            {current.role === "admin" && <AdminView />}
            {current.role === "dosen" && <DosenPanel />}
            {current.role === "mahasiswa" && <MahasiswaPanel />}
          </main>
          <footer className="border-t py-6 text-center text-xs text-muted-foreground">
            Data tersimpan lokal di browser ini.
          </footer>
        </div>
      )}
    </>
  );
}

function Header() {
  const { current, logout } = useAuth();
  if (!current) return null;
  return (
    <header className="border-b bg-card/60 backdrop-blur">
      <div className="container mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
        >
          <CalendarCheck className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">AbsenKelas</h1>
          <p className="truncate text-xs text-muted-foreground">
            {current.nama} · {ROLE_LABEL[current.role]}
            {current.nim ? ` · ${current.nim}` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
          <LogOut className="h-3.5 w-3.5" /> Keluar
        </Button>
      </div>
    </header>
  );
}

/* ============== ADMIN ============== */

function AdminView() {
  return (
    <Tabs defaultValue="mahasiswa" className="w-full">
      <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="mahasiswa">Kelola Mahasiswa</TabsTrigger>
        <TabsTrigger value="dosen">Kelola Dosen</TabsTrigger>
      </TabsList>
      <TabsContent value="mahasiswa">
        <KelolaMahasiswa />
      </TabsContent>
      <TabsContent value="dosen">
        <KelolaDosen />
      </TabsContent>
    </Tabs>
  );
}

function KelolaMahasiswa() {
  const { students, addStudent, removeStudent, resetDefault } = useStudents();
  const { users, syncMahasiswa, updatePassword } = useUsers();
  const [nim, setNim] = useState("");
  const [nama, setNama] = useState("");

  // Sinkronkan akun mahasiswa setiap kali daftar berubah
  useEffect(() => {
    if (students.length > 0) syncMahasiswa(students);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  const userByStudent = useMemo(
    () => new Map(users.filter((u) => u.role === "mahasiswa").map((u) => [u.studentId, u])),
    [users],
  );

  const handleAdd = () => {
    if (!nim.trim() || !nama.trim()) return toast.error("NIM dan nama wajib diisi");
    addStudent(nim.trim(), nama.trim());
    setNim("");
    setNama("");
    toast.success(`Mahasiswa ditambahkan. Login awal: ${nim.trim()} / ${nim.trim()}`);
  };

  const handleResetPwd = (id: string, nim?: string) => {
    const np = prompt("Password baru:", nim ?? "");
    if (np && np.trim()) {
      updatePassword(id, np.trim());
      toast.success("Password diperbarui");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Tambah Mahasiswa
          </CardTitle>
          <CardDescription>Akun login otomatis dibuat (username = NIM)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="NIM" value={nim} onChange={(e) => setNim(e.target.value)} />
          <Input
            placeholder="Nama lengkap"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
          />
          <Button onClick={handleAdd} className="w-full">
            Tambah
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              if (confirm("Reset ke 30 mahasiswa default? Akun lama akan diganti.")) {
                resetDefault();
                toast.success("Daftar direset");
              }
            }}
          >
            Reset ke default (30)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Daftar Mahasiswa ({students.length})
          </CardTitle>
          <CardDescription>Password awal sama dengan NIM</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {students.map((m, i) => {
              const u = userByStudent.get(m.id);
              return (
                <div key={m.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.nama}</p>
                      <p className="font-mono text-xs text-muted-foreground">{m.nim}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {u && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetPwd(u.id, m.nim)}
                        className="text-xs"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStudent(m.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KelolaDosen() {
  const { users, addUser, removeUser, updatePassword } = useUsers();
  const [username, setUsername] = useState("");
  const [nama, setNama] = useState("");
  const [password, setPassword] = useState("");

  const dosens = users.filter((u) => u.role === "dosen");

  const handleAdd = () => {
    if (!username.trim() || !nama.trim() || !password.trim())
      return toast.error("Semua kolom wajib diisi");
    try {
      addUser({ username, nama: nama.trim(), password, role: "dosen" });
      toast.success("Dosen ditambahkan");
      setUsername("");
      setNama("");
      setPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Tambah Dosen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <Input placeholder="Nama lengkap" value={nama} onChange={(e) => setNama(e.target.value)} />
          <Input
            placeholder="Password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button onClick={handleAdd} className="w-full">
            Tambah
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4" /> Daftar Dosen ({dosens.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dosens.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada akun dosen.</p>
          )}
          <div className="divide-y">
            {dosens.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.nama}</p>
                    <p className="font-mono text-xs text-muted-foreground">{d.username}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const np = prompt("Password baru untuk " + d.username);
                      if (np && np.trim()) {
                        updatePassword(d.id, np.trim());
                        toast.success("Password diperbarui");
                      }
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      try {
                        removeUser(d.id);
                        toast.success("Dosen dihapus");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Gagal");
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============== DOSEN ============== */

function DosenPanel() {
  const { sessions, createSession, setStatus, closeSession, reopenSession, deleteSession } =
    useSessions();
  const { students } = useStudents();
  const [judul, setJudul] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = useMemo(
    () => sessions.find((s) => s.id === (activeId ?? sessions[0]?.id)) ?? null,
    [sessions, activeId],
  );

  const handleCreate = () => {
    if (!judul.trim()) return toast.error("Masukkan judul sesi terlebih dahulu");
    const s = createSession(judul.trim());
    setActiveId(s.id);
    setJudul("");
    toast.success(`Sesi dibuat. Kode: ${s.kode}`);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buat Sesi Baru</CardTitle>
            <CardDescription>Mahasiswa menggunakan kode untuk absen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="cth. Pertemuan 5 — Algoritma"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Button onClick={handleCreate} className="w-full gap-2">
              <Plus className="h-4 w-4" /> Buat Sesi
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat Sesi</CardTitle>
            <CardDescription>{sessions.length} sesi tersimpan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada sesi.</p>
            )}
            {sessions.map((s) => {
              const total = Object.keys(s.attendance).length;
              const isActive = active?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveId(s.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    isActive
                      ? "border-primary bg-accent shadow-[var(--shadow-card)]"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{s.judul}</span>
                    <span className="font-mono text-xs text-primary">{s.kode}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(s.createdAt).toLocaleString("id-ID")}</span>
                    <span>
                      {total}/{students.length} {s.closed && "• ditutup"}
                    </span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div>
        {active ? (
          <SessionDetail
            session={active}
            students={students}
            onSetStatus={(sid, st) => setStatus(active.id, sid, st)}
            onClose={() => closeSession(active.id)}
            onReopen={() => reopenSession(active.id)}
            onDelete={() => {
              deleteSession(active.id);
              setActiveId(null);
              toast.success("Sesi dihapus");
            }}
          />
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <CalendarCheck className="h-8 w-8" />
              <p className="font-medium">Belum ada sesi aktif</p>
              <p className="text-sm">Buat sesi baru untuk memulai absensi.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SessionDetail({
  session,
  students,
  onSetStatus,
  onClose,
  onReopen,
  onDelete,
}: {
  session: ReturnType<typeof useSessions>["sessions"][number];
  students: ReturnType<typeof useStudents>["students"];
  onSetStatus: (sid: string, st: Status) => void;
  onClose: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const counts = STATUS_LIST.reduce(
    (acc, st) => ({
      ...acc,
      [st]: Object.values(session.attendance).filter((v) => v === st).length,
    }),
    {} as Record<Status, number>,
  );

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div
          className="px-6 py-5 text-primary-foreground"
          style={{ background: "var(--gradient-primary)" }}
        >
          <p className="text-xs uppercase tracking-wider opacity-80">Sesi Aktif</p>
          <h2 className="mt-1 text-xl font-semibold">{session.judul}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="rounded-lg bg-white/15 px-3 py-1.5 backdrop-blur">
              <span className="text-xs opacity-80">Kode: </span>
              <span className="font-mono text-lg font-bold tracking-widest">{session.kode}</span>
            </div>
            <span className="text-xs opacity-80">
              {new Date(session.createdAt).toLocaleString("id-ID")}
            </span>
            {session.closed && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">Ditutup</span>
            )}
          </div>
        </div>
        <CardContent className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-4">
          {STATUS_LIST.map((st) => (
            <div key={st} className="rounded-lg border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground">{st}</p>
              <p className="mt-1 text-2xl font-semibold">{counts[st]}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Daftar Mahasiswa</CardTitle>
            <CardDescription>Klik status untuk menandai kehadiran</CardDescription>
          </div>
          <div className="flex gap-2">
            {session.closed ? (
              <Button variant="outline" size="sm" onClick={onReopen} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Buka lagi
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Tutup sesi
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Hapus
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {students.map((m, idx) => {
              const cur = session.attendance[m.id];
              return (
                <div
                  key={m.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm">{m.nama}</p>
                      <p className="font-mono text-xs text-muted-foreground">{m.nim}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_LIST.map((st) => (
                      <button
                        key={st}
                        onClick={() => onSetStatus(m.id, st)}
                        disabled={session.closed}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                          cur === st
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-accent"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                    {cur && <StatusBadge status={cur} className="ml-1" />}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============== MAHASISWA ============== */

function MahasiswaPanel() {
  const { current } = useAuth();
  const { sessions, setStatus } = useSessions();
  const [kode, setKode] = useState("");
  const [status, setStatusVal] = useState<Status>("Hadir");

  const myAttendance = useMemo(() => {
    if (!current?.studentId) return [];
    return sessions
      .filter((s) => s.attendance[current.studentId!])
      .map((s) => ({ s, status: s.attendance[current.studentId!] }));
  }, [sessions, current]);

  const handleSubmit = () => {
    if (!current?.studentId) return toast.error("Akun mahasiswa tidak terhubung dengan data");
    const s = findByKode(sessions, kode);
    if (!s) return toast.error("Kode sesi tidak ditemukan");
    if (s.closed) return toast.error("Sesi sudah ditutup");
    setStatus(s.id, current.studentId, status);
    toast.success(`Absensi tercatat: ${status}`);
    setKode("");
  };

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <Card>
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle>Absen dengan Kode Sesi</CardTitle>
          <CardDescription>
            Masuk sebagai <span className="font-medium text-foreground">{current?.nama}</span> ·{" "}
            {current?.nim}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Kode Sesi</label>
            <Input
              placeholder="cth. ABC123"
              value={kode}
              onChange={(e) => setKode(e.target.value.toUpperCase())}
              className="font-mono text-lg tracking-widest uppercase"
              maxLength={10}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Status</label>
            <div className="grid grid-cols-4 gap-2">
              {STATUS_LIST.map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusVal(st)}
                  className={`rounded-md border px-2 py-2 text-sm font-medium transition ${
                    status === st
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleSubmit} className="w-full" size="lg">
            Kirim Absensi
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Absensi Saya</CardTitle>
          <CardDescription>{myAttendance.length} sesi</CardDescription>
        </CardHeader>
        <CardContent>
          {myAttendance.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada absensi.</p>
          )}
          <div className="divide-y">
            {myAttendance.map(({ s, status }) => (
              <div key={s.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.judul}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString("id-ID")}
                  </p>
                </div>
                <StatusBadge status={status} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Suppress unused import warnings
void Role;
