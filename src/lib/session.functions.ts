import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const sessionIdSchema = z.object({ sessionId: z.string().uuid() });

export const setAttendanceSessionClosed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ sessionId: z.string().uuid(), closed: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ data: roles, error: rolesError }, { data: session, error: sessionError }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId),
      supabaseAdmin
        .from("attendance_sessions")
        .select("id, created_by")
        .eq("id", data.sessionId)
        .maybeSingle(),
    ]);

    if (rolesError) throw new Error(rolesError.message);
    if (sessionError) throw new Error(sessionError.message);
    if (!session) throw new Error("Sesi tidak ditemukan");

    const roleList = (roles ?? []).map((item) => item.role);
    const isAdmin = roleList.includes("admin");
    const isDosen = roleList.includes("dosen");

    if (!isAdmin && !isDosen) throw new Error("Hanya dosen atau admin yang dapat mengubah sesi");
    if (!isAdmin && session.created_by && session.created_by !== context.userId) {
      throw new Error("Anda tidak punya akses untuk mengubah sesi ini");
    }

    const payload = session.created_by
      ? { closed: data.closed }
      : { closed: data.closed, created_by: context.userId };

    const { error } = await supabaseAdmin
      .from("attendance_sessions")
      .update(payload)
      .eq("id", data.sessionId);

    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const deleteAttendanceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sessionIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const [{ data: roles, error: rolesError }, { data: session, error: sessionError }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId),
      supabaseAdmin
        .from("attendance_sessions")
        .select("id, created_by")
        .eq("id", data.sessionId)
        .maybeSingle(),
    ]);

    if (rolesError) throw new Error(rolesError.message);
    if (sessionError) throw new Error(sessionError.message);
    if (!session) throw new Error("Sesi tidak ditemukan");

    const roleList = (roles ?? []).map((item) => item.role);
    const isAdmin = roleList.includes("admin");
    const isDosen = roleList.includes("dosen");

    if (!isAdmin && !isDosen) throw new Error("Hanya dosen atau admin yang dapat menghapus sesi");
    if (!isAdmin && session.created_by && session.created_by !== context.userId) {
      throw new Error("Anda tidak punya akses untuk menghapus sesi ini");
    }

    const { error: attendanceError } = await supabaseAdmin
      .from("attendances")
      .delete()
      .eq("session_id", data.sessionId);
    if (attendanceError) throw new Error(attendanceError.message);

    const { error } = await supabaseAdmin
      .from("attendance_sessions")
      .delete()
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });