import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-zinc-900 border border-zinc-800",
            headerTitle: "text-white",
            headerSubtitle: "text-zinc-400",
            socialButtonsBlockButton:
              "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700",
            formFieldInput:
              "bg-zinc-800 border-zinc-700 text-white",
            formButtonPrimary:
              "bg-violet-600 hover:bg-violet-700",
            footerActionLink: "text-violet-400 hover:text-violet-300",
          },
        }}
      />
    </div>
  );
}
