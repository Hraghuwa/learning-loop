import { createClient } from "@supabase/supabase-js";
import { questionBank } from "./questions-bank";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  // Clear existing questions for clean re-seeding (idempotent for dev).
  const { error: delErr } = await supabase
    .from("questions")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delErr && !delErr.message.includes("0 rows")) {
    console.warn("Question wipe warning:", delErr.message);
  }

  const rows = questionBank.map((q) => ({
    topic: q.topic,
    subtopic: q.subtopic,
    difficulty: q.difficulty,
    question_text: q.question_text,
    options: q.options,
    correct_index: q.correct_index,
    hint: q.hint,
    explanation: q.explanation,
    exam_type: "CAT",
  }));

  const { error } = await supabase.from("questions").insert(rows);
  if (error) throw error;

  const benchmarkRows = [
    { error_type: "Conceptual Gap", subtopic: "Arithmetic", percentile_delta: 8.2 },
    { error_type: "Conceptual Gap", subtopic: "Algebra", percentile_delta: 7.6 },
    { error_type: "Calculation Error", subtopic: "Arithmetic", percentile_delta: 4.9 },
    { error_type: "Misread Question", subtopic: "Reading Comprehension", percentile_delta: 9.1 },
    { error_type: "Misread Question", subtopic: "Arrangements", percentile_delta: 6.1 },
    { error_type: "Shortcut Missed", subtopic: "Para Jumbles", percentile_delta: 5.4 },
    { error_type: "Shortcut Missed", subtopic: "Modern Math", percentile_delta: 6.8 },
    { error_type: "Assumption Error", subtopic: "Puzzles", percentile_delta: 7.3 },
  ];
  await supabase.from("improvement_tracking").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("improvement_tracking").insert(benchmarkRows);

  console.log(`Seeded ${rows.length} questions and ${benchmarkRows.length} benchmark rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
