"use client";

import * as React from "react";
import { Button } from "@/components/ui/button"
import Autoplay from "embla-carousel-autoplay"
import { CarouselData } from "@/data/games_carousel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

export default function Hero() {
  return (
    <section>
      {/* Carousel Section  */}
      <div>
        <Carousel className="w-[90vw] lg:w-[80vw] mx-auto mt-5 max-w-[1400px] 3xl:px-[5vw]" plugins={[
        Autoplay({
          delay: 2000,
        }),
      ]} opts={{
        align: "start",
        loop: true,
      }}>
          <CarouselContent>
            {CarouselData.map((items, index) => (
              <CarouselItem key={index}>
                <div className={`h-[80vh] bg-cover flex flex-col justify-end md:items-start items-center sm:ps-10 pb-10`}  style={{ backgroundImage: `url(${items.img})` , opacity : 0.9 }}>
                  <p className="text-4xl font-bold z-20 text-center text-white mb-2">{items.name}</p>
                  <p className="text-lg z-20 text-center text-white mb-1">{items.description}</p>
                  <Button variant="outline" className="cursor-pointer">Buy now</Button>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </section>
  );
}
