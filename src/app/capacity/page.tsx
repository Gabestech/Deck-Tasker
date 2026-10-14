import { redirect } from "next/navigation";

// Renamed to Budget. Keeps old links working.
export default function CapacityPage() {
  redirect("/budget");
}
