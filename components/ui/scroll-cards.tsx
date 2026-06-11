"use client";
import { FC } from "react";
import Image from "next/image";

interface iCardItem {
  title: string;
  description: string;
  tag: string;
  src: string;
  link: string;
  color: string;
  textColor: string;
}

interface iCardProps extends Omit<iCardItem, "src" | "link" | "tag"> {
  i: number;
  src: string;
}

const Card: FC<iCardProps> = ({ title, description, color, textColor, i, src }) => {
  return (
    <div className="h-screen flex items-center justify-center sticky top-0 md:p-0 px-4">
      <div
        className="relative flex flex-col h-[300px] w-[700px] py-12 px-10 md:px-12
          rotate-0 md:h-[400px] md:w-[600px] items-center justify-center mx-auto
          shadow-md pr-3 pl-3 pt-3 pb-4"
        style={{ backgroundColor: color }}
      >
        <span className="font-bold relative text-5xl md:text-7xl mt-5">
          <span
            className="relative z-10 font-black tracking-tight"
            style={{ color: textColor }}
          >
            {title}
          </span>
        </span>
        <div
          className="text-lg md:text-2xl font-medium text-center mb-0 z-50 mt-2 lowercase tracking-wide"
          style={{ lineHeight: 1.4, color: textColor }}
        >
          {description}
        </div>
        <div className="absolute inset-0 z-0">
          <Image
            className="w-full h-full object-cover"
            src={src}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 700px"
          />
        </div>
      </div>
    </div>
  );
};

interface iCardSlideProps {
  items: iCardItem[];
}

const CardsParallax: FC<iCardSlideProps> = ({ items }) => {
  return (
    <div className="min-h-screen">
      {items.map((project, i) => (
        <Card key={`p_${i}`} {...project} i={i} />
      ))}
    </div>
  );
};

export { CardsParallax, type iCardItem };
