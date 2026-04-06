import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { BLOG_POSTS } from "@/lib/blog-posts";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog | Genesis Studio — AI Video Generation Insights",
  description: "Guides, tutorials, and insights about AI video generation. Learn to create stunning AI videos for TikTok, YouTube, and business marketing.",
  openGraph: {
    title: "Genesis Studio Blog",
    description: "AI video generation guides, tutorials, and insights for creators and businesses.",
  },
};

const categoryColors: Record<string, string> = {
  Guides: "bg-violet-500/15 text-violet-300",
  Tutorials: "bg-emerald-500/15 text-emerald-300",
  Education: "bg-cyan-500/15 text-cyan-300",
  Business: "bg-amber-500/15 text-amber-300",
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-zinc-100 mb-4">
            Genesis Studio Blog
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Guides, tutorials, and insights to help you create stunning AI-generated videos.
          </p>
        </div>

        <div className="space-y-6">
          {BLOG_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-violet-500/20 hover:bg-violet-500/[0.02] transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColors[post.category] || "bg-zinc-500/15 text-zinc-300"}`}>
                  {post.category}
                </span>
                <span className="text-xs text-zinc-600">{post.publishedAt}</span>
                <span className="text-xs text-zinc-600">{post.readTime}</span>
              </div>
              <h2 className="text-xl font-semibold text-zinc-100 group-hover:text-violet-300 transition-colors mb-2">
                {post.title}
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {post.description}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {post.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] text-zinc-500">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
