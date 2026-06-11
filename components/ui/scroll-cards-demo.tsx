import { CardsParallax, type iCardItem } from "@/components/ui/scroll-cards";

const cardItems: iCardItem[] = [
  {
    title: "Everest Camp",
    description: "Experience the ultimate trek to the world's highest mountain",
    tag: "trekking",
    src: "https://images.unsplash.com/photo-1484291470158-b8f8d608850d?q=80&w=2940&auto=format&fit=crop",
    link: "#",
    color: "white",
    textColor: "white",
  },
  {
    title: "Annapurna",
    description: "Journey through the stunning landscapes of Nepal",
    src: "https://images.unsplash.com/photo-1635077637121-2f6013736f3d?q=80&w=3174&auto=format&fit=crop",
    tag: "hiking",
    link: "#",
    color: "green",
    textColor: "white",
  },
  {
    title: "Inca Trail",
    description: "Ancient paths leading to Machu Picchu",
    src: "https://images.unsplash.com/photo-1609668192525-c9b9342a0d92?q=80&w=2913&auto=format&fit=crop",
    tag: "adventure",
    link: "#",
    color: "white",
    textColor: "black",
  },
  {
    title: "Swiss Alps",
    description: "Discover the breathtaking beauty of European mountains",
    src: "https://images.unsplash.com/photo-1635191125273-ee825970dd05?q=80&w=2940&auto=format&fit=crop",
    tag: "mountains",
    link: "#",
    color: "white",
    textColor: "white",
  },
];

export function ScrollCardsDemo() {
  return <CardsParallax items={cardItems} />;
}

export { ScrollCardsDemo as default };
