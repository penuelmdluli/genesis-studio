import { notFound } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { getBlogPost, BLOG_POSTS } from "@/lib/blog-posts";
import type { Metadata } from "next";

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  return {
    title: `${post.title} | Genesis Studio Blog`,
    description: post.description,
    keywords: post.tags,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const paragraphs = post.content.split("\n\n").filter(Boolean);

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-20">
        {/* Breadcrumb */}
        <nav className="mb-8" aria-label="Breadcrumb">
          <Link href="/blog" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
            &larr; Back to Blog
          </Link>
        </nav>

        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-500/15 text-violet-300">
              {post.category}
            </span>
            <span className="text-xs text-zinc-500">{post.publishedAt}</span>
            <span className="text-xs text-zinc-500">{post.readTime}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-100 leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-lg text-zinc-400">
            {post.description}
          </p>
          <div className="flex items-center gap-2 mt-4">
            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-sm text-violet-300">
              G
            </div>
            <span className="text-sm text-zinc-400">{post.author}</span>
          </div>
        </header>

        {/* Content */}
        <article className="prose prose-invert max-w-none">
          {paragraphs.map((para, i) => (
            <p key={i} className="text-zinc-300 leading-relaxed mb-6 text-base">
              {para}
            </p>
          ))}
        </article>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-white/[0.06]">
          {post.tags.map((tag) => (
            <span key={tag} className="px-3 py-1 rounded-full bg-white/[0.04] text-xs text-zinc-400">
              #{tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 p-8 rounded-2xl border border-violet-500/20 bg-violet-500/[0.03] text-center">
          <h3 className="text-xl font-semibold text-zinc-100 mb-2">
            Ready to create AI videos?
          </h3>
          <p className="text-sm text-zinc-400 mb-4">
            Start generating stunning videos with 50 free credits. No credit card required.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </div>
    </div>
  );
}
