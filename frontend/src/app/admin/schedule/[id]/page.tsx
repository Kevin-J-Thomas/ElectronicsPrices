"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ScheduleForm, { ScheduleFormValues } from "@/components/admin/ScheduleForm";
import { adminApi } from "@/lib/api";

export default function EditSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<ScheduleFormValues | null>(null);

  useEffect(() => {
    adminApi.get(`/admin/schedule/${id}`).then((r) => {
      const j = r.data;
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
    if (!confirm("Delete this job?")) return;
    await adminApi.delete(`/admin/schedule/${id}`);
    router.push("/admin/schedule");
  }

  if (!initial) return <p>Loading…</p>;

  return (
    <div>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <Link href="/admin/schedule" className="text-blue-600 text-sm">← Back to scheduler</Link>
          <h1 className="text-2xl font-bold mt-2">Edit Scheduled Job</h1>
        </div>
        <button
          onClick={handleDelete}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Delete
        </button>
      </div>
      <ScheduleForm initial={initial} onSubmit={handleSubmit} submitLabel="Save changes" />
    </div>
  );
}
