import { useEffect, useState } from "react";

export type Status = "Hadir" | "Izin" | "Sakit" | "Alpa";

export type Student = { id: string; nim: string; nama: string };

export type SessionRecord = {
  id: string;
  judul: string;
  kode: string;
  createdAt: number;
  closed: boolean;
  attendance: Record<string, Status>; // studentId -> status
};

const STUDENTS_KEY = "absensi.students.v1";
const SESSIONS_KEY = "absensi.sessions.v1";

const defaultStudents: Student[] = Array.from({ length: 30 }, (_, i) => ({
  id: crypto.randomUUID(),
  nim: `2024${String(i + 1).padStart(4, "0")}`,
  nama: `Mahasiswa ${i + 1}`,
}));

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

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  useEffect(() => {
    const existing = read<Student[] | null>(STUDENTS_KEY, null);
    if (!existing) {
      write(STUDENTS_KEY, defaultStudents);
      setStudents(defaultStudents);
    } else {
      setStudents(existing);
    }
  }, []);

  const update = (next: Student[]) => {
    setStudents(next);
    write(STUDENTS_KEY, next);
  };

  return {
    students,
    addStudent: (nim: string, nama: string) =>
      update([...students, { id: crypto.randomUUID(), nim, nama }]),
    removeStudent: (id: string) => update(students.filter((s) => s.id !== id)),
    updateStudent: (id: string, nim: string, nama: string) =>
      update(students.map((s) => (s.id === id ? { ...s, nim, nama } : s))),
    resetDefault: () => update(defaultStudents),
  };
}

export function useSessions() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  useEffect(() => {
    setSessions(read<SessionRecord[]>(SESSIONS_KEY, []));
  }, []);

  const update = (next: SessionRecord[]) => {
    setSessions(next);
    write(SESSIONS_KEY, next);
  };

  return {
    sessions,
    createSession: (judul: string) => {
      const kode = Math.random().toString(36).slice(2, 8).toUpperCase();
      const s: SessionRecord = {
        id: crypto.randomUUID(),
        judul,
        kode,
        createdAt: Date.now(),
        closed: false,
        attendance: {},
      };
      update([s, ...sessions]);
      return s;
    },
    setStatus: (sessionId: string, studentId: string, status: Status) =>
      update(
        sessions.map((s) =>
          s.id === sessionId
            ? { ...s, attendance: { ...s.attendance, [studentId]: status } }
            : s,
        ),
      ),
    closeSession: (sessionId: string) =>
      update(sessions.map((s) => (s.id === sessionId ? { ...s, closed: true } : s))),
    reopenSession: (sessionId: string) =>
      update(sessions.map((s) => (s.id === sessionId ? { ...s, closed: false } : s))),
    deleteSession: (sessionId: string) =>
      update(sessions.filter((s) => s.id !== sessionId)),
  };
}

export function findByKode(sessions: SessionRecord[], kode: string) {
  return sessions.find((s) => s.kode.toUpperCase() === kode.toUpperCase().trim());
}

export const STATUS_LIST: Status[] = ["Hadir", "Izin", "Sakit", "Alpa"];
