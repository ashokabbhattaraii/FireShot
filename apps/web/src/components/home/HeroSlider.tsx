"use client";

import Link from "next/link";
import { useMemo } from "react";
import useSWR from "swr";
import { ArrowRight, Bolt, CreditCard, Gift, Trophy, type LucideIcon } from "lucide-react";
import { A11y, Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import { FILE_BASE } from "@/lib/api";

interface HeroBanner {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  mobileImageUrl?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  badgeText?: string | null;
  badgeColor?: string | null;
  autoSlide: boolean;
}

interface FeatureSlide {
  kind: "feature";
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  highlights: string[];
  stats: Array<{
    label: string;
    value: string;
  }>;
  ctaText: string;
  ctaLink: string;
  secondaryCtaText: string;
  secondaryCtaLink: string;
  accent: string;
  icon: LucideIcon;
  autoSlide: boolean;
}

interface BannerSlide extends HeroBanner {
  kind: "banner";
}

type Slide = FeatureSlide | BannerSlide;

const FEATURE_SLIDES: FeatureSlide[] = [
  {
    kind: "feature",
    id: "feature-live-rooms",
    badge: "Live rooms",
    title: "Join tournaments faster than the lobby refreshes.",
    subtitle:
      "Battle Royale, Lone Wolf, and CS rooms are surfaced with live counts, instant status, and a clean path into the action.",
    highlights: ["Live room updates", "One-tap lobby entry", "Clear match countdowns"],
    stats: [
      { value: "24/7", label: "match access" },
      { value: "Live", label: "room tracking" },
      { value: "Fast", label: "join flow" },
    ],
    ctaText: "Browse tournaments",
    ctaLink: "/tournaments",
    secondaryCtaText: "See live leaderboard",
    secondaryCtaLink: "/leaderboard",
    accent: "linear-gradient(135deg, rgba(14, 227, 255, 0.26), rgba(9, 18, 40, 0.96))",
    icon: Bolt,
    autoSlide: true,
  },
  {
    kind: "feature",
    id: "feature-wallet",
    badge: "Wallet built in",
    title: "Keep deposits, withdrawals, and rewards in one place.",
    subtitle:
      "The wallet flow is designed for quick top-ups, transparent balances, and a minimal path from sign-in to play.",
    highlights: ["Transparent balance", "Quick deposit flow", "Safer withdrawals"],
    stats: [
      { value: "Secure", label: "balance handling" },
      { value: "Simple", label: "cash-out path" },
      { value: "Tracked", label: "history" },
    ],
    ctaText: "Open wallet",
    ctaLink: "/wallet",
    secondaryCtaText: "Create account",
    secondaryCtaLink: "/register",
    accent: "linear-gradient(135deg, rgba(255, 157, 43, 0.24), rgba(36, 18, 6, 0.96))",
    icon: CreditCard,
    autoSlide: true,
  },
  {
    kind: "feature",
    id: "feature-referrals",
    badge: "Refer & Earn",
    title: "Share a 6-character code. Earn when your squad joins.",
    subtitle:
      "No links, no fuss. New players paste your code during first signup for Rs 10, and you unlock Rs 10 after their first deposit.",
    highlights: ["6-character code", "Rs 10 signup bonus", "First deposit reward"],
    stats: [
      { value: "Rs 10", label: "friend bonus" },
      { value: "Rs 10", label: "your reward" },
      { value: "No link", label: "code only" },
    ],
    ctaText: "Get my code",
    ctaLink: "/refer",
    secondaryCtaText: "Create account",
    secondaryCtaLink: "/register",
    accent: "linear-gradient(135deg, rgba(255, 193, 7, 0.28), rgba(84, 27, 8, 0.96))",
    icon: Gift,
    autoSlide: true,
  },
  {
    kind: "feature",
    id: "feature-community",
    badge: "Community play",
    title: "Climb rankings, clear challenges, and stay supported.",
    subtitle:
      "Leaderboard pressure, challenge rooms, and match tracking all sit close to the home experience so players never lose momentum.",
    highlights: ["Live leaderboard", "Challenge rooms", "My Matches"],
    stats: [
      { value: "Top", label: "prize chase" },
      { value: "Fast", label: "help flow" },
      { value: "Active", label: "players" },
    ],
    ctaText: "View challenges",
    ctaLink: "/challenges",
    secondaryCtaText: "My matches",
    secondaryCtaLink: "/my-matches",
    accent: "linear-gradient(135deg, rgba(255, 45, 117, 0.24), rgba(31, 8, 19, 0.96))",
    icon: Trophy,
    autoSlide: true,
  },
];

export function HeroSlider() {
  const { data: banners, isLoading } = useSWR<HeroBanner[]>("/banners", {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });

  const slides = useMemo<Slide[]>(() => {
    const activeBanners = (banners ?? []).map((banner) => ({
      ...banner,
      kind: "banner" as const,
    }));

    return activeBanners.length ? [...activeBanners, ...FEATURE_SLIDES] : FEATURE_SLIDES;
  }, [banners]);

  if (isLoading) {
    return (
      <div className="hero-slider-shell overflow-hidden bg-card">
        <div className="h-full w-full animate-pulse bg-gradient-to-r from-white/5 via-white/10 to-white/5" />
      </div>
    );
  }

  const shouldAutoplay = slides.some((slide) => slide.autoSlide);

  return (
    <section className="hero-slider-shell overflow-hidden bg-black">
      <Swiper
        modules={[Autoplay, Pagination, A11y]}
        autoplay={
          shouldAutoplay
            ? { delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true }
            : false
        }
        loop={slides.length > 1}
        pagination={{
          clickable: true,
          bulletClass: "slider-dot",
          bulletActiveClass: "slider-dot-active",
        }}
        spaceBetween={0}
        slidesPerView={1}
        onSlideChange={(swiper) => {
          const slide = slides[swiper.realIndex];
          if (!shouldAutoplay || !swiper.autoplay) return;
          if (slide?.autoSlide === false) swiper.autoplay.stop();
          else swiper.autoplay.start();
        }}
        className="h-full"
      >
        {slides.map((slide) => (
          <SwiperSlide key={slide.id}>
            {slide.kind === "feature" ? (
              <FeatureBannerSlide slide={slide} />
            ) : (
              <ImageBannerSlide slide={slide} />
            )}
          </SwiperSlide>
        ))}
      </Swiper>

      <style jsx global>{`
        .hero-slider-shell {
          height: 140px;
          width: 100%;
        }
        @media (min-width: 768px) {
          .hero-slider-shell {
            aspect-ratio: 16 / 4.5;
            height: min(240px, 28vw);
          }
        }
        .hero-slider-overlay {
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.88) 0%,
            rgba(0, 0, 0, 0.24) 72%
          );
        }
        @media (min-width: 768px) {
          .hero-slider-overlay {
            background: linear-gradient(
              to right,
              rgba(0, 0, 0, 0.76) 0%,
              rgba(0, 0, 0, 0.34) 58%,
              transparent 100%
            );
          }
        }
        .hero-slider-title {
          font-size: clamp(1.1rem, 2.4vw, 1.9rem);
          line-height: 1.05;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
        }
        .hero-banner-badge {
          animation: heroBadgePulse 2.2s ease-in-out infinite;
        }
        @keyframes heroBadgePulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        .slider-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          margin: 0 4px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.4);
          transition: width 0.3s ease, background 0.3s ease;
        }
        .slider-dot-active {
          width: 22px;
          background: #fff;
        }
        .hero-slider-shell .swiper-pagination {
          bottom: 10px;
        }
      `}</style>
    </section>
  );
}

function FeatureBannerSlide({ slide }: { slide: FeatureSlide }) {
  const Icon = slide.icon;

  return (
    <article
      className="relative flex h-full w-full overflow-hidden"
      style={{ background: slide.accent }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_30%)]" />
      <div className="absolute -right-20 top-0 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-24 left-0 h-60 w-60 rounded-full bg-black/20 blur-3xl" />

      <div className="relative z-10 flex w-full flex-col justify-center gap-4 p-4 md:grid md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-6 md:p-6">
        <div className="flex flex-col justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85">
              <Icon size={12} />
              {slide.badge}
            </span>
            <h1 className="mt-3 max-w-xl font-display text-[clamp(1.35rem,3vw,2.6rem)] font-bold leading-[0.98] text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
              {slide.title}
            </h1>
            <p className="mt-2 line-clamp-2 max-w-xl text-xs leading-5 text-white/80 md:text-sm">
              {slide.subtitle}
            </p>
          </div>

          <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
            {slide.highlights.map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/12 bg-black/15 px-3 py-1 text-[11px] font-medium text-white/82 backdrop-blur"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={slide.ctaLink} className="btn-primary text-xs md:text-sm">
              {slide.ctaText}
              <ArrowRight size={14} />
            </Link>
            <Link href={slide.secondaryCtaLink} className="btn-outline text-xs md:text-sm">
              {slide.secondaryCtaText}
            </Link>
          </div>
        </div>

        <div className="relative hidden items-end md:flex md:justify-end">
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/8 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.32)] backdrop-blur">
            <div className="grid gap-3 sm:grid-cols-3">
              {slide.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-center"
                >
                  <p className="font-display text-xl font-bold text-white">{stat.value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/55">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-lg border border-white/10 bg-black/18 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Icon size={20} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Featured capability</p>
                  <p className="mt-1 font-semibold text-white">Designed for quick, repeat play.</p>
                </div>
              </div>
              <div className="mt-3 grid gap-1 text-xs text-white/72">
                <p>Built to move players from browsing to action with fewer taps.</p>
                <p>Matches, wallet, and support stay visible from the same home surface.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ImageBannerSlide({ slide }: { slide: BannerSlide }) {
  return (
    <article className="relative h-full w-full overflow-hidden bg-black">
      <picture>
        <source
          media="(max-width: 767px)"
          srcSet={bannerUrl(slide.mobileImageUrl || slide.imageUrl)}
        />
        <img
          src={bannerUrl(slide.imageUrl)}
          alt={slide.title}
          className="h-full w-full object-cover object-center"
        />
      </picture>
      <div className="hero-slider-overlay absolute inset-0" />
      <div className="absolute inset-x-5 bottom-6 z-10 text-center md:inset-x-auto md:left-8 md:max-w-xl md:text-left">
        {slide.badgeText && (
          <span
            className="hero-banner-badge mb-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
            style={{ backgroundColor: slide.badgeColor || "#E53935" }}
          >
            {slide.badgeText}
          </span>
        )}
        <h1 className="hero-slider-title font-display font-bold text-white">
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p className="mt-2 line-clamp-2 text-sm text-white/85 md:text-base">
            {slide.subtitle}
          </p>
        )}
        {slide.ctaText && slide.ctaLink && (
          <Link
            href={slide.ctaLink}
            className="btn-primary mt-3 w-fit text-xs md:text-sm"
          >
            {slide.ctaText}
            <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </article>
  );
}

function bannerUrl(url?: string | null) {
  if (!url) return "/banners/ff-banner-1.svg";
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith("/banners/") && !url.endsWith(".svg")) return `${FILE_BASE}${url}`;
  return url;
}
