import { redirect } from "next/navigation";
import { NC_FIRST_HREF } from "@/lib/nc-admin-first-route";

export default function NetworkChainsIndex() {
  redirect(NC_FIRST_HREF);
}
