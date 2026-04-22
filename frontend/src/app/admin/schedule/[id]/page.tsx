"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  Button,
  Link as HeroLink,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import { ArrowLeft, Trash2 } from "lucide-react";
import ScheduleForm, { ScheduleFormValues } from "@/components/admin/ScheduleForm";
import { adminApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

export default function EditSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<ScheduleFormValues | null>(null);
  const [name, setName] = useState("");
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

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

  async function confirmDelete() {
    await adminApi.delete(`/admin/schedule/${id}`);
    router.push("/admin/schedule");
  }

  if (!initial) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
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
      <header className="flex justify-between items-start mb-8">
        <div>
          <div className="eyebrow mb-2">Admin · Scheduler</div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-2 text-default-500 text-sm">Editing job #{id}</p>
        </div>
        <Button color="danger" variant="flat" startContent={<Trash2 size={14} />} onPress={onOpen}>
          Delete
        </Button>
      </header>
      <ScheduleForm initial={initial} onSubmit={handleSubmit} submitLabel="Save changes" />

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Delete job?</ModalHeader>
              <ModalBody>
                Delete job <strong>{name}</strong>?
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="danger"
                  onPress={() => {
                    confirmDelete();
                    onClose();
                  }}
                >
                  Delete
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
