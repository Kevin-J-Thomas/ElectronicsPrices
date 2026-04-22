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
import SiteForm, { SiteFormValues } from "@/components/admin/SiteForm";
import { adminApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

export default function EditSitePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<SiteFormValues | null>(null);
  const [name, setName] = useState<string>("");
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  useEffect(() => {
    adminApi.get(`/admin/sites/${id}`).then((r) => {
      const s = r.data;
      setName(s.name);
      setInitial({
        name: s.name,
        base_url: s.base_url,
        scraper_type: s.scraper_type,
        enabled: s.enabled,
        requires_location: s.requires_location,
        requires_auth: s.requires_auth,
        config: JSON.stringify(s.config ?? {}, null, 2),
        categories: (s.categories ?? []).join(", "),
        concurrent_requests: s.concurrent_requests,
        download_delay_seconds: s.download_delay_seconds,
        use_proxy: s.use_proxy,
        user_agent: s.user_agent ?? "",
      });
    });
  }, [id]);

  async function handleSubmit(values: SiteFormValues) {
    const payload = {
      name: values.name,
      base_url: values.base_url,
      scraper_type: values.scraper_type,
      enabled: values.enabled,
      requires_location: values.requires_location,
      requires_auth: values.requires_auth,
      config: values.config ? JSON.parse(values.config) : {},
      categories: values.categories.split(",").map((c) => c.trim()).filter(Boolean),
      concurrent_requests: values.concurrent_requests,
      download_delay_seconds: values.download_delay_seconds,
      use_proxy: values.use_proxy,
      user_agent: values.user_agent || null,
    };
    await adminApi.patch(`/admin/sites/${id}`, payload);
    router.push("/admin/sites");
  }

  async function confirmDelete() {
    await adminApi.delete(`/admin/sites/${id}`);
    router.push("/admin/sites");
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
        href="/admin/sites"
        size="sm"
        className="inline-flex items-center gap-1.5 text-xs mb-4"
      >
        <ArrowLeft size={12} />
        Back to sites
      </HeroLink>
      <header className="flex justify-between items-start mb-8">
        <div>
          <div className="eyebrow mb-2">Admin · Sites</div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-2 text-default-500 text-sm">Editing site #{id}</p>
        </div>
        <Button color="danger" variant="flat" startContent={<Trash2 size={14} />} onPress={onOpen}>
          Delete
        </Button>
      </header>

      <SiteForm initial={initial} onSubmit={handleSubmit} submitLabel="Save changes" />

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Delete site?</ModalHeader>
              <ModalBody>
                Delete site <strong>{name}</strong>? This cannot be undone.
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
