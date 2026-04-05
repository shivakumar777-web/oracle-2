"use client";
import React from "react";
import { DISCLAIMER } from "@/lib/analyse/constants";

export default function DisclaimerBar() {
  return (
    <div className="disclaimer-bar no-print">
      <span style={{ marginRight: 8, fontSize: 13 }}>⚕️</span>
      {DISCLAIMER}
    </div>
  );
}
