import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "./icons";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-surface lg:h-[440px]">
      {/*
        Mobile/tablet: text stacked above the photo.
        Desktop: the photo is pinned to the right at full section height and its
        light-grey wall blends into the section background behind the text.
      */}
      <div className="shell relative z-10 flex h-full items-center pb-8 pt-10 sm:pt-14 lg:py-0">
        <div className="max-w-[26rem] animate-fade-up lg:ml-4 lg:max-w-[24rem] xl:ml-20 xl:max-w-[28rem]">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
            Better style. Brighter days.
          </p>
          <h1 className="mt-4 text-[32px] font-medium leading-[1.08] tracking-[-0.02em] sm:text-[40px] xl:text-[48px]">
            Quality Products <br className="hidden lg:block" />
            for a Modern You
          </h1>
          <p className="mt-4 max-w-[22rem] text-[15px] leading-relaxed text-muted">
            Discover everyday essentials, trendy picks, and must-haves — all in one place.
          </p>
          <Link
            href="#products"
            className="group mt-7 inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
          >
            Shop Now
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <div className="relative aspect-[4/3] w-full sm:aspect-[16/9] md:aspect-[2.1/1] lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-[1842/854] lg:w-auto lg:[mask-image:linear-gradient(to_right,transparent,black_12%)]">
        <Image
          src="/hero.jpg"
          alt="Black over-ear headphones resting on a white plinth beside a potted plant"
          fill
          preload
          sizes="(min-width: 1024px) 950px, 100vw"
          className="object-cover object-[72%_55%] lg:object-center"
        />
      </div>
    </section>
  );
}
