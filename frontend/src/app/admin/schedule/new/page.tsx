"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { Link as HeroLink } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
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
      <HeroLink
        as={NextLink}
        href="/admin/schedule"
        size="sm"
        className="inline-flex items-center gap-1.5 text-xs mb-4"
      >
        <ArrowLeft size={12} />
        Back to scheduler
      </HeroLink>
      <header className="mb-8">
        <div className="eyebrow mb-2">Admin · Scheduler</div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Add scheduled job</h1>
        <p className="mt-2 text-default-500 text-sm max-w-xl">
          Jobs fire on a cron schedule and enqueue scrapes for their target site (or all).
        </p>
      </header>
      <ScheduleForm initial={defaultValues} onSubmit={handleSubmit} submitLabel="Create job" />
    </div>
  );
}
