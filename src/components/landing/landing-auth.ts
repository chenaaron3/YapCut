import { signIn } from "next-auth/react";

export function landingSignIn() {
  void signIn("google", { callbackUrl: "/projects" });
}
