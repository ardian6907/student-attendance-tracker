import { useEffect, useState } from "react";

export type Role = "admin" | "dosen" | "mahasiswa";

export type User = {
  id: string;
  username: string;
  password: string;
  nama: string;
  role: Role;
  /** untuk mahasiswa: id pada daftar Student */
  studentId?: string;
  nim?: string;
};

const USERS_KEY = "absensi.users.v1";
const SESSION_KEY = "absensi.auth.v1";

const defaultAdmin: User = {
  id: "admin-root",
  username: "admin",
  password: "admin123",
  nama: "Administrator",
  role: "admin",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// Simple pub/sub so all components see auth changes
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const sync = () => {
      const existing = read<User[] | null>(USERS_KEY, null);
      if (!existing) {
        write(USERS_KEY, [defaultAdmin]);
        setUsers([defaultAdmin]);
      } else if (!existing.some((u) => u.role === "admin")) {
        const next = [defaultAdmin, ...existing];
        write(USERS_KEY, next);
        setUsers(next);
      } else {
        setUsers(existing);
      }
    };
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const update = (next: User[]) => {
    write(USERS_KEY, next);
    setUsers(next);
    notify();
  };

  return {
    users,
    addUser: (u: Omit<User, "id">) => {
      const exists = users.some(
        (x) => x.username.toLowerCase() === u.username.toLowerCase().trim(),
      );
      if (exists) throw new Error("Username sudah dipakai");
      const newUser: User = { ...u, id: crypto.randomUUID(), username: u.username.trim() };
      update([...users, newUser]);
      return newUser;
    },
    removeUser: (id: string) => {
      if (id === defaultAdmin.id) throw new Error("Admin utama tidak bisa dihapus");
      update(users.filter((u) => u.id !== id));
    },
    updatePassword: (id: string, password: string) => {
      update(users.map((u) => (u.id === id ? { ...u, password } : u)));
    },
    /** Pastikan setiap mahasiswa di daftar punya akun login (username=nim, default password=nim).
     *  Hapus akun mahasiswa yang studentId-nya sudah tidak ada. */
    syncMahasiswa: (students: { id: string; nim: string; nama: string }[]) => {
      const studentIds = new Set(students.map((s) => s.id));
      const kept = users.filter((u) => u.role !== "mahasiswa" || (u.studentId && studentIds.has(u.studentId)));
      const existingByStudent = new Map(
        kept.filter((u) => u.role === "mahasiswa").map((u) => [u.studentId!, u]),
      );
      const added: User[] = [];
      for (const s of students) {
        if (!existingByStudent.has(s.id)) {
          added.push({
            id: crypto.randomUUID(),
            username: s.nim,
            password: s.nim,
            nama: s.nama,
            role: "mahasiswa",
            studentId: s.id,
            nim: s.nim,
          });
        }
      }
      const next = [...kept, ...added].map((u) => {
        if (u.role !== "mahasiswa" || !u.studentId) return u;
        const s = students.find((x) => x.id === u.studentId);
        return s ? { ...u, nama: s.nama, nim: s.nim } : u;
      });
      update(next);
    },
  };
}

export function useAuth() {
  const [current, setCurrent] = useState<User | null>(null);

  useEffect(() => {
    const sync = () => setCurrent(read<User | null>(SESSION_KEY, null));
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  return {
    current,
    login: (username: string, password: string) => {
      const all = read<User[]>(USERS_KEY, [defaultAdmin]);
      const u = all.find(
        (x) =>
          x.username.toLowerCase() === username.toLowerCase().trim() && x.password === password,
      );
      if (!u) throw new Error("Username atau password salah");
      write(SESSION_KEY, u);
      setCurrent(u);
      notify();
      return u;
    },
    logout: () => {
      localStorage.removeItem(SESSION_KEY);
      setCurrent(null);
      notify();
    },
  };
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  dosen: "Dosen",
  mahasiswa: "Mahasiswa",
};
