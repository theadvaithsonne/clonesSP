"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowLeft, Building2, LogOut, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DiscoverCategory, DiscoverOffice } from "@/lib/discover-api";
import { OfficeSearchPalette, shortcutLabel } from "./OfficeSearchPalette";
import { PillButton, initials } from "./ui";

export function OfficesTopBar({
  user,
  categories,
  searchQuery,
  onOpenOffice,
  onSearch,
  onSelectCategory,
  onHome,
  onCreateOffice,
  onMyOffices,
  myOfficesActive,
  myOfficeCount,
  onGoBack,
  onLogout,
}: {
  user: { name?: string; email: string; profilePicture?: string };
  categories: DiscoverCategory[];
  /** The query of the search page being shown, if any. */
  searchQuery: string;
  onOpenOffice: (office: DiscoverOffice) => void;
  onSearch: (q: string) => void;
  onSelectCategory: (category: string) => void;
  /** The logo: back to the Offices home. */
  onHome: () => void;
  onCreateOffice: () => void;
  onMyOffices: () => void;
  /** The "My offices" view is the one showing. */
  myOfficesActive: boolean;
  myOfficeCount: number;
  onGoBack: () => void;
  onLogout: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState(searchQuery);
  const [shortcut, setShortcut] = useState("⌘ K");

  useEffect(() => setShortcut(shortcutLabel()), []);
  // A query typed and then abandoned shouldn't linger in the field.
  useEffect(() => {
    if (!searchOpen) setQuery(searchQuery);
  }, [searchOpen, searchQuery]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => setSearchOpen(false);

  return (
    <header className="sticky top-0 z-40 h-[76px] border-b border-[#2b2923] bg-[#0d0d0b]">
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-4 px-4 sm:px-8 lg:px-16">
        <div className="flex flex-1 items-center">
          <button
            type="button"
            onClick={onHome}
            aria-label="Offices home"
            className="rounded-md outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-[#ffc200]"
          >
            <Image src="/logo.svg" alt="Garage" width={146} height={31} priority className="h-[26px] w-auto sm:h-[31px]" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className={cn(
            "hidden h-11 w-full max-w-[520px] items-center gap-2.5 rounded-full border bg-[#121210] px-[15px] text-left transition-colors md:flex",
            searchOpen
              ? "border-[#ffc200] shadow-[0_10px_30px_rgba(214,155,48,0.2)]"
              : "border-[#2b2923] hover:border-[#3a362c]"
          )}
        >
          <Search className="size-[17px] shrink-0 text-[#747169]" />
          <span className={cn("flex-1 truncate text-[13px]", query ? "text-[#f5f1e7]" : "text-[#747169]")}>
            {query || "Search offices"}
          </span>
          <kbd className="shrink-0 rounded-[6px] bg-[#201e18] px-[7px] py-[3px] font-sans text-[11px] text-[#747169]">
            {shortcut}
          </kbd>
        </button>

        <div className="flex flex-1 items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search offices"
            className="flex size-10 items-center justify-center rounded-full border border-[#2b2923] bg-[#121210] text-[#aaa69c] md:hidden"
          >
            <Search className="size-[18px]" />
          </button>
          <PillButton
            onClick={onMyOffices}
            aria-label="My offices"
            aria-current={myOfficesActive ? "page" : undefined}
            className={cn("px-3 lg:px-[18px]", myOfficesActive && "border-[#ffc200] text-[#ffc200]")}
          >
            <Building2 className="size-4" />
            <span className="hidden lg:inline">My offices</span>
            {myOfficeCount > 0 && (
              <span className="hidden rounded-full bg-[#201e18] px-1.5 py-px text-[11px] font-medium text-[#aaa69c] lg:inline">
                {myOfficeCount}
              </span>
            )}
          </PillButton>
          <PillButton onClick={onCreateOffice} className="px-3 sm:px-[18px]" aria-label="Create office">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Create office</span>
          </PillButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account"
                className="flex size-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#090908] bg-[#ffc200] text-[10.88px] font-bold text-black outline-none ring-offset-2 ring-offset-[#0d0d0b] focus-visible:ring-2 focus-visible:ring-[#ffc200]"
              >
                {user.profilePicture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profilePicture} alt="" className="size-full object-cover" />
                ) : (
                  initials(user.name || user.email)
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[220px] rounded-[14px] border-[#3a362c] bg-[#181713] p-1.5 text-[#f5f1e7]"
            >
              <DropdownMenuLabel className="px-2.5 py-2">
                {user.name && <p className="truncate text-[13px] font-semibold text-[#f5f1e7]">{user.name}</p>}
                <p className="truncate text-[11px] font-normal text-[#747169]">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#2b2923]" />
              <DropdownMenuItem
                onSelect={onGoBack}
                className="gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] text-[#aaa69c] focus:bg-[#201e18] focus:text-[#f5f1e7]"
              >
                <ArrowLeft className="size-4" />
                Go back
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onLogout}
                className="gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] text-[#aaa69c] focus:bg-[#201e18] focus:text-[#f5f1e7]"
              >
                <LogOut className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {searchOpen && (
        <OfficeSearchPalette
          query={query}
          onQueryChange={setQuery}
          onClose={close}
          categories={categories}
          onOpenOffice={(office) => {
            close();
            onOpenOffice(office);
          }}
          onSubmit={(q) => {
            close();
            onSearch(q);
          }}
          onSelectCategory={(c) => {
            close();
            onSelectCategory(c);
          }}
        />
      )}
    </header>
  );
}
