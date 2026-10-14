import { redirect } from "next/navigation";

// Renamed to Requests. Keeps old links working.
export default function QueuePage() {
  redirect("/requests");
}
