import { redirect } from "next/navigation";

// People lives on the Tracking page since 10-14-26.
export default function Page() {
  redirect("/tracking#people");
}
