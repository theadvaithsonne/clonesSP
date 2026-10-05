"use client";

// Free Companies — the same table as /garage-admin/companies, scoped to
// companies that have never paid for an office plan: the free Starter plan, or
// a paid-plan invoice that was never paid. The scope is read from this path by
// the shared page; see planFromPath there.
export { default } from "../page";
