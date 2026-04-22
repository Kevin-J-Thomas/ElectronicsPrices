"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import ScheduleForm, { ScheduleFormValues } from "@/components/admin/ScheduleForm";
import { adminApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

export default function EditSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<ScheduleFormValues | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    adminApi.get(`/admin/schedule/${id}`).then((r) => {
      const j = r.data;
      setName(j.name);
      setInitial({
        name: j.name,
        site_id: j.site_id,
        cron_expression: j.cron_expression,
        timezone: j.timezone,
        enabled: j.enabled,
      });
    });
  }, [id]);

  async function handleSubmit(values: ScheduleFormValues) {
    await adminApi.patch(`/admin/schedule/${id}`, values);
    router.push("/admin/schedule");
  }

  async function handleDelete() {
    if (!confirm(`Delete job "${name}"?`)) return;
    await adminApi.delete(`/admin/schedule/${id}`);
    router.push("/admin/schedule");
  }

  if (!initial) {
    return (
      <div className="animate-fade-in">
        <Skeleton className="h-3 w-24 mb-4" />
        <Skeleton className="h-10 w-64 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Link href="/admin/schedule" className="inline-flex items-center gap-1.5 text-xs text-ink-faint hover:text-sienna mb-4 transition-colors">
        <ArrowLeft size={12} />
        Back to scheduler
      </Link>
      <header className="flex justify-between items-start mb-8">
        <div>
          <div className="eyebrow mb-2">Admin · Scheduler</div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-2 text-ink-soft text-sm">Editing job #{id}</p>
        </div>
        <button onClick={handleDelete} className="btn-danger">
          <Trash2 size={14} />
          Delete
        </button>
      </header>
      <ScheduleForm initial={initial} onSubmit={handleSubmit} submitLabel="Save changes" />
    </div>
  );
}
