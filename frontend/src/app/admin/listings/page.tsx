"use client";

import { useEffect, useState } from "react";
import {
  Input,
  Button,
  Chip,
  Card,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Link as HeroLink,
  Select,
  SelectItem,
  Pagination,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import { Search, ExternalLink, Trash2, Package, RefreshCw } from "lucide-react";
import { adminApi } from "@/lib/api";
import { formatINR, relativeTime } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/Skeleton";

type Listing = {
  id: number;
  site: string;
  title: string;
  url: string;
  condition: string;
  seller: string | null;
  last_seen_at: string | null;
  latest_price: number | null;
  currency: string | null;
  price_captured_at: string | null;
};

type PageRes = {
  total: number;
  page: number;
  per_page: number;
  pages: number;
  items: Listing[];
};

type Site = { id: number; name: string };

export default function AdminListingsPage() {
  const [data, setData] = useState<PageRes | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [site, setSite] = useState<string>("all");
  const [condition, setCondition] = useState<string>("all");
  const [perPage, setPerPage] = useState(25);
  const [page, setPage] = useState(1);

  const [toDelete, setToDelete] = useState<Listing | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  async function load() {
    setLoading(true);
    const params: Record<string, string | number> = { page, per_page: perPage };
    if (q) params.q = q;
    if (site !== "all") params.site = site;
    if (condition !== "all") params.condition = condition;
    const r = await adminApi.get<PageRes>("/admin/listings", { params });
    setData(r.data);
    setLoading(false);
  }

  useEffect(() => {
    adminApi.get<Site[]>("/admin/sites").then((r) => setSites(r.data));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, q, site, condition]);

  function applySearch() {
    setPage(1);
    setQ(qInput.trim());
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await adminApi.delete(`/admin/listings/${toDelete.id}`);
    setToDelete(null);
    load();
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-[11px] font-semibold tracking-editorial uppercase text-default-500 mb-2">
            Admin · Inventory
          </div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">
            All listings
          </h1>
          <p className="mt-1 text-default-500 text-sm">
            {data ? `${data.total.toLocaleString("en-IN")} indexed` : "Loading…"} · latest price per item
          </p>
        </div>
        <Button
          variant="bordered"
          onPress={load}
          startContent={<RefreshCw size={14} />}
          className="text-foreground border-default-300"
        >
          Refresh
        </Button>
      </header>

      {/* Filter toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applySearch()}
          placeholder="Search title…"
          startContent={<Search size={14} className="text-default-400" />}
          endContent={
            qInput && (
              <button
                onClick={() => {
                  setQInput("");
                  setQ("");
                  setPage(1);
                }}
                className="text-default-400 hover:text-foreground text-sm"
                aria-label="Clear search"
              >
                ×
              </button>
            )
          }
          variant="bordered"
          size="sm"
          className="flex-1 min-w-[260px]"
        />
        <Select
          aria-label="Filter by site"
          size="sm"
          variant="bordered"
          selectedKeys={[site]}
          onChange={(e) => {
            setPage(1);
            setSite(e.target.value);
          }}
          className="w-48"
          classNames={{ trigger: "min-h-[36px] h-9" }}
        >
          <>
            <SelectItem key="all">All sites</SelectItem>
            {sites.map((s) => (
              <SelectItem key={s.name}>{s.name}</SelectItem>
            ))}
          </>
        </Select>
        <Select
          aria-label="Filter by condition"
          size="sm"
          variant="bordered"
          selectedKeys={[condition]}
          onChange={(e) => {
            setPage(1);
            setCondition(e.target.value);
          }}
          className="w-40"
          classNames={{ trigger: "min-h-[36px] h-9" }}
        >
          <SelectItem key="all">All conditions</SelectItem>
          <SelectItem key="new">New</SelectItem>
          <SelectItem key="used">Used</SelectItem>
        </Select>
        <Button color="primary" size="sm" onPress={applySearch} startContent={<Search size={14} />}>
          Apply
        </Button>
        {(q || site !== "all" || condition !== "all") && (
          <Button
            size="sm"
            variant="light"
            onPress={() => {
              setQInput("");
              setQ("");
              setSite("all");
              setCondition("all");
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {(q || site !== "all" || condition !== "all") && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold tracking-editorial uppercase text-default-500 mr-1">
            Active
          </span>
          {q && (
            <Chip
              size="sm"
              variant="flat"
              color="primary"
              onClose={() => {
                setQInput("");
                setQ("");
              }}
            >
              Search: {q}
            </Chip>
          )}
          {site !== "all" && (
            <Chip size="sm" variant="flat" color="primary" onClose={() => setSite("all")}>
              Site: {site}
            </Chip>
          )}
          {condition !== "all" && (
            <Chip size="sm" variant="flat" color="primary" onClose={() => setCondition("all")}>
              Condition: {condition}
            </Chip>
          )}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={10} cols={6} />
      ) : !data || data.items.length === 0 ? (
        <Card>
          <CardBody className="p-12 text-center">
            <Package size={28} className="mx-auto text-default-400 mb-3" />
            <div className="font-serif text-xl italic text-default-500 mb-2">
              No listings{q || site !== "all" || condition !== "all" ? " match these filters" : " indexed yet"}.
            </div>
            <p className="text-sm text-default-500">
              Trigger a scrape from the Sites page to populate the index.
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <Table
            aria-label="All listings"
            removeWrapper
            classNames={{
              base: "bg-content1 rounded-xl border border-divider overflow-hidden",
              th: "text-[11px] font-semibold tracking-[0.14em] uppercase text-default-500 bg-content2 h-10",
              td: "py-3 text-foreground",
              tr: "border-b border-divider last:border-0",
            }}
          >
            <TableHeader>
              <TableColumn width={60}>#</TableColumn>
              <TableColumn>Title</TableColumn>
              <TableColumn width={140}>Site</TableColumn>
              <TableColumn width={100}>Condition</TableColumn>
              <TableColumn width={130} align="end">Latest price</TableColumn>
              <TableColumn width={130}>Last seen</TableColumn>
              <TableColumn width={120} align="end">Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {data.items.map((it, idx) => (
                <TableRow key={it.id}>
                  <TableCell>
                    <span className="num text-xs text-default-500">
                      {(data.page - 1) * data.per_page + idx + 1}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5 max-w-[540px]">
                      <span className="text-sm line-clamp-2 text-foreground">{it.title}</span>
                      <HeroLink
                        href={it.url}
                        isExternal
                        size="sm"
                        className="text-[11px] text-default-500 inline-flex items-center gap-1 truncate max-w-full"
                      >
                        {it.url.replace(/^https?:\/\//, "").slice(0, 80)}
                        <ExternalLink size={10} className="shrink-0" />
                      </HeroLink>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-[10px] tracking-editorial uppercase text-default-500">
                      {it.site}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="sm"
                      variant="flat"
                      color={it.condition === "used" ? "warning" : "default"}
                      className="text-[10px] uppercase"
                    >
                      {it.condition}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    {it.latest_price !== null ? (
                      <span className="num font-semibold">{formatINR(it.latest_price)}</span>
                    ) : (
                      <span className="text-default-400 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-default-500">{relativeTime(it.last_seen_at)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        aria-label="Delete listing"
                        onPress={() => {
                          setToDelete(it);
                          onOpen();
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Footer: pagination + per-page */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-default-500">
              Showing{" "}
              <span className="num font-medium text-foreground">
                {(data.page - 1) * data.per_page + 1}–
                {Math.min(data.page * data.per_page, data.total)}
              </span>{" "}
              of <span className="num font-medium text-foreground">{data.total.toLocaleString("en-IN")}</span>
            </div>

            <div className="flex items-center gap-3">
              <Select
                aria-label="Rows per page"
                size="sm"
                variant="bordered"
                selectedKeys={[String(perPage)]}
                onChange={(e) => {
                  setPerPage(parseInt(e.target.value, 10));
                  setPage(1);
                }}
                className="w-28"
              >
                <SelectItem key="10">10 / page</SelectItem>
                <SelectItem key="25">25 / page</SelectItem>
                <SelectItem key="50">50 / page</SelectItem>
                <SelectItem key="100">100 / page</SelectItem>
              </Select>

              <Pagination
                total={data.pages}
                page={data.page}
                onChange={setPage}
                showControls
                size="sm"
                color="primary"
              />
            </div>
          </div>
        </>
      )}

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Delete listing?</ModalHeader>
              <ModalBody>
                <p className="text-sm">Remove this listing from the index?</p>
                <p className="text-xs text-default-500 line-clamp-3">{toDelete?.title}</p>
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
