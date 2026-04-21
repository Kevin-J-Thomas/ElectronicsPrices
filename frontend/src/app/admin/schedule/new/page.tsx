"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ScheduleForm, { ScheduleFormValues } from "@/components/admin/ScheduleForm";
import { adminApi } from "@/lib/api";

const defaultValues: ScheduleFormValues = {
  name: "",
  site_id: null,
  cron_expression: "0 6 * * *",
  timezone: "Asia/Kolkata",
  enabled: true,
};

export default function NewSchedulePage() {
  const router = useRouter();

  async function handleSubmit(values: ScheduleFormValues) {
    await adminApi.post("/admin/schedule", values);
    router.push("/admin/schedule");
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/schedule" className="text-blue-600 text-sm">← Back to scheduler</Link>
        <h1 className="text-2xl font-bold mt-2">Add Scheduled Job</h1>
      </div>
      <ScheduleForm initial={defaultValues} onSubmit={handleSubmit} submitLabel="Create job" />
    </div>
  );
}
