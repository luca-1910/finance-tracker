"use client";

import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold mb-4">Welcome to Finance Tracker</h1>
      <p className="text-lg text-gray-300 mb-8">
        Track your expenses, set goals, and achieve financial freedom.
      </p>

      <div className="flex gap-4">
        <button
          onClick={() => router.push("/login")}
          className="px-6 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-black font-semibold"
        >
          Sign In
        </button>
        <button
          onClick={() => router.push("/signup")}
          className="px-6 py-3 rounded-lg bg-white hover:bg-gray-200 text-black font-semibold"
        >
          Sign Up
        </button>
      </div>
    </div>
  );
}
