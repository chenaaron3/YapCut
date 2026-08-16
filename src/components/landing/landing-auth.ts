import { signIn } from "next-auth/react";

export function landingSignIn() {
  void signIn("google", { callbackUrl: "/projects" });
}

export const LANDING_PREVIEW =
  "https://images.unsplash.com/photo-1698509423508-971fc81ebaa8?auto=format&w=720&q=80&fit=crop";
