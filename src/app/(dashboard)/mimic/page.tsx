import { redirect } from "next/navigation";

// Mimic Studio merged into Motion Control — redirect for backwards compatibility
export default function MimicRedirect() {
  redirect("/motion-control");
}
