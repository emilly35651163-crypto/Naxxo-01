// Ícone do app instalado no celular: o símbolo NAXXO sobre o fundo escuro, em qualquer tamanho.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export async function gerarIconeApp(tamanho: number) {
  const simbolo = await readFile(join(process.cwd(), "src/assets/naxxo-simbolo.png"));
  const src = `data:image/png;base64,${simbolo.toString("base64")}`;
  const lado = Math.round(tamanho * 0.62);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 70% 20%, #2a1d52, #0b0f1a 70%)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} width={lado} height={Math.round((lado * 235) / 256)} alt="" />
    </div>,
    { width: tamanho, height: tamanho },
  );
}
