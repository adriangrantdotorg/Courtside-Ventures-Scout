"use server";
// After any save (src/lib/client.ts announces it, the Shell calls this): revalidatePath run in a Server Action also
// purges the browser's own copies of the pages (Next.js 16: in a Route Handler it refreshes only the server's). Scout's
// saves are API routes, so a page visited after a save could show the old copy until a reload (11-06-26).
import { revalidatePath } from "next/cache";

export async function pagesChanged() {
  revalidatePath("/", "layout");
}
