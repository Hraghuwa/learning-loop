"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Users, ArrowRight } from "lucide-react";

type Batch = {
  id: string;
  institute_name: string;
  batch_name: string;
  join_code: string;
  created_at: string;
  class_enrollments?: { count: number }[];
};

export default function InstituteDashboard() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newBatch, setNewBatch] = useState({ institute_name: "", batch_name: "" });

  const fetchBatches = async () => {
    const res = await fetch("/api/institute/classes");
    const data = await res.json();
    setBatches(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/institute/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newBatch),
    });
    if (res.ok) {
      setShowModal(false);
      fetchBatches();
      setNewBatch({ institute_name: "", batch_name: "" });
    }
  };

  if (loading) return <div className="p-10 font-mono text-sm animate-pulse">Loading batches...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between border-b border-[var(--border)] pb-6">
        <div>
          <h1 className="font-serif text-5xl">Institute Dashboard</h1>
          <p className="mt-2 text-[var(--muted)]">Manage your batches and monitor aggregate cognitive trends.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded bg-[var(--gold)] px-4 py-2 text-white hover:bg-[var(--gold-dark)] transition-colors"
        >
          <Plus size={18} />
          <span>New Batch</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {batches.map((batch) => (
          <div key={batch.id} className="paper-card p-6 flex flex-col justify-between group">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="font-mono text-[10px] tracking-widest text-[var(--muted)] uppercase">
                  {batch.institute_name}
                </span>
                <span className="rounded bg-[var(--blue)]/10 px-2 py-0.5 font-mono text-[10px] text-[var(--blue)]">
                  {batch.join_code}
                </span>
              </div>
              <h3 className="font-serif text-2xl mb-2">{batch.batch_name}</h3>
              <div className="flex items-center gap-2 text-[var(--muted)] text-sm">
                <Users size={14} />
                <span>{batch.class_enrollments?.[0]?.count ?? 0} Students</span>
              </div>
            </div>
            <Link
              href={`/institute/class/${batch.id}`}
              className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-4 text-sm font-mono hover:text-[var(--gold)]"
            >
              <span>View Cognitive Analysis</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        ))}
        {batches.length === 0 && (
          <div className="md:col-span-3 py-20 text-center border-2 border-dashed border-[var(--border)] rounded-xl opacity-50">
            <p className="font-serif text-xl italic">No batches created yet.</p>
            <p className="text-sm text-[var(--muted)] mt-1">Start by adding your first batch to see the loop in action.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleCreate} className="paper-card w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
            <h2 className="font-serif text-3xl mb-6">Create New Batch</h2>
            <div className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase text-[var(--muted)] mb-1">Institute Name</label>
                <input
                  required
                  value={newBatch.institute_name}
                  onChange={(e) => setNewBatch({ ...newBatch, institute_name: e.target.value })}
                  className="w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-2 focus:border-[var(--gold)] outline-none"
                  placeholder="e.g. IMS Mumbai"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-[var(--muted)] mb-1">Batch Identifier</label>
                <input
                  required
                  value={newBatch.batch_name}
                  onChange={(e) => setNewBatch({ ...newBatch, batch_name: e.target.value })}
                  className="w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-2 focus:border-[var(--gold)] outline-none"
                  placeholder="e.g. 2024 Weekend Batch A"
                />
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded border border-[var(--border)] py-2 text-sm hover:bg-[var(--paper2)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded bg-[var(--gold)] py-2 text-sm text-white hover:bg-[var(--gold-dark)] transition-colors"
              >
                Create Batch
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
