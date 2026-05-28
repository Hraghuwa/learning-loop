/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { User, TrendingUp, AlertCircle } from "lucide-react";

export default async function InstituteClassPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { id } = await params;

  // 1. Fetch class details
  const { data: classData, error: classError } = await (supabase
    .from("institute_classes")
    .select("*")
    .eq("id", id)
    .eq("teacher_id", user!.id) as any)
    .single();

  if (classError || !classData) return notFound();

  const classItem = classData as { institute_name: string; batch_name: string; join_code: string };

  // 2. Fetch enrolled students and their profiles
  const { data: enrollments } = await (supabase
    .from("class_enrollments")
    .select("student_id, profiles(name, xp, streak_count), cognitive_profiles(*)")
    .eq("class_id", id) as any);

  const students = enrollments ?? [];

  // Calculate averages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const avgAccuracy =
    students.reduce((acc: number, s: any) => acc + (s.cognitive_profiles?.accuracy_score || 0), 0) / (students.length || 1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const avgReasoning =
    students.reduce((acc: number, s: any) => acc + (s.cognitive_profiles?.reasoning_score || 0), 0) / (students.length || 1);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between border-b border-[var(--border)] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[10px] tracking-widest text-[var(--muted)] uppercase">
              {classItem.institute_name}
            </span>
          </div>
          <h1 className="font-serif text-5xl">{classItem.batch_name}</h1>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2 rounded bg-[var(--paper2)] px-3 py-1.5 border border-[var(--border)]">
              <span className="font-mono text-xs uppercase text-[var(--muted)]">Join Code:</span>
              <span className="font-mono text-sm font-bold tracking-widest text-[var(--gold)]">{classItem.join_code}</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--muted)] text-sm">
              <User size={14} />
              <span>{students.length} Enrolled</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="paper-card p-6 flex flex-col justify-center items-center text-center">
          <TrendingUp className="text-[var(--gold)] mb-3" size={32} />
          <p className="font-mono text-[10px] uppercase text-[var(--muted)] tracking-widest">Avg Reasoning Quality</p>
          <p className="font-serif text-5xl mt-1">{avgReasoning.toFixed(1)}/10</p>
        </div>
        <div className="paper-card p-6 flex flex-col justify-center items-center text-center">
          <AlertCircle className="text-[var(--blue)] mb-3" size={32} />
          <p className="font-mono text-[10px] uppercase text-[var(--muted)] tracking-widest">Avg Solving Accuracy</p>
          <p className="font-serif text-5xl mt-1">{(avgAccuracy * 10).toFixed(0)}%</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="font-serif text-3xl">Enrolled Students</h2>
        <div className="paper-card overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-[var(--paper2)] border-b border-[var(--border)]">
              <tr>
                <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Student Name</th>
                <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Reasoning</th>
                <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Accuracy</th>
                <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] text-right">XP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {students.map((s: any) => (
                <tr key={s.student_id} className="hover:bg-[var(--paper2)] transition-colors">
                  <td className="px-6 py-4 font-serif text-lg">{s.profiles?.name || "Student"}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <div className="h-1.5 w-16 rounded bg-[var(--border)]">
                         <div
                           className="h-1.5 rounded bg-[var(--blue)]"
                           style={{ width: `${(s.cognitive_profiles?.reasoning_score || 0) * 10}%` }}
                         />
                       </div>
                       <span className="font-mono text-xs">{s.cognitive_profiles?.reasoning_score || 0}/10</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <div className="h-1.5 w-16 rounded bg-[var(--border)]">
                         <div
                           className="h-1.5 rounded bg-[var(--gold)]"
                           style={{ width: `${(s.cognitive_profiles?.accuracy_score || 0) * 10}%` }}
                         />
                       </div>
                       <span className="font-mono text-xs">{(s.cognitive_profiles?.accuracy_score || 0) * 10}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-sm">{s.profiles?.xp || 0} XP</td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center italic text-[var(--muted)]">
                    No students have joined yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
