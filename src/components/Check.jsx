import React from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function Check() {
  return (
    <div style={{ display: "inline-block", marginLeft: "8px", width: "35px", height: "35px" }}>
      <DotLottieReact
        src="https://lottie.host/a21bce45-d48e-4439-a058-3a29bf7ad7ba/KXHLI8rwSe.lottie"
        loop={false} // ✅ Não repete — anima só uma vez
        autoplay={true}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}