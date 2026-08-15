"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Factory,
  KanbanSquare,
  LayoutDashboard,
  Settings,
  Target,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavSection {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

const SECTIONS: NavSection[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/opportunities", label: "Opportunities", icon: Target },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/portfolio", label: "Portfolio", icon: Factory },
  { href: "/clusters", label: "Clusters", icon: Boxes },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {SECTIONS.map((section) => {
        const active = section.exact
          ? pathname === section.href
          : pathname === section.href || pathname.startsWith(`${section.href}/`);
        const Icon = section.icon;

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-secondary font-medium text-secondary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
