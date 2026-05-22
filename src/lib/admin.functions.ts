import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMAIL_DOMAIN = "kampus.local";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Hanya admin yang dapat melakukan aksi ini");
}

/** Resolve a username -> email for login. Public (no auth) but only returns email if found. */
export const resolveLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ identifier: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const id = data.identifier.trim();
    if (id.includes("@")) return { email: id };
    // try username
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .eq("username", id)
      .maybeSingle();
    if (!prof) throw new Error("Username tidak ditemukan");
    // get email via admin auth
    const { data: u, error } = await supabaseAdmin.auth.admin.getUserById(prof.id);
    if (error || !u?.user?.email) throw new Error("Akun tidak memiliki email");
    return { email: u.user.email };
  });

/** Bootstrap the default admin (admin@gmail.com / admin123) if it doesn't exist. Idempotent. */
export const ensureBootstrapAdmin = createServerFn({ method: "POST" }).handler(
  async () => {
    const email = "admin@kampus.local";
    const password = "admin123";

    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
    if (existing) {
      const { data: hasRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", existing.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!hasRole) {
        await supabaseAdmin.from("user_roles").insert({ user_id: existing.id, role: "admin" });
      }
      return { created: false };
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nama: "Administrator", username: "admin" },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Gagal membuat admin");

    await supabaseAdmin.from("profiles").upsert({
      id: created.user.id,
      username: "admin",
      nama: "Administrator",
    });
    await supabaseAdmin.from("user_roles").insert({
      user_id: created.user.id,
      role: "admin",
    });
    return { created: true, email, password };
  },
);

/** Admin sets or clears the role (dosen/mahasiswa) for a user. */
export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["dosen", "mahasiswa"]).nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .in("role", ["dosen", "mahasiswa"]);
    if (data.role) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const createUserSchema = z.object({
  email: z.string().email(),
  nama: z.string().min(1).max(120),
  password: z.string().min(6).max(120),
  role: z.enum(["dosen", "mahasiswa"]),
  nim: z.string().max(40).optional().nullable(),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const email = data.email.trim().toLowerCase();
    // derive a username from email local part (kept for legacy NOT NULL column)
    const username = email.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 60) || "user";

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nama: data.nama, username },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Gagal membuat user");

    const { error: pErr } = await supabaseAdmin
  .from("profiles")
  .upsert(
    {
      id: created.user.id,
      username,
      nama: data.nama,
      nim: data.nim || null,
    },
    {
      onConflict: "id",
    },
  );
   
    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(pErr.message);
    }
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: created.user.id,
      role: data.role,
    });
    if (rErr) throw new Error(rErr.message);

    return { id: created.user.id, email };
  });


export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(6).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("Tidak bisa menghapus diri sendiri");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin lists all users (id, email, nama, nim, role, sessionsCount). */
export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [{ data: profiles }, { data: roles }, { data: sessions }, authList] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, nama, nim, username"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("attendance_sessions").select("created_by"),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ]);
    const emailMap = new Map<string, string>();
    for (const u of authList.data?.users ?? []) emailMap.set(u.id, u.email ?? "");
    const roleMap = new Map<string, "admin" | "dosen" | "mahasiswa">();
    for (const r of roles ?? []) {
      const cur = roleMap.get(r.user_id);
      const role = r.role as "admin" | "dosen" | "mahasiswa";
      if (!cur || role === "admin" || (role === "dosen" && cur === "mahasiswa")) {
        roleMap.set(r.user_id, role);
      }
    }
    const sessionCount = new Map<string, number>();
    for (const s of sessions ?? []) {
      if (s.created_by) sessionCount.set(s.created_by, (sessionCount.get(s.created_by) ?? 0) + 1);
    }
    return (profiles ?? []).map((p) => ({
      id: p.id,
      nama: p.nama,
      nim: p.nim,
      username: p.username,
      email: emailMap.get(p.id) ?? "",
      role: roleMap.get(p.id) ?? null,
      sessionsCount: sessionCount.get(p.id) ?? 0,
    }));
  });

