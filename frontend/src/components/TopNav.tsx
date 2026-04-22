"use client";

import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Link as HeroLink,
  Button,
  Chip,
} from "@heroui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/search", label: "Search" },
  { href: "/orders", label: "Order list" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <Navbar
      maxWidth="xl"
      isBordered
      classNames={{
        base: "bg-background/80 backdrop-blur-md",
        wrapper: "px-6",
      }}
    >
      <NavbarBrand>
        <NextLink href="/" className="flex items-center gap-2.5">
          <span className="relative flex items-center justify-center w-7 h-7 bg-foreground text-background rounded font-serif font-bold text-sm">
            E
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-serif text-[17px] font-semibold tracking-tight leading-none text-foreground">
              Inventory
            </span>
            <span className="text-[10px] font-medium tracking-editorial uppercase text-default-500 hidden sm:inline">
              India · INR
            </span>
          </span>
        </NextLink>
      </NavbarBrand>

      <NavbarContent className="hidden sm:flex gap-2" justify="center">
        {LINKS.map((link) => {
          const active =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <NavbarItem key={link.href} isActive={active}>
              <HeroLink
                as={NextLink}
                href={link.href}
                color={active ? "primary" : "foreground"}
                className="text-sm"
              >
                {link.label}
              </HeroLink>
            </NavbarItem>
          );
        })}
      </NavbarContent>

      <NavbarContent justify="end">
        <NavbarItem className="hidden md:flex">
          <Chip
            size="sm"
            variant="flat"
            color="success"
            startContent={<span className="w-1.5 h-1.5 rounded-full bg-success-600 ml-1 animate-pulse" />}
            className="text-[10px] tracking-editorial uppercase"
          >
            Live prices
          </Chip>
        </NavbarItem>
        <NavbarItem>
          <Button
            as={NextLink}
            href="/admin"
            size="sm"
            variant="bordered"
            className="text-xs"
          >
            Admin
          </Button>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
}
