"use client";

import type { ReactNode } from "react";
import { enlaceComoLlegar, ubicacionDelNavegador } from "@/lib/ubicacion";

// "Cómo llegar": abre Google Maps con el comercio como destino y, si tenemos
// tu ubicación del GPS, con ella como punto de partida (se arma al tocar).
export function ComoLlegar({ lat, lng, className, children = "Cómo llegar" }: { lat: number; lng: number; className?: string; children?: ReactNode }) {
  return (
    <a
      href={enlaceComoLlegar({ lat, lng })}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.currentTarget.href = enlaceComoLlegar({ lat, lng }, ubicacionDelNavegador());
      }}
      className={className}
    >
      {children}
    </a>
  );
}
