import React from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import "./Loading.css";

export default function Loading({ size = 180 }) {
  return (
    <div className="loading-overlay">
      <DotLottieReact
        src="https://lottie.host/7c02b91c-d09f-42ae-b07a-c83254d07f7e/vJ4jfte2kl.lottie"
        loop
        autoplay
        style={{ width: size, height: size }}
      />
    </div>
  );
}
